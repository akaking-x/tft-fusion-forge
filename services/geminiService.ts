import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Champion, SocialContent } from "../types";
import { FUSION_PROMPT } from "../constants";
import { getCachedImage, uploadImageToS3 } from "./s3Service";

// --- FETCH INTERCEPTOR FOR VERTEX AI OAUTH ---
// The @google/genai SDK (client-side) expects standard API keys.
// To support `gcloud auth print-access-token` (OAuth), we must manually inject the `Authorization: Bearer` header
// when targeting Vertex AI endpoints, as the SDK doesn't natively support raw token passing in browser contexts easily.
const originalFetch = window.fetch;

const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url = input;
    if (input instanceof Request) {
        url = input.url;
    }
    url = url.toString();
    
    // Check if it's a Vertex AI call and we have a token
    // We check window variables set in App.tsx
    if (url.includes('aiplatform.googleapis.com') && (window as any).VERTEX_CONFIG && (window as any).USER_PROVIDED_KEY) {
        const newInit = init || {};
        
        // Handle if config is undefined or headers structure
        const headers = new Headers(newInit.headers || {});
        headers.set('Authorization', `Bearer ${(window as any).USER_PROVIDED_KEY}`);
        
        newInit.headers = headers;

        return originalFetch(input, newInit);
    }
    return originalFetch(input, init);
};

// Attempt to overwrite window.fetch safely
try {
    // Attempt direct assignment
    window.fetch = customFetch;
} catch (e) {
    // If direct assignment fails (e.g. getter-only), define property
    try {
        Object.defineProperty(window, 'fetch', {
            value: customFetch,
            writable: true,
            configurable: true
        });
    } catch (e2) {
        console.error("Failed to intercept window.fetch for Vertex AI Auth", e2);
    }
}

// Helper to get API Key (or Token)
const getApiKey = () => {
  return (window as any).USER_PROVIDED_KEY || sessionStorage.getItem('user_api_key') || process.env.API_KEY;
};

// Helper to construct GoogleGenAI instance based on mode (AI Studio vs Vertex)
const getGenAI = () => {
    const key = getApiKey();
    const vertexConfig = (window as any).VERTEX_CONFIG;
    
    if (vertexConfig && vertexConfig.projectId) {
        // Vertex Mode
        return new GoogleGenAI({
            vertexai: true,
            project: vertexConfig.projectId,
            location: vertexConfig.location
        });
    }
    // AI Studio Mode
    return new GoogleGenAI({ apiKey: key });
}


// Helper to convert blob to base64 (Standard)
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Robust fetch that handles WebP to PNG conversion via Canvas
const fetchAndConvertToPngBase64 = async (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Try to handle CORS
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      
      // Convert to PNG Data URL
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl.split(',')[1]); // Return clean base64
    };

    img.onerror = async () => {
        // Fallback: simple fetch if image load fails (might be not an image or strict CORS)
        try {
            const response = await fetch(url);
            if (!response.ok) {
                resolve(null);
                return;
            }
            const blob = await response.blob();
            resolve(await blobToBase64(blob));
        } catch (e) {
            console.warn("Image fetch fallback failed", e);
            resolve(null);
        }
    };

    img.src = url;
  });
};

export const searchChampionImage = async (champion: Champion): Promise<string | undefined> => {
  // 1. Check S3 Cache first
  const cachedUrl = await getCachedImage(champion.name, champion.skin);
  if (cachedUrl) {
    console.log(`[Cache Hit] Found ${champion.name} in S3`);
    return cachedUrl;
  }

  const ai = getGenAI();
  
  const query = `Find a high resolution official splash art or in-game model render for the character ${champion.name} (Skin: ${champion.skin}) from Teamfight Tactics or League of Legends.`;
  let foundUrl: string | undefined;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `${query} Return a JSON object with a single key 'imageUrl' containing the best direct link to the image found.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json'
      }
    });

    if (response.text) {
      try {
          const data = JSON.parse(response.text);
          foundUrl = data.imageUrl;
      } catch (e) { /* ignore */ }
    }

    if (foundUrl) {
        // 2. Fetch, Convert to PNG, Upload to S3
        const base64Data = await fetchAndConvertToPngBase64(foundUrl);
        if (base64Data) {
            const s3Url = await uploadImageToS3(champion.name, champion.skin, base64Data);
            if (s3Url) return s3Url;
            // If upload fails, just return the base64 as a data URI to ensure it works this session
            return `data:image/png;base64,${base64Data}`;
        }
        return foundUrl; // Fallback to raw URL if conversion fails
    }

  } catch (error: any) {
    const errorMsg = error.toString();
    console.error(`Search failed for ${champion.name}`, error);
    throw error;
  }
  return undefined;
};

export const generateThumbnail = async (
  champ1: Champion,
  champ2: Champion,
  imgUrl1: string | null,
  imgUrl2: string | null
): Promise<string | null> => {
  const ai = getGenAI();

  const parts: any[] = [];
  
  if (imgUrl1) {
    const b64 = await fetchAndConvertToPngBase64(imgUrl1);
    if (b64) parts.push({ inlineData: { mimeType: 'image/png', data: b64 } });
  }
  if (imgUrl2) {
    const b64 = await fetchAndConvertToPngBase64(imgUrl2);
    if (b64) parts.push({ inlineData: { mimeType: 'image/png', data: b64 } });
  }

  parts.push({
    text: `Create a high-impact YouTube thumbnail (aspect ratio 3:4, resolution 1K). 
    
    Composition:
    - Split screen or versus mode composition.
    - Left side: ${champ1.name} (Source Image 1).
    - Right side: ${champ2.name} (Source Image 2).
    - Center/Overlay: A large, glowing, mysterious silhouette or question mark representing their fusion.
    - Text: Render the text "${champ1.name} + ${champ2.name} = ?" or "SECRET FUSION" in a bold, cinematic, shiny 3D font.
    - Style: High contrast, neon outlines, particles, aggressive "VS" fighting game energy.
    - Make sure the text is legible and catchy.`
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: '3:4',
          imageSize: '1K'
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Thumbnail generation failed", error);
  }
  return null;
};

export const generateViralContent = async (champ1: Champion, champ2: Champion): Promise<SocialContent> => {
  const ai = getGenAI();

  const prompt = `
    Analyze these two characters: ${champ1.name} (${champ1.skin}) and ${champ2.name} (${champ2.skin}).
    
    Task: Invent a unique "Signature Ability" (Move) that this fusion character uses.
    
    Generate 5 things in English:
    1. 'actionDescription': A detailed description of this specific Signature Ability. Include the Name of the move, the visual action, and explicitly describe the SOUND EFFECTS (SFX) (e.g., 'ear-splitting thunder', 'heavy metallic thud', 'sizzling laser').
    2. 'tiktokCaption': A viral TikTok caption. The goal is to hype up this specific new ability. Describe how OP/Broken the move is. Hook: "New Secret Tech: [Move Name]?". Body: Hype the SFX and impact. CTA: "Comment what this move sounds like!". Hashtags: #TFT #LeagueOfLegends #AIart #UnrealEngine5.
    3. 'firstComment': A specific engaging comment asking users to name the move or rate its power level.
    4. 'duoImagePrompt': A vivid prompt describing the two original characters standing together. 
       - Style: Hyper-realistic 3D render, Unreal Engine 5.
       - Atmosphere: Tense, battle-ready, cinematic lighting.
       - Audio Vis: Static electricity, floating rocks, visual distortion.
    5. 'fusionImagePrompt': A vivid prompt describing the fused character EXECUCTING the Signature Ability. 
       - Style: 8K Octane Render, Action Camera.
       - Focus: Impact frames, particle effects, shockwaves.
       **CRITICAL RULES:**
       - Describe a single fused entity.
       - Focus on the ACTION and CAMERA ANGLE (Low angle, Dutch tilt).
       - NO names of original champions.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      actionDescription: { type: Type.STRING },
      tiktokCaption: { type: Type.STRING },
      firstComment: { type: Type.STRING },
      duoImagePrompt: { type: Type.STRING },
      fusionImagePrompt: { type: Type.STRING }
    },
    required: ["actionDescription", "tiktokCaption", "firstComment", "duoImagePrompt", "fusionImagePrompt"],
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  });

  if (!response.text) throw new Error("Failed to generate social content");
  
  return JSON.parse(response.text) as SocialContent;
}

export const generateDuoImage = async (
  champ1: Champion, 
  champ2: Champion, 
  imgUrl1: string | null, 
  imgUrl2: string | null
): Promise<string | null> => {
  const ai = getGenAI();

  const parts: any[] = [];
  
  let imageData1: string | null = null;
  let imageData2: string | null = null;

  if (imgUrl1) imageData1 = await fetchAndConvertToPngBase64(imgUrl1);
  if (imgUrl2) imageData2 = await fetchAndConvertToPngBase64(imgUrl2);

  if (imageData1) parts.push({ inlineData: { mimeType: 'image/png', data: imageData1 } });
  if (imageData2) parts.push({ inlineData: { mimeType: 'image/png', data: imageData2 } });

  parts.push({
    text: `Create a Hyper-Realistic 3D Cinematic vertical image (9:16 aspect ratio) featuring BOTH characters: ${champ1.name} and ${champ2.name}. 
    
    COMPOSITION & CAMERA:
    - Camera: Low-angle "Hero Shot" looking up at them, or a dynamic wide-angle lens (24mm) capturing them before a battle.
    - Framing: They are standing side-by-side or back-to-back, occupying the frame with dominance.
    - Atmosphere: Raw, gritty, 8K highly detailed textures.
    
    VISUAL SFX (NO MUSIC):
    - Visualize the energy between them. Static electricity, rising dust particles, heat haze, or magical aura distortion.
    - Lighting: Cinematic volumetric lighting (God rays), dark moody background with bright rim lighting on the characters.
    - Style: Unreal Engine 5 Cinematic Trailer, Octane Render, VFX heavy.
    - Do NOT fuse them yet.`
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', // Supports 9:16
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: '9:16',
          imageSize: '2K'
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Duo generation failed", error);
  }
  return null;
}

export const generateFusionImage = async (
  champ1: Champion, 
  champ2: Champion, 
  imgUrl1: string | null, 
  imgUrl2: string | null
): Promise<string | null> => {
  const ai = getGenAI();

  const parts: any[] = [];
  
  let imageData1: string | null = null;
  let imageData2: string | null = null;

  if (imgUrl1) imageData1 = await fetchAndConvertToPngBase64(imgUrl1);
  if (imgUrl2) imageData2 = await fetchAndConvertToPngBase64(imgUrl2);

  if (imageData1) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: imageData1
      }
    });
  }
  
  if (imageData2) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: imageData2
      }
    });
  }

  // Construct a detailed text prompt
  const detailedContext = `
    Image 1 Context: Champion Name: ${champ1.name}, Skin: ${champ1.skin}, Origin: ${champ1.origin.join('/')}, Class: ${champ1.class.join('/')}.
    Image 2 Context: Champion Name: ${champ2.name}, Skin: ${champ2.skin}, Origin: ${champ2.origin.join('/')}, Class: ${champ2.class.join('/')}.
    
    ${FUSION_PROMPT}
  `;

  parts.push({ text: detailedContext });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: parts
      },
      config: {
        imageConfig: {
          aspectRatio: '9:16',
          imageSize: '2K' 
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Fusion generation failed", error);
    throw error;
  }

  return null;
};
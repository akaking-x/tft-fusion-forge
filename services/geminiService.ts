import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Champion, SocialContent } from "../types";
import { FUSION_PROMPT } from "../constants";
import { getCachedImage, uploadImageToS3 } from "./s3Service";

// Helper to get API Key from various sources
const getApiKey = () => {
  return process.env.API_KEY || (window as any).USER_PROVIDED_KEY || sessionStorage.getItem('user_api_key');
};

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

  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
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
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

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
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const prompt = `
    Analyze these two characters: ${champ1.name} (${champ1.skin}) and ${champ2.name} (${champ2.skin}).
    
    Generate 5 things in English:
    1. 'actionDescription': An exciting, dramatic English description of their fusion in battle.
    2. 'tiktokCaption': A viral TikTok caption. Hook: "What happens if you fuse X and Y?". Body: Short hype. CTA: "Comment below which champions I should fuse next!". Hashtags: #TFT #LeagueOfLegends #AIart.
    3. 'firstComment': A specific engaging comment for me to post that explicitly asks for requests. Example: "I'm looking for the craziest combos! Drop your request below and I'll cook it next! 👇👨‍🍳"
    4. 'duoImagePrompt': A vivid, single-sentence English action prompt describing the two original characters standing together. Example: "${champ1.name} and ${champ2.name} standing back-to-back in a defensive stance, weapons drawn, looking ready to face an army." or "${champ1.name} glaring at ${champ2.name} as sparks fly between them."
    5. 'fusionImagePrompt': A vivid, single-sentence English action prompt describing the character performing a powerful move. 
       **CRITICAL RULES FOR fusionImagePrompt:**
       - Describe the character as a single, unique entity.
       - Do NOT use words like "fusion", "merged", "combined", "hybrid", "mixed", "both", or "half".
       - Do NOT use the names "${champ1.name}" or "${champ2.name}".
       - Focus strictly on the visual action, energy, weapons, and pose.
       - Example: "A warrior clad in crystalline armor strikes the ground, sending shockwaves of blue fire outward."
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
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const parts: any[] = [];
  
  let imageData1: string | null = null;
  let imageData2: string | null = null;

  if (imgUrl1) imageData1 = await fetchAndConvertToPngBase64(imgUrl1);
  if (imgUrl2) imageData2 = await fetchAndConvertToPngBase64(imgUrl2);

  if (imageData1) parts.push({ inlineData: { mimeType: 'image/png', data: imageData1 } });
  if (imageData2) parts.push({ inlineData: { mimeType: 'image/png', data: imageData2 } });

  parts.push({
    text: `Create a cinematic vertical image (9:16 aspect ratio) featuring BOTH characters: ${champ1.name} and ${champ2.name}. 
    
    They should be standing together in a dynamic composition (e.g., back-to-back, facing each other in a standoff, or charging forward together).
    Maintain their original designs, armor, and weapons accurately based on the provided reference images.
    Lighting should be dramatic and high quality. 8K concept art style.
    Do NOT fuse them. This is a team-up or versus shot.`
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
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

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
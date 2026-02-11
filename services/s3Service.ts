import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { S3Config } from "../types";

let s3Client: S3Client | null = null;
let currentConfig: S3Config | null = null;

export const initS3 = (config: S3Config) => {
  currentConfig = config;
  s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true // Needed for many S3 compatible storages like MinIO/R2
  });
};

export const getS3Config = () => currentConfig;

const sanitizeKey = (name: string, skin: string) => {
  const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
  const cleanSkin = skin.replace(/[^a-zA-Z0-9]/g, '');
  return `champions/${cleanName}_${cleanSkin}.png`;
};

export const getCachedImage = async (name: string, skin: string): Promise<string | null> => {
  if (!s3Client || !currentConfig) return null;

  const key = sanitizeKey(name, skin);
  
  try {
    // Check if exists
    await s3Client.send(new HeadObjectCommand({
      Bucket: currentConfig.bucketName,
      Key: key
    }));

    // Construct URL
    if (currentConfig.publicUrlBase) {
      return `${currentConfig.publicUrlBase}/${key}`;
    }
    // Fallback to standard S3 URL structure (may vary by provider)
    return `${currentConfig.endpoint}/${currentConfig.bucketName}/${key}`;
  } catch (e) {
    // Object doesn't exist or permission error
    return null;
  }
};

export const uploadImageToS3 = async (name: string, skin: string, base64Data: string): Promise<string | null> => {
  if (!s3Client || !currentConfig) return null;

  const key = sanitizeKey(name, skin);
  return uploadBase64Internal(key, base64Data);
};

export const uploadProjectAsset = async (projectId: string, assetType: 'duo' | 'fusion' | 'thumbnail', base64Data: string): Promise<string | null> => {
  if (!s3Client || !currentConfig) return null;
  
  // Clean base64 if it has prefix
  const cleanData = base64Data.replace(/^data:image\/\w+;base64,/, "");
  const key = `projects/${projectId}/${assetType}.png`;
  
  return uploadBase64Internal(key, cleanData);
};

const uploadBase64Internal = async (key: string, base64Data: string): Promise<string | null> => {
  if (!s3Client || !currentConfig) return null;

  // Convert base64 string to Uint8Array for S3 body
  // Handle potentially raw base64 or data uri
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: currentConfig.bucketName,
      Key: key,
      Body: bytes,
      ContentType: 'image/png',
      ACL: 'public-read' // Try to make it public
    }));

     if (currentConfig.publicUrlBase) {
      return `${currentConfig.publicUrlBase}/${key}`;
    }
    return `${currentConfig.endpoint}/${currentConfig.bucketName}/${key}`;
  } catch (e) {
    console.error(`S3 Upload Failed for ${key}`, e);
    return null;
  }
}
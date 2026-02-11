export interface Champion {
  name: string;
  cost: number;
  origin: string[];
  class: string[];
  skin: string;
  unlockable: boolean;
  unlock_condition?: string;
}

export interface Traits {
  origins: string[];
  classes: string[];
  unique_traits: string[];
}

export interface TFTData {
  set: string;
  release_date: string;
  total_champions: number;
  unlockable_champions: number;
  champions: Champion[];
  traits: Traits;
  special_skin_notes: any;
}

export interface SocialContent {
  actionDescription: string;
  tiktokCaption: string;
  firstComment: string;
  duoImagePrompt: string;
  fusionImagePrompt: string;
}

export interface FusionProject {
  id: string;
  timestamp: number;
  champions: [Champion, Champion];
  images: {
    source1: string | null;
    source2: string | null;
    duo: string | null;
    fusion: string | null;
    thumbnail: string | null;
  };
  prompts: SocialContent;
}

export interface S3Config {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrlBase?: string; // Optional custom domain
}

export interface MongoConfig {
  connectionString: string;
  dbName: string;
  collectionName: string;
  enabled: boolean;
}

export interface VertexConfig {
  projectId: string;
  location: string;
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user';
  password?: string;
  providedApiKey?: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  READY = 'READY',
  ROLLING = 'ROLLING', // New status for Gacha effect
  SELECTED = 'SELECTED',
  SEARCHING = 'SEARCHING',
  GENERATING_FUSION = 'GENERATING_FUSION',
  GENERATING_THUMBNAIL = 'GENERATING_THUMBNAIL',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum GenerationState {
  IDLE,
  LOADING,
  SUCCESS,
  FAILURE
}

// Augment window object for the AI Studio helper
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
    USER_PROVIDED_KEY?: string;
    VERTEX_CONFIG?: VertexConfig;
  }
}
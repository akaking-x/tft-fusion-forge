import { MongoConfig, TFTData, FusionProject } from "../types";

// Since we are running in a browser environment without a backend proxy in this demo,
// we will simulate the MongoDB interactions. In a real scenario, these would be fetch() calls
// to your backend API which then connects to MongoDB.

const PROJECT_HISTORY_KEY = 'tft_fusion_history';

export const saveToMongo = async (config: MongoConfig, data: TFTData): Promise<boolean> => {
  if (!config.enabled) return false;
  
  console.log(`[MongoDB] Connecting to ${config.connectionString}...`);
  console.log(`[MongoDB] Saving data to ${config.dbName}.${config.collectionName}...`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log(`[MongoDB] Data synced successfully.`);
  return true;
};

export const fetchFromMongo = async (config: MongoConfig): Promise<TFTData | null> => {
  if (!config.enabled) return null;

  console.log(`[MongoDB] Fetching data from ${config.dbName}.${config.collectionName}...`);
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Retrieve mock data from localStorage if we "saved" it there, otherwise return null
  const saved = localStorage.getItem('mock_mongo_data');
  if (saved) {
    return JSON.parse(saved) as TFTData;
  }
  
  return null;
};

// Mock function to simulate saving to "DB" for this demo by using local storage
export const mockSaveData = (data: TFTData) => {
  localStorage.setItem('mock_mongo_data', JSON.stringify(data));
};

// --- Project History Functions ---

export const saveProject = async (config: MongoConfig, project: FusionProject): Promise<boolean> => {
  // In a real app, this sends data to the backend DB
  // For this demo, we save to LocalStorage (acting as DB)
  
  try {
    const existingStr = localStorage.getItem(PROJECT_HISTORY_KEY);
    const existing: FusionProject[] = existingStr ? JSON.parse(existingStr) : [];
    
    // Add new project to the beginning
    const updated = [project, ...existing];
    
    // Limit local storage size to last 20 to prevent quota errors
    const trimmed = updated.slice(0, 20);
    
    localStorage.setItem(PROJECT_HISTORY_KEY, JSON.stringify(trimmed));
    return true;
  } catch (e) {
    console.error("Failed to save project history", e);
    return false;
  }
};

export const getProjects = async (config: MongoConfig): Promise<FusionProject[]> => {
  // In real app: return await fetch('/api/projects').json();
  const existingStr = localStorage.getItem(PROJECT_HISTORY_KEY);
  return existingStr ? JSON.parse(existingStr) : [];
};

export const deleteProject = async (config: MongoConfig, projectId: string): Promise<boolean> => {
  const existingStr = localStorage.getItem(PROJECT_HISTORY_KEY);
  if (!existingStr) return false;
  
  const existing: FusionProject[] = JSON.parse(existingStr);
  const updated = existing.filter(p => p.id !== projectId);
  
  localStorage.setItem(PROJECT_HISTORY_KEY, JSON.stringify(updated));
  return true;
};
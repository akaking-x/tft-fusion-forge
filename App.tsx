import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Champion, TFTData, GenerationState, AppStatus, SocialContent, S3Config, MongoConfig, User, FusionProject } from './types';
import { FUSION_PROMPT } from './constants';
import { searchChampionImage, generateFusionImage, generateViralContent, generateThumbnail, generateDuoImage } from './services/geminiService';
import { initS3, uploadProjectAsset, getS3Config } from './services/s3Service';
import { fetchFromMongo, saveToMongo, mockSaveData, saveProject, getProjects, deleteProject } from './services/mongoService';
import { ChampionCard } from './components/ChampionCard';
import { Button } from './components/Button';
import { Loader } from './components/Loader';
import { LoginScreen } from './components/LoginScreen';
import { UserManagement } from './components/UserManagement';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ProjectGallery } from './components/ProjectGallery';
import { FileUp, RefreshCw, Download, Sparkles, Copy, Check, MousePointerClick, Shuffle, Filter, X, Settings, Database, Server, Key, LogOut, Users, Lock, Users as UsersIcon, LayoutGrid, Zap, ClipboardCopy, AlertTriangle, History, Video, Play, Maximize, Target } from 'lucide-react';

export const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [tftData, setTftData] = useState<TFTData | null>(null);
  const [champions, setChampions] = useState<[Champion, Champion] | null>(null);
  const [sourceImages, setSourceImages] = useState<[string | null, string | null]>([null, null]);
  const [fusionImage, setFusionImage] = useState<string | null>(null);
  const [duoImage, setDuoImage] = useState<string | null>(null); 
  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null);
  const [socialContent, setSocialContent] = useState<SocialContent | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Duplicate Check State
  const [duplicateWarning, setDuplicateWarning] = useState<{ found: boolean; date?: number }>({ found: false });

  // View State
  const [currentView, setCurrentView] = useState<'generator' | 'gallery'>('generator');
  const [projectHistory, setProjectHistory] = useState<FusionProject[]>([]);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<'s3' | 'mongo' | 'users'>('s3');
  
  const [s3Config, setS3Config] = useState<S3Config>({
    endpoint: '',
    region: 'auto',
    bucketName: '',
    accessKeyId: '',
    secretAccessKey: '',
    publicUrlBase: ''
  });

  const [mongoConfig, setMongoConfig] = useState<MongoConfig>({
    connectionString: '',
    dbName: 'tft_forge',
    collectionName: 'set_16',
    enabled: false
  });
  
  // Selection Mode State
  const [selectionMode, setSelectionMode] = useState<'random' | 'manual'>('random');
  const [manualSelection, setManualSelection] = useState<{c1: string, c2: string}>({c1: '', c2: ''});
  
  // Filter State
  const [filters, setFilters] = useState({ origin: '', trait: '', cost: '' });

  // Copy Feedback State
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [imageCopyStatus, setImageCopyStatus] = useState<string | null>(null);

  // Refs for animation
  const rollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialization
  useEffect(() => {
    // Load configs from local storage
    const savedS3 = localStorage.getItem('tft_fusion_s3_config');
    if (savedS3) {
      const parsed = JSON.parse(savedS3);
      setS3Config(parsed);
      initS3(parsed);
    }

    const savedMongo = localStorage.getItem('tft_fusion_mongo_config');
    if (savedMongo) {
      setMongoConfig(JSON.parse(savedMongo));
    }
    
    // Check for cached User Key
    const savedKey = sessionStorage.getItem('user_api_key');
    if (savedKey) {
      setUserApiKey(savedKey);
      setHasApiKey(true);
      (window as any).USER_PROVIDED_KEY = savedKey;
      process.env.API_KEY = savedKey;
    }

    // Check for API Key via AI Studio
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        window.aistudio.hasSelectedApiKey().then(has => {
            if (has) setHasApiKey(true);
        });
    }
    
    // Load History
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const projects = await getProjects(mongoConfig);
    setProjectHistory(projects);
  };

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  // Auth Handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    addLog(`User ${user.username} logged in.`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setTftData(null);
    resetResults();
    setUserApiKey('');
    sessionStorage.removeItem('user_api_key');
    setHasApiKey(false);
  };

  const handleGoogleAuth = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      addLog("Authenticated via Google AI Studio.");
    }
  };

  const handleManualKeySubmit = () => {
      if (userApiKey.trim().length > 0) {
          sessionStorage.setItem('user_api_key', userApiKey);
          (window as any).USER_PROVIDED_KEY = userApiKey;
          process.env.API_KEY = userApiKey;
          setHasApiKey(true);
          addLog("Manual Access Token set.");
      }
  };

  // Settings Handlers
  const saveSettings = () => {
    localStorage.setItem('tft_fusion_s3_config', JSON.stringify(s3Config));
    localStorage.setItem('tft_fusion_mongo_config', JSON.stringify(mongoConfig));
    initS3(s3Config);
    setShowSettings(false);
    addLog("System Configuration saved.");
    
    if (mongoConfig.enabled) {
      addLog("Database Mode Enabled. Please refresh data source.");
      setTftData(null); // Force reload
    }
  };

  // Data Handlers
  const fetchDatabaseData = async () => {
    setStatus(AppStatus.IDLE);
    addLog("Connecting to Database...");
    const data = await fetchFromMongo(mongoConfig);
    if (data) {
      setTftData(data);
      addLog(`Data synced from DB: ${data.set}`);
      setStatus(AppStatus.READY);
    } else {
      addLog("Database fetch failed or empty. Please upload file.");
      alert("Could not fetch from Database. Please upload a local JSON file.");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as TFTData;
        if (!json.champions || !Array.isArray(json.champions)) {
          throw new Error("Invalid JSON structure: missing 'champions' array");
        }
        setTftData(json);
        setChampions(null);
        setManualSelection({c1: '', c2: ''});
        setFilters({ origin: '', trait: '', cost: '' });
        
        addLog(`Loaded local file: ${json.set}.`);
        setStatus(AppStatus.READY);

        // Sync to Mongo if enabled
        if (mongoConfig.enabled) {
          addLog("Syncing new data to MongoDB...");
          mockSaveData(json); // Simulating the save for this demo
          await saveToMongo(mongoConfig, json);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  // Logic from previous implementation
  const filteredChampions = useMemo(() => {
    if (!tftData) return [];
    return tftData.champions.filter(c => {
        const matchOrigin = !filters.origin || c.origin.includes(filters.origin);
        const matchTrait = !filters.trait || c.class.includes(filters.trait);
        const matchCost = !filters.cost || c.cost === parseInt(filters.cost);
        return matchOrigin && matchTrait && matchCost;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [tftData, filters]);

  const uniqueCosts = useMemo(() => {
    if (!tftData) return [];
    return Array.from(new Set(tftData.champions.map(c => Number(c.cost)))).sort((a: number, b: number) => a - b);
  }, [tftData]);

  // Check MongoDB history for duplicates
  const checkDuplicate = (c1: Champion, c2: Champion) => {
     const currentPair = [c1.name, c2.name].sort().join('-');
     const match = projectHistory.find(p => {
        const existingPair = [p.champions[0].name, p.champions[1].name].sort().join('-');
        return existingPair === currentPair;
     });

     if (match) {
        setDuplicateWarning({ found: true, date: match.timestamp });
        addLog(`Notice: This fusion already exists in database (Created: ${new Date(match.timestamp).toLocaleDateString()})`);
     } else {
        setDuplicateWarning({ found: false });
     }
  };

  const handleRandomize = useCallback(() => {
    if (!tftData || !tftData.champions || tftData.champions.length < 2) return;
    
    // Start Rolling Visuals
    setStatus(AppStatus.ROLLING);
    resetResults();
    setCurrentView('generator');
    setDuplicateWarning({ found: false });
    
    const list = tftData.champions;
    let rollCount = 0;
    const maxRolls = 30; // 3 seconds approx at 100ms
    const intervalMs = 100; // Fast and snappy for video recording

    if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current);

    rollingIntervalRef.current = setInterval(() => {
        // Pick random temp champions for visual effect
        const r1 = list[Math.floor(Math.random() * list.length)];
        const r2 = list[Math.floor(Math.random() * list.length)];
        setChampions([r1, r2]);

        rollCount++;
        
        if (rollCount >= maxRolls) {
            // STOP ROLLING and Lock in final result
            if (rollingIntervalRef.current) clearInterval(rollingIntervalRef.current);
            
            // Pick distinct final champions
            let idx1 = Math.floor(Math.random() * list.length);
            let idx2 = Math.floor(Math.random() * list.length);
            while (idx1 === idx2) {
              idx2 = Math.floor(Math.random() * list.length);
            }
            
            const finalC1 = list[idx1];
            const finalC2 = list[idx2];

            setChampions([finalC1, finalC2]);
            checkDuplicate(finalC1, finalC2);
            setManualSelection({ c1: finalC1.name, c2: finalC2.name });
            setStatus(AppStatus.SELECTED);
            addLog(`Randomly Selected: ${finalC1.name} & ${finalC2.name}`);
        }
    }, intervalMs);

  }, [tftData, projectHistory]);

  const handleManualSelect = () => {
    if (!tftData || !manualSelection.c1 || !manualSelection.c2) return;
    const c1 = tftData.champions.find(c => c.name === manualSelection.c1);
    const c2 = tftData.champions.find(c => c.name === manualSelection.c2);
    if (c1 && c2) {
        setChampions([c1, c2]);
        checkDuplicate(c1, c2);
        resetResults();
        setCurrentView('generator');
        addLog(`Manually Selected: ${c1.name} & ${c2.name}`);
        setStatus(AppStatus.SELECTED);
    }
  };

  const resetResults = () => {
    setSourceImages([null, null]);
    setFusionImage(null);
    setDuoImage(null);
    setThumbnailImage(null);
    setSocialContent(null);
    setLogs([]);
    setDuplicateWarning({ found: false });
  };

  const startFusionProcess = async () => {
    if (!champions || !hasApiKey) {
        if (!hasApiKey && !userApiKey) handleGoogleAuth();
        return;
    }

    // Ensure Global Key is set before calling services
    if (userApiKey) {
        (window as any).USER_PROVIDED_KEY = userApiKey;
        process.env.API_KEY = userApiKey;
    }

    setStatus(AppStatus.SEARCHING);
    addLog("Analyzing visuals (checking S3/Grounding)...");

    try {
      const img1Promise = searchChampionImage(champions[0]);
      const img2Promise = searchChampionImage(champions[1]);
      const [res1, res2] = await Promise.all([img1Promise, img2Promise]);

      setSourceImages([res1 || null, res2 || null]);
      addLog("Source visuals acquired.");

      setStatus(AppStatus.GENERATING_FUSION);
      addLog("Initializing Generation Protocol (Gemini 3 Pro)...");

      // Parallel Generation of Assets
      const fusionPromise = generateFusionImage(champions[0], champions[1], res1, res2);
      addLog("Drafting Duo Art, Thumbnail & Viral Copy...");
      const duoPromise = generateDuoImage(champions[0], champions[1], res1, res2);
      const thumbnailPromise = generateThumbnail(champions[0], champions[1], res1, res2);
      const socialPromise = generateViralContent(champions[0], champions[1]);

      const [generatedUrl, duoUrl, thumbUrl, socialData] = await Promise.all([
        fusionPromise, 
        duoPromise,
        thumbnailPromise, 
        socialPromise
      ]);
      
      if (generatedUrl && socialData) {
        setFusionImage(generatedUrl);
        setDuoImage(duoUrl);
        setThumbnailImage(thumbUrl);
        setSocialContent(socialData);
        addLog("All assets generated successfully.");
        setStatus(AppStatus.COMPLETED);

        // --- AUTO SAVE LOGIC ---
        addLog("Archiving project data...");
        const projectId = crypto.randomUUID();
        const timestamp = Date.now();

        // If S3 is connected, upload the generated assets
        let savedFusionUrl = generatedUrl;
        let savedDuoUrl = duoUrl;
        let savedThumbUrl = thumbUrl;

        const s3Conf = getS3Config();
        if (s3Conf && s3Conf.bucketName) {
            addLog("Uploading generated assets to S3...");
            try {
                if (generatedUrl) savedFusionUrl = await uploadProjectAsset(projectId, 'fusion', generatedUrl) || generatedUrl;
                if (duoUrl) savedDuoUrl = await uploadProjectAsset(projectId, 'duo', duoUrl) || duoUrl;
                if (thumbUrl) savedThumbUrl = await uploadProjectAsset(projectId, 'thumbnail', thumbUrl) || thumbUrl;
            } catch (e) {
                console.error("Failed to upload assets", e);
                addLog("Warning: Asset upload failed, saving local reference only.");
            }
        }

        const newProject: FusionProject = {
            id: projectId,
            timestamp,
            champions: champions,
            images: {
                source1: res1 || null,
                source2: res2 || null,
                fusion: savedFusionUrl,
                duo: savedDuoUrl,
                thumbnail: savedThumbUrl
            },
            prompts: socialData
        };

        await saveProject(mongoConfig, newProject);
        await loadHistory();
        addLog("Project archived successfully.");

      } else {
        throw new Error("Generation returned no image.");
      }
    } catch (error: any) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      addLog(`Error: ${errorMsg}`);
      
      if (errorMsg.includes("401") || errorMsg.includes("key") || errorMsg.includes("API Key is missing")) {
        setHasApiKey(false);
        addLog("Invalid or Missing API Key. Please check your credentials.");
      }
      setStatus(AppStatus.ERROR);
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyImage = async (imageUrl: string, id: string) => {
      try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          await navigator.clipboard.write([
              new ClipboardItem({
                  [blob.type]: blob
              })
          ]);
          setImageCopyStatus(id);
          setTimeout(() => setImageCopyStatus(null), 2000);
      } catch (e) {
          console.error("Failed to copy image", e);
          alert("Failed to copy image to clipboard.");
      }
  };

  const handleDownloadImage = async (url: string, filename: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = "_blank";
        link.click();
      }
  };

  const downloadAll = async () => {
    if (!champions || !fusionImage) return;
    if (sourceImages[0]) await handleDownloadImage(sourceImages[0], `${champions[0].name}_source.png`);
    if (sourceImages[1]) await handleDownloadImage(sourceImages[1], `${champions[1].name}_source.png`);
    if (duoImage) await handleDownloadImage(duoImage, `Duo_${champions[0].name}_${champions[1].name}.png`);
    await handleDownloadImage(fusionImage, `Fusion_${champions[0].name}_${champions[1].name}.png`);
    if (thumbnailImage) await handleDownloadImage(thumbnailImage, `Thumbnail_${champions[0].name}_${champions[1].name}.png`);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(mongoConfig, id);
    await loadHistory();
  };

  const ImageActionToolbar = ({ url, id, filename }: { url: string, id: string, filename: string }) => (
      <div className="absolute top-2 right-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button 
            onClick={() => handleCopyImage(url, id)}
            className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all"
            title="Copy Image to Clipboard"
        >
            {imageCopyStatus === id ? <Check className="w-4 h-4 text-green-400"/> : <ClipboardCopy className="w-4 h-4"/>}
        </button>
        <button 
            onClick={() => handleDownloadImage(url, filename)}
            className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm border border-white/20 transition-all"
            title="Download Image"
        >
            <Download className="w-4 h-4"/>
        </button>
      </div>
  );

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Determine if we are rolling
  const isRolling = status === AppStatus.ROLLING;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 pb-32 md:pb-8">
      {/* Change Password Modal */}
      {showChangePassword && currentUser && (
        <ChangePasswordModal 
          user={currentUser} 
          onClose={() => setShowChangePassword(false)} 
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-display font-bold mb-4 text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" /> Configuration
            </h3>

            {/* Tabs */}
            <div className="flex border-b border-slate-700 mb-4 overflow-x-auto">
              <button 
                onClick={() => setActiveTab('s3')}
                className={`flex-1 py-2 text-sm font-medium min-w-20 ${activeTab === 's3' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}
              >
                S3 Cache
              </button>
              <button 
                onClick={() => setActiveTab('mongo')}
                className={`flex-1 py-2 text-sm font-medium min-w-20 ${activeTab === 'mongo' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Database
              </button>
              {currentUser.role === 'admin' && (
                <button 
                  onClick={() => setActiveTab('users')}
                  className={`flex-1 py-2 text-sm font-medium min-w-20 ${activeTab === 'users' ? 'text-amber-500 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  User Management
                </button>
              )}
            </div>

            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
              {activeTab === 's3' && (
                <>
                  <input type="text" placeholder="Endpoint" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s3Config.endpoint} onChange={e => setS3Config({...s3Config, endpoint: e.target.value})} />
                  <input type="text" placeholder="Region" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s3Config.region} onChange={e => setS3Config({...s3Config, region: e.target.value})} />
                  <input type="text" placeholder="Bucket Name" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s3Config.bucketName} onChange={e => setS3Config({...s3Config, bucketName: e.target.value})} />
                  <input type="text" placeholder="Access Key ID" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s3Config.accessKeyId} onChange={e => setS3Config({...s3Config, accessKeyId: e.target.value})} />
                  <input type="password" placeholder="Secret Access Key" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s3Config.secretAccessKey} onChange={e => setS3Config({...s3Config, secretAccessKey: e.target.value})} />
                  <input type="text" placeholder="Public URL Base (Optional CDN)" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={s3Config.publicUrlBase} onChange={e => setS3Config({...s3Config, publicUrlBase: e.target.value})} />
                </>
              )}

              {activeTab === 'mongo' && (
                <>
                   <div className="flex items-center gap-2 mb-2">
                      <input 
                        type="checkbox" 
                        checked={mongoConfig.enabled} 
                        onChange={e => setMongoConfig({...mongoConfig, enabled: e.target.checked})}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-amber-500 focus:ring-amber-500"
                      />
                      <label className="text-sm text-slate-300">Enable Database Sync</label>
                   </div>
                   <input type="text" placeholder="Connection String (mongodb://...)" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={mongoConfig.connectionString} onChange={e => setMongoConfig({...mongoConfig, connectionString: e.target.value})} disabled={!mongoConfig.enabled}/>
                   <input type="text" placeholder="Database Name" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={mongoConfig.dbName} onChange={e => setMongoConfig({...mongoConfig, dbName: e.target.value})} disabled={!mongoConfig.enabled}/>
                   <input type="text" placeholder="Collection Name" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm" value={mongoConfig.collectionName} onChange={e => setMongoConfig({...mongoConfig, collectionName: e.target.value})} disabled={!mongoConfig.enabled}/>
                   <p className="text-xs text-amber-500/80">Note: Without a backend proxy, this UI simulates the connection for demonstration.</p>
                </>
              )}

              {activeTab === 'users' && currentUser.role === 'admin' && (
                <UserManagement />
              )}
            </div>

            <div className="flex gap-2 mt-6 pt-4 border-t border-slate-700">
              <Button fullWidth onClick={saveSettings} icon={<Check className="w-4 h-4"/>}>Save Config</Button>
              <Button fullWidth variant="secondary" onClick={() => setShowSettings(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container with Sticky Sidebar Logic */}
      <div className="max-w-[1800px] mx-auto flex flex-col xl:flex-row gap-6">
        
        {/* === LEFT COLUMN: Controls, Header, Results === */}
        <div className="flex-1 space-y-6 min-w-0">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center border-b border-slate-700 pb-4 gap-4">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-500">
                TFT Fusion Forge
                </h1>
                <p className="text-slate-400 mt-2 flex items-center gap-2 text-sm md:text-base">
                <span className={`w-2 h-2 rounded-full ${currentUser.role === 'admin' ? 'bg-amber-500' : 'bg-green-500'}`}></span>
                Operator: <span className="font-semibold text-slate-200">{currentUser.username}</span> 
                {currentUser.role === 'admin' && <span className="text-xs bg-amber-900/40 text-amber-500 px-1.5 py-0.5 rounded border border-amber-900/50 ml-1">ADMIN</span>}
                </p>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
                <div className="bg-slate-800 rounded-lg p-1 flex">
                    <button 
                    onClick={() => setCurrentView('generator')}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all ${currentView === 'generator' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                    <Zap className="w-3 h-3 md:w-4 md:h-4" /> Generator
                    </button>
                    <button 
                    onClick={() => { setCurrentView('gallery'); loadHistory(); }}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-md text-xs md:text-sm font-medium transition-all ${currentView === 'gallery' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                    <LayoutGrid className="w-3 h-3 md:w-4 md:h-4" /> Gallery
                    </button>
                </div>

                <div className="h-6 w-px bg-slate-700 mx-2 hidden md:block"></div>

                <div className="flex items-center gap-2">
                    <button onClick={() => setShowChangePassword(true)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition-colors" title="Change Password">
                        <Lock className="w-4 h-4 md:w-5 md:h-5" />
                    </button>

                    <button onClick={() => { setShowSettings(true); setActiveTab('s3'); }} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 transition-colors" title="Settings">
                        <Settings className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    
                    <button onClick={handleLogout} className="p-2 bg-slate-800 hover:bg-red-900/30 rounded-lg border border-slate-700 hover:border-red-800 text-slate-300 hover:text-red-400 transition-colors" title="Logout">
                        <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                </div>
            </div>
            </header>

            {/* API Key Input Section */}
            {!hasApiKey && (
            <div className="bg-amber-900/20 border border-amber-600/30 p-4 rounded-xl flex flex-col md:flex-row items-center gap-4 justify-between animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                <Key className="w-6 h-6 text-amber-500" />
                <div>
                    <h3 className="text-sm font-bold text-amber-200">API Access Required</h3>
                    <p className="text-xs text-amber-200/60">Provide Vertex AI Token or Gemini API Key.</p>
                </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
                   <div className="relative w-full md:w-64">
                      <input 
                        type="password" 
                        placeholder="gcloud auth print-access-token"
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                        className="w-full bg-slate-900 border border-amber-500/30 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-600 font-mono"
                      />
                   </div>
                   <Button onClick={handleManualKeySubmit} size="sm" disabled={!userApiKey}>Connect</Button>
                   <span className="text-xs text-slate-500 px-2">OR</span>
                   <Button onClick={handleGoogleAuth} size="sm" variant="secondary">
                     AI Studio
                   </Button>
                </div>
            </div>
            )}

            {/* Main Content Router */}
            {currentView === 'gallery' ? (
                <ProjectGallery projects={projectHistory} onDelete={handleDeleteProject} />
            ) : (
                <main className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${!hasApiKey ? 'opacity-50 pointer-events-none filter blur-sm transition-all' : ''}`}>
                    
                    {/* Controls Panel */}
                    <section className="lg:col-span-4 space-y-6">
                        {/* 1. Data Source */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 shadow-xl backdrop-blur-sm">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <span className="bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Data Source
                            </h2>
                            
                            {!tftData ? (
                            <>
                                {mongoConfig.enabled ? (
                                <div className="text-center space-y-4 py-4">
                                    <div className="mx-auto w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center border border-slate-600">
                                    <Server className="w-6 h-6 text-green-400" />
                                    </div>
                                    <p className="text-sm text-slate-300">Database Connection Active</p>
                                    <Button onClick={fetchDatabaseData} fullWidth variant="primary" icon={<Database className="w-4 h-4"/>}>
                                    Sync from {mongoConfig.dbName}
                                    </Button>
                                    <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-700"></span></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-800/80 px-2 text-slate-500">Or fallback to local</span></div>
                                    </div>
                                    <label className="block text-center text-xs text-slate-400 hover:text-white cursor-pointer transition-colors">
                                    <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
                                    Upload JSON File manually
                                    </label>
                                </div>
                                ) : (
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FileUp className="w-8 h-8 mb-3 text-slate-400" />
                                    <p className="text-sm text-slate-400">Upload <span className="font-semibold">application.json</span></p>
                                    </div>
                                    <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
                                </label>
                                )}
                            </>
                            ) : (
                            <div className="flex items-center justify-between bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                                <div className="flex items-center gap-2">
                                    {mongoConfig.enabled ? <Database className="w-3 h-3 text-green-400"/> : <FileUp className="w-3 h-3 text-amber-400"/>}
                                    <span className="text-sm truncate">{tftData.set}</span>
                                </div>
                                <button onClick={() => setTftData(null)} className="text-xs text-red-400 hover:text-red-300">Change</button>
                            </div>
                            )}
                        </div>

                        {/* 2. Selection */}
                        {tftData && (
                            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 shadow-xl backdrop-blur-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold flex items-center gap-2">
                                <span className="bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                Selection
                                </h2>
                                
                                <div className="flex bg-slate-900 rounded-lg p-1 text-xs">
                                <button 
                                    onClick={() => setSelectionMode('random')}
                                    className={`px-3 py-1 rounded-md transition-all ${selectionMode === 'random' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Random
                                </button>
                                <button 
                                    onClick={() => setSelectionMode('manual')}
                                    className={`px-3 py-1 rounded-md transition-all ${selectionMode === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                >
                                    Manual
                                </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {selectionMode === 'random' ? (
                                <div className="hidden lg:block"> 
                                    <Button 
                                        onClick={handleRandomize} 
                                        fullWidth 
                                        variant="secondary"
                                        icon={<Shuffle className={`w-4 h-4 ${status === AppStatus.SEARCHING || status === AppStatus.GENERATING_FUSION || status === AppStatus.GENERATING_THUMBNAIL || status === AppStatus.ROLLING ? 'animate-spin' : ''}`} />}
                                        disabled={status === AppStatus.SEARCHING || status === AppStatus.GENERATING_FUSION || status === AppStatus.GENERATING_THUMBNAIL || status === AppStatus.ROLLING}
                                    >
                                        {status === AppStatus.ROLLING ? 'Rolling...' : 'Randomize Champions'}
                                    </Button>
                                </div>
                                ) : (
                                <div className="space-y-3">
                                    <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-700/50 mb-3 space-y-2">
                                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                                        <div className="flex items-center gap-1"><Filter className="w-3 h-3" /> Filters</div>
                                        {(filters.origin || filters.trait || filters.cost) && (
                                            <button 
                                            onClick={() => setFilters({ origin: '', trait: '', cost: '' })}
                                            className="flex items-center gap-1 text-red-400 hover:text-red-300"
                                            >
                                            <X className="w-3 h-3" /> Clear
                                            </button>
                                        )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                        <select 
                                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-amber-500"
                                            value={filters.origin}
                                            onChange={(e) => setFilters(prev => ({...prev, origin: e.target.value}))}
                                        >
                                            <option value="">Origin</option>
                                            {tftData.traits.origins.map(o => (
                                            <option key={o} value={o}>{o}</option>
                                            ))}
                                        </select>
                                        
                                        <select 
                                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-amber-500"
                                            value={filters.trait}
                                            onChange={(e) => setFilters(prev => ({...prev, trait: e.target.value}))}
                                        >
                                            <option value="">Class</option>
                                            {tftData.traits.classes.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>

                                        <select 
                                            className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-300 outline-none focus:border-amber-500"
                                            value={filters.cost}
                                            onChange={(e) => setFilters(prev => ({...prev, cost: e.target.value}))}
                                        >
                                            <option value="">Cost</option>
                                            {uniqueCosts.map(c => (
                                            <option key={c} value={c}>{c} Gold</option>
                                            ))}
                                        </select>
                                        </div>
                                    </div>

                                    <div>
                                    <label className="text-xs text-slate-400 block mb-1">Champion 1</label>
                                    <select 
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none disabled:opacity-50"
                                        value={manualSelection.c1}
                                        onChange={(e) => setManualSelection(prev => ({...prev, c1: e.target.value}))}
                                        disabled={status === AppStatus.SEARCHING || status === AppStatus.GENERATING_FUSION}
                                    >
                                        <option value="">Select Champion...</option>
                                        {filteredChampions.map(c => (
                                        <option key={`c1-${c.name}`} value={c.name}>{c.name} ({c.cost}g)</option>
                                        ))}
                                    </select>
                                    </div>
                                    <div>
                                    <label className="text-xs text-slate-400 block mb-1">Champion 2</label>
                                    <select 
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none disabled:opacity-50"
                                        value={manualSelection.c2}
                                        onChange={(e) => setManualSelection(prev => ({...prev, c2: e.target.value}))}
                                        disabled={status === AppStatus.SEARCHING || status === AppStatus.GENERATING_FUSION}
                                    >
                                        <option value="">Select Champion...</option>
                                        {filteredChampions.map(c => (
                                        <option key={`c2-${c.name}`} value={c.name}>{c.name} ({c.cost}g)</option>
                                        ))}
                                    </select>
                                    </div>
                                    <Button 
                                        onClick={handleManualSelect} 
                                        fullWidth 
                                        variant="secondary"
                                        icon={<MousePointerClick className="w-4 h-4" />}
                                        disabled={!manualSelection.c1 || !manualSelection.c2 || status === AppStatus.SEARCHING || status === AppStatus.GENERATING_FUSION}
                                    >
                                        Confirm Selection
                                    </Button>
                                </div>
                                )}
                            </div>
                            </div>
                        )}

                        {/* Process Log */}
                        <div className="bg-black/40 p-4 rounded-xl border border-slate-800 h-48 overflow-y-auto font-mono text-xs text-slate-400">
                            {logs.length === 0 && <span className="opacity-50">System ready. Waiting for input...</span>}
                            {logs.map((log, i) => (
                            <div key={i} className="mb-1 border-l-2 border-slate-600 pl-2">
                                <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span> {log}
                            </div>
                            ))}
                            {(status === AppStatus.SEARCHING || status === AppStatus.GENERATING_FUSION || status === AppStatus.GENERATING_THUMBNAIL) && (
                            <div className="animate-pulse text-amber-500 mt-2">Processing...</div>
                            )}
                        </div>

                        {/* Viral Kit */}
                        {socialContent && status === AppStatus.COMPLETED && (
                            <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/30 p-6 rounded-xl border border-purple-500/30 shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-purple-200">
                                <Sparkles className="w-5 h-5 text-purple-400" />
                                Viral Social Media Kit
                            </h2>

                            <div className="space-y-4">
                                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Visual Hook</span>
                                    <button onClick={() => copyToClipboard(socialContent.actionDescription, 'desc')} className="text-slate-400 hover:text-white transition-colors">
                                    {copiedField === 'desc' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-300 italic">"{socialContent.actionDescription}"</p>
                                </div>

                                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase">TikTok Caption (US)</span>
                                    <button onClick={() => copyToClipboard(socialContent.tiktokCaption, 'caption')} className="text-slate-400 hover:text-white transition-colors">
                                    {copiedField === 'caption' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-300 whitespace-pre-wrap font-sans">{socialContent.tiktokCaption}</p>
                                </div>

                                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/50">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase">First Comment</span>
                                    <button onClick={() => copyToClipboard(socialContent.firstComment, 'comment')} className="text-slate-400 hover:text-white transition-colors">
                                    {copiedField === 'comment' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                </div>
                                <p className="text-xs text-slate-300 font-medium">"{socialContent.firstComment}"</p>
                                </div>
                            </div>
                            </div>
                        )}
                    </section>

                    {/* Results Display Panel */}
                    <section className="lg:col-span-8 flex flex-col gap-4 md:gap-6">
                        
                        {/* Duplicate Warning Banner */}
                        {duplicateWarning.found && status === AppStatus.SELECTED && (
                            <div className="bg-amber-900/40 border border-amber-600/50 rounded-lg p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 mx-2 md:mx-0">
                                <div className="bg-amber-900/50 p-2 rounded-full">
                                <History className="w-5 h-5 text-amber-500" />
                                </div>
                                <div className="flex-1">
                                <h4 className="text-sm font-bold text-amber-200">Fusion Already Exists</h4>
                                <p className="text-xs text-amber-200/70">
                                    These two champions were previously fused on {duplicateWarning.date ? new Date(duplicateWarning.date).toLocaleDateString() : 'Unknown Date'}.
                                    You can generate again, but it may consume API quota.
                                </p>
                                </div>
                            </div>
                        )}

                        {/* Action Bar - Desktop */}
                        {champions && status !== AppStatus.SEARCHING && !status.startsWith('GENERATING') && status !== AppStatus.COMPLETED && status !== AppStatus.ROLLING && (
                            <div className="hidden lg:flex justify-center py-4">
                            <Button 
                                onClick={startFusionProcess} 
                                size="lg" 
                                variant="accent"
                                icon={<Sparkles className="w-5 h-5" />}
                                disabled={!hasApiKey}
                            >
                                {hasApiKey ? "Initiate Fusion Protocol" : "Select API Key to Fuse"}
                            </Button>
                            </div>
                        )}

                        {/* Result Display Grid */}
                        {(status.startsWith('GENERATING') || status === AppStatus.COMPLETED) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            
                            {/* 1. Duo Image (9:16) */}
                            <div className="group relative min-h-[500px] bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-2">
                                {(status.startsWith('GENERATING')) && !duoImage && (
                                    <div className="text-center space-y-4 z-10">
                                    <Loader />
                                    <p className="text-blue-400 font-display animate-pulse text-sm tracking-widest">ASSEMBLING DUO</p>
                                    </div>
                                )}

                                {duoImage && (
                                    <div className="w-full h-full flex flex-col items-center">
                                        <div className="relative flex-grow flex items-center justify-center bg-black rounded-lg w-full mb-2 overflow-hidden">
                                        <img 
                                            src={duoImage} 
                                            alt="Duo Result" 
                                            className="max-h-[600px] w-auto h-auto object-contain rounded-lg shadow-2xl border border-blue-500/20" 
                                        />
                                        <div className="absolute top-2 left-2 bg-blue-600/80 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                            Duo Mode
                                        </div>
                                        <ImageActionToolbar 
                                            url={duoImage} 
                                            id="duo" 
                                            filename={`Duo_${champions?.[0].name}_${champions?.[1].name}.png`} 
                                        />
                                        </div>
                                        {socialContent && (
                                        <div className="w-full bg-slate-900/80 p-3 rounded border border-slate-700 text-xs text-slate-300 italic text-center">
                                            {socialContent.duoImagePrompt}
                                        </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 2. Main Fusion (9:16) */}
                            <div className="group relative min-h-[500px] bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-amber-500/30 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-2">
                                {(status.startsWith('GENERATING')) && (
                                    <div className="text-center space-y-4 z-10">
                                    <Loader />
                                    <p className="text-amber-400 font-display animate-pulse text-lg tracking-widest">FORGING ENTITY</p>
                                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                                        Rendering 2K Fusion Concept...
                                    </p>
                                    </div>
                                )}

                                {fusionImage && (
                                    <div className="w-full h-full flex flex-col items-center">
                                        <div className="relative flex-grow flex items-center justify-center bg-black rounded-lg w-full mb-2 overflow-hidden">
                                        <img 
                                            src={fusionImage} 
                                            alt="Fusion Result" 
                                            className="max-h-[600px] w-auto h-auto object-contain rounded-lg shadow-2xl border border-amber-500/40" 
                                        />
                                        <div className="absolute top-2 left-2 bg-amber-600/80 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                            Fusion Mode
                                        </div>
                                        <ImageActionToolbar 
                                            url={fusionImage} 
                                            id="fusion" 
                                            filename={`Fusion_${champions?.[0].name}_${champions?.[1].name}.png`} 
                                        />
                                        </div>
                                        {socialContent && (
                                        <div className="w-full bg-slate-900/80 p-3 rounded border border-slate-700 text-xs text-amber-200/80 italic text-center">
                                            {socialContent.fusionImagePrompt}
                                        </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 3. Thumbnail (3:4) */}
                            <div className="group relative min-h-[500px] bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col items-center justify-center p-2">
                                {(status.startsWith('GENERATING')) && !thumbnailImage && (
                                    <div className="text-center space-y-4 z-10">
                                    <p className="text-purple-400 font-display animate-pulse text-sm tracking-widest">DESIGNING THUMBNAIL</p>
                                    </div>
                                )}

                                {thumbnailImage && (
                                    <div className="w-full h-full flex flex-col items-center">
                                        <div className="relative flex-grow flex items-center justify-center bg-black rounded-lg w-full overflow-hidden">
                                        <img 
                                            src={thumbnailImage} 
                                            alt="Thumbnail Result" 
                                            className="max-h-[600px] w-auto h-auto object-contain rounded-lg shadow-2xl border border-purple-500/20" 
                                        />
                                        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold">
                                            THUMBNAIL PREVIEW
                                        </div>
                                        <ImageActionToolbar 
                                            url={thumbnailImage} 
                                            id="thumbnail" 
                                            filename={`Thumbnail_${champions?.[0].name}_${champions?.[1].name}.png`} 
                                        />
                                        </div>
                                    </div>
                                )}
                            </div>

                            </div>
                        )}

                        {/* Download Actions */}
                        {status === AppStatus.COMPLETED && (
                            <div className="flex justify-center gap-4 py-4 animate-in fade-in slide-in-from-bottom-4">
                                <Button onClick={downloadAll} variant="primary" size="lg" icon={<Download className="w-5 h-5" />}>
                                Download All Assets
                                </Button>
                                <Button onClick={selectionMode === 'manual' ? handleManualSelect : handleRandomize} variant="secondary" size="lg" icon={<RefreshCw className="w-5 h-5" />}>
                                    {selectionMode === 'manual' ? 'Re-Fuse' : 'New Fusion'}
                                </Button>
                            </div>
                        )}
                    </section>
                </main>
            )}
        </div>

        {/* === RIGHT COLUMN: Studio Recording Frame (Persistent) === */}
        {/* Hidden on mobile default, visible on xl screens or if user explicitly wants studio mode */}
        <aside className="w-full xl:w-[450px] flex-shrink-0 flex flex-col items-center">
             <div className="sticky top-4 w-full">
                <div className="bg-slate-900 border-4 border-amber-500/30 rounded-xl overflow-hidden shadow-2xl relative">
                    <div className="aspect-[9/16] w-full relative bg-slate-950 flex flex-col">
                        
                        {/* Header Branding */}
                        <div className="absolute top-6 w-full text-center z-20">
                            <h2 className="font-display text-2xl font-bold text-amber-500 drop-shadow-md tracking-wider">TFT FUSION FORGE</h2>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col p-4 gap-4 justify-center">
                            {champions ? (
                                <>
                                    {/* Top Card */}
                                    <div className="flex-1 overflow-hidden rounded-xl border-2 border-slate-700 relative shadow-lg">
                                        <ChampionCard 
                                            champion={champions[0]} 
                                            imageUrl={sourceImages[0]} 
                                            loading={status === AppStatus.SEARCHING} 
                                            isRolling={isRolling} 
                                        />
                                    </div>
                                    
                                    <div className="flex items-center justify-center -my-3 z-10 relative">
                                        <div className="bg-amber-500 text-black font-bold rounded-full w-12 h-12 flex items-center justify-center border-4 border-slate-900 shadow-xl text-lg">
                                            VS
                                        </div>
                                    </div>

                                    {/* Bottom Card */}
                                    <div className="flex-1 overflow-hidden rounded-xl border-2 border-slate-700 relative shadow-lg">
                                        <ChampionCard 
                                            champion={champions[1]} 
                                            imageUrl={sourceImages[1]} 
                                            loading={status === AppStatus.SEARCHING} 
                                            isRolling={isRolling} 
                                        />
                                    </div>
                                </>
                            ) : (
                                // Empty State for Recording Frame
                                <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-600">
                                    <Target className="w-16 h-16 opacity-20" />
                                    <p className="text-sm font-medium uppercase tracking-widest opacity-50">Ready to Roll</p>
                                </div>
                            )}
                        </div>

                        {/* Bottom Status Indicator */}
                        <div className="absolute bottom-6 w-full text-center z-20 pointer-events-none">
                            {isRolling ? (
                                <div className="inline-flex items-center gap-2 bg-black/60 backdrop-blur px-4 py-1.5 rounded-full border border-amber-500/30 animate-pulse">
                                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                    <span className="text-[10px] uppercase font-bold text-amber-100">Rolling...</span>
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-2 opacity-50">
                                    <span className="text-[10px] uppercase font-bold text-slate-600 tracking-[0.2em]">Studio Frame</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recording Helper Text (Outside the 9:16 frame visual, but in container) */}
                    <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
                        <div className="bg-black/80 text-xs text-white px-2 py-1 rounded">REC Area</div>
                    </div>
                </div>
                
                <p className="text-center text-xs text-slate-500 mt-3 flex items-center justify-center gap-2">
                    <Video className="w-3 h-3" /> 
                    <span>Capture this frame for TikTok/Shorts (9:16)</span>
                </p>
             </div>
        </aside>

      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 border-t border-slate-800 backdrop-blur-lg lg:hidden z-40 pb-safe">
         {tftData && selectionMode === 'random' && status !== AppStatus.COMPLETED && !status.startsWith('GENERATING') && (
            <>
              {status === AppStatus.SELECTED ? (
                <div className="flex gap-3">
                   <Button 
                      onClick={handleRandomize} 
                      variant="secondary"
                      size="lg"
                      className="flex-1 shadow-lg"
                      icon={<Shuffle className="w-5 h-5" />}
                   >
                     Re-roll
                   </Button>
                   <Button 
                      onClick={startFusionProcess} 
                      fullWidth 
                      size="lg"
                      variant="accent"
                      className="flex-[2] shadow-xl"
                      icon={<Sparkles className="w-5 h-5"/>}
                      disabled={!hasApiKey}
                   >
                     Initiate Fusion
                   </Button>
                </div>
              ) : (
                <Button 
                    onClick={handleRandomize} 
                    fullWidth 
                    size="lg"
                    variant="secondary"
                    className="shadow-xl"
                    icon={<Shuffle className={`w-5 h-5 ${status === AppStatus.ROLLING ? 'animate-spin' : ''}`} />}
                    disabled={status === AppStatus.ROLLING}
                >
                  {status === AppStatus.ROLLING ? 'Rolling...' : 'Randomize Champions'}
                </Button>
              )}
            </>
         )}
         {status === AppStatus.COMPLETED && (
            <Button onClick={handleRandomize} fullWidth variant="primary" size="lg" icon={<RefreshCw className="w-5 h-5"/>}>
              New Fusion
            </Button>
         )}
      </div>
    </div>
  );
};
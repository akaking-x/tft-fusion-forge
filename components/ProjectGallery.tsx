import React, { useState } from 'react';
import { FusionProject } from '../types';
import { Calendar, Trash2, X, Download, Copy, Sparkles, Image as ImageIcon, ClipboardCopy, Check } from 'lucide-react';
import { Button } from './Button';

interface ProjectGalleryProps {
  projects: FusionProject[];
  onDelete: (id: string) => void;
}

export const ProjectGallery: React.FC<ProjectGalleryProps> = ({ projects, onDelete }) => {
  const [selectedProject, setSelectedProject] = useState<FusionProject | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const handleCopyImage = async (imageUrl: string, id: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopyStatus(id);
      setTimeout(() => setCopyStatus(null), 2000);
    } catch (e) {
      console.error("Failed to copy image", e);
      alert("Failed to copy image to clipboard.");
    }
  };

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500 bg-slate-800/30 rounded-xl border border-slate-700/50">
        <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
        <p>No fusion history found.</p>
        <p className="text-xs">Generate some fusions to see them here!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {projects.map((p) => (
          <div 
            key={p.id} 
            onClick={() => setSelectedProject(p)}
            className="group bg-slate-800 rounded-xl border border-slate-700 overflow-hidden cursor-pointer hover:border-amber-500/50 hover:shadow-lg transition-all"
          >
            {/* Thumbnail Preview */}
            <div className="aspect-[3/4] relative bg-slate-900 overflow-hidden">
               {p.images.fusion ? (
                 <img src={p.images.fusion} alt="Fusion" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
               ) : (
                 <div className="w-full h-full flex items-center justify-center text-slate-600">No Image</div>
               )}
               <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
               <div className="absolute bottom-3 left-3">
                 <h4 className="font-display font-bold text-white text-lg leading-tight">
                    {p.champions[0].name} <span className="text-amber-500">&</span> {p.champions[1].name}
                 </h4>
                 <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                   <Calendar className="w-3 h-3" />
                   {new Date(p.timestamp).toLocaleDateString()}
                 </div>
               </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
           <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
              
              {/* Header */}
              <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
                 <div>
                    <h2 className="text-2xl font-display font-bold text-white">
                      {selectedProject.champions[0].name} <span className="text-amber-500">+</span> {selectedProject.champions[1].name}
                    </h2>
                    <p className="text-slate-400 text-sm flex items-center gap-2">
                       ID: {selectedProject.id.slice(0, 8)} • Created: {new Date(selectedProject.timestamp).toLocaleString()}
                    </p>
                 </div>
                 <div className="flex items-center gap-2">
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                         if(confirm("Delete this project permanently?")) {
                            onDelete(selectedProject.id);
                            setSelectedProject(null);
                         }
                      }}
                      className="!text-red-400 hover:!bg-red-900/20 hover:!border-red-900"
                      icon={<Trash2 className="w-4 h-4"/>}
                    >
                      Delete
                    </Button>
                    <button onClick={() => setSelectedProject(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                       <X className="w-6 h-6" />
                    </button>
                 </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Images Column */}
                    <div className="lg:col-span-1 space-y-6">
                       {/* Main Fusion */}
                       <div className="space-y-2">
                          <label className="text-xs font-bold text-amber-500 uppercase tracking-wider">Fusion Result</label>
                          <div className="rounded-xl overflow-hidden border border-amber-500/20 shadow-lg bg-black relative group">
                             {selectedProject.images.fusion && (
                                <>
                                  <img src={selectedProject.images.fusion} alt="Fusion" className="w-full h-auto" />
                                  <button 
                                      onClick={() => handleCopyImage(selectedProject.images.fusion!, 'fusion')}
                                      className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Copy to Clipboard"
                                  >
                                      {copyStatus === 'fusion' ? <Check className="w-4 h-4 text-green-400"/> : <ClipboardCopy className="w-4 h-4"/>}
                                  </button>
                                </>
                             )}
                          </div>
                          <a href={selectedProject.images.fusion || '#'} download={`Fusion_${selectedProject.id}.png`} className="block w-full">
                             <Button fullWidth size="sm" variant="secondary" icon={<Download className="w-3 h-3"/>}>Download Fusion</Button>
                          </a>
                       </div>

                       {/* Duo & Thumbnail Grid */}
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                             <label className="text-xs font-bold text-blue-400 uppercase tracking-wider">Duo Mode</label>
                             <div className="rounded-lg overflow-hidden border border-slate-700 bg-black aspect-[9/16] relative group">
                                {selectedProject.images.duo ? (
                                   <>
                                     <img src={selectedProject.images.duo} alt="Duo" className="w-full h-full object-cover" />
                                     <button 
                                          onClick={() => handleCopyImage(selectedProject.images.duo!, 'duo')}
                                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md backdrop-blur-sm border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="Copy"
                                      >
                                          {copyStatus === 'duo' ? <Check className="w-3 h-3 text-green-400"/> : <ClipboardCopy className="w-3 h-3"/>}
                                      </button>
                                   </>
                                ) : <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">N/A</div>}
                             </div>
                             {selectedProject.images.duo && (
                                <a href={selectedProject.images.duo} download={`Duo_${selectedProject.id}.png`}>
                                   <Button fullWidth size="sm" variant="secondary" className="text-xs">Download</Button>
                                </a>
                             )}
                          </div>
                          <div className="space-y-2">
                             <label className="text-xs font-bold text-purple-400 uppercase tracking-wider">Thumbnail</label>
                             <div className="rounded-lg overflow-hidden border border-slate-700 bg-black aspect-[3/4] relative group">
                                {selectedProject.images.thumbnail ? (
                                   <>
                                     <img src={selectedProject.images.thumbnail} alt="Thumb" className="w-full h-full object-cover" />
                                     <button 
                                          onClick={() => handleCopyImage(selectedProject.images.thumbnail!, 'thumb')}
                                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md backdrop-blur-sm border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                          title="Copy"
                                      >
                                          {copyStatus === 'thumb' ? <Check className="w-3 h-3 text-green-400"/> : <ClipboardCopy className="w-3 h-3"/>}
                                      </button>
                                   </>
                                ) : <div className="w-full h-full flex items-center justify-center text-xs text-slate-600">N/A</div>}
                             </div>
                             {selectedProject.images.thumbnail && (
                                <a href={selectedProject.images.thumbnail} download={`Thumb_${selectedProject.id}.png`}>
                                   <Button fullWidth size="sm" variant="secondary" className="text-xs">Download</Button>
                                </a>
                             )}
                          </div>
                       </div>
                    </div>

                    {/* Prompts & Metadata Column */}
                    <div className="lg:col-span-2 space-y-6">
                       
                       <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                             <Sparkles className="w-5 h-5 text-amber-500" /> Generation Prompts
                          </h3>
                          
                          <div className="space-y-4">
                             <div>
                                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Fusion Action Prompt</span>
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-300 text-sm italic">
                                   "{selectedProject.prompts.fusionImagePrompt}"
                                </div>
                             </div>
                             <div>
                                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Duo Action Prompt</span>
                                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-300 text-sm italic">
                                   "{selectedProject.prompts.duoImagePrompt}"
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-6 rounded-xl border border-purple-500/20">
                          <h3 className="text-lg font-bold text-white mb-4">Social Metadata</h3>
                          
                          <div className="space-y-4">
                             <div>
                                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Action Description</span>
                                <p className="text-slate-300 text-sm">{selectedProject.prompts.actionDescription}</p>
                             </div>
                             <div>
                                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">First Comment Strategy</span>
                                <p className="text-slate-300 text-sm bg-slate-900/50 p-2 rounded">{selectedProject.prompts.firstComment}</p>
                             </div>
                             <div>
                                <span className="text-xs font-bold text-slate-400 uppercase block mb-1">TikTok Caption</span>
                                <p className="text-slate-300 text-xs font-mono whitespace-pre-wrap bg-slate-900/50 p-2 rounded">{selectedProject.prompts.tiktokCaption}</p>
                             </div>
                          </div>
                       </div>

                       <div className="flex gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                           <div className="flex-1">
                              <span className="text-xs font-bold text-slate-500 uppercase block">Source 1</span>
                              <p className="font-bold text-slate-200">{selectedProject.champions[0].name}</p>
                              <p className="text-xs text-slate-400">{selectedProject.champions[0].skin}</p>
                           </div>
                           <div className="flex-1 border-l border-slate-700 pl-4">
                              <span className="text-xs font-bold text-slate-500 uppercase block">Source 2</span>
                              <p className="font-bold text-slate-200">{selectedProject.champions[1].name}</p>
                              <p className="text-xs text-slate-400">{selectedProject.champions[1].skin}</p>
                           </div>
                       </div>

                    </div>
                 </div>
              </div>

           </div>
        </div>
      )}
    </div>
  );
};
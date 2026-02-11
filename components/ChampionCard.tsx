import React from 'react';
import { Champion } from '../types';
import { Loader, Sparkles, HelpCircle } from 'lucide-react';

interface ChampionCardProps {
  champion: Champion;
  imageUrl: string | null;
  loading: boolean;
  isRolling?: boolean;
}

export const ChampionCard: React.FC<ChampionCardProps> = ({ champion, imageUrl, loading, isRolling = false }) => {
  
  // Rarity Colors based on Cost
  const getRarityColor = (cost: number) => {
    switch(cost) {
      case 1: return { border: 'border-slate-500', bg: 'bg-slate-900', glow: 'shadow-slate-500/20', text: 'text-slate-400' }; // Common
      case 2: return { border: 'border-emerald-500', bg: 'bg-emerald-950', glow: 'shadow-emerald-500/40', text: 'text-emerald-400' }; // Uncommon
      case 3: return { border: 'border-blue-500', bg: 'bg-blue-950', glow: 'shadow-blue-500/40', text: 'text-blue-400' }; // Rare
      case 4: return { border: 'border-purple-500', bg: 'bg-purple-950', glow: 'shadow-purple-500/50', text: 'text-purple-400' }; // Epic
      case 5: return { border: 'border-amber-400', bg: 'bg-amber-950', glow: 'shadow-amber-500/60', text: 'text-amber-300' }; // Legendary
      case 6: return { border: 'border-red-500', bg: 'bg-red-950', glow: 'shadow-red-500/50', text: 'text-red-400' }; // Special
      default: return { border: 'border-slate-700', bg: 'bg-slate-800', glow: 'shadow-none', text: 'text-slate-400' };
    }
  };

  const rarity = getRarityColor(champion.cost);

  return (
    <div className={`
      relative rounded-xl overflow-hidden border-2 transition-all duration-300
      ${isRolling ? 'border-amber-500/50 scale-[0.98] animate-pulse' : `${rarity.border} ${rarity.glow} shadow-xl hover:scale-[1.02]`}
      ${loading ? 'opacity-80' : 'opacity-100'}
    `}>
      
      {/* Rarity Flash Overlay on Stop */}
      {!isRolling && !loading && (
        <div className="absolute inset-0 bg-white/10 z-20 animate-ping opacity-0" style={{ animationDuration: '0.5s', animationIterationCount: 1 }} />
      )}

      {/* Cost Badge */}
      <div className="absolute top-2 right-2 z-10">
        <div className={`
          backdrop-blur-md border px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1
          ${isRolling ? 'bg-slate-800/80 border-slate-600 text-slate-300' : `${rarity.bg}/90 ${rarity.border} ${rarity.text}`}
        `}>
          {isRolling ? <Sparkles className="w-3 h-3 animate-spin" /> : <span>{champion.cost} Gold</span>}
        </div>
      </div>

      {/* Image Area */}
      <div className="h-56 md:h-72 bg-slate-900 w-full relative overflow-hidden">
        {isRolling ? (
          // Gacha Rolling State
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden">
             {/* Fast moving background lines */}
             <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] animate-[pulse_0.1s_infinite]"></div>
             <Sparkles className="w-16 h-16 text-amber-500/50 animate-spin duration-700 mb-2" />
             <span className="text-amber-500/80 font-display font-bold text-xl tracking-widest animate-pulse">ROLLING</span>
          </div>
        ) : loading ? (
          // Loading State
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader className="animate-spin w-8 h-8 text-amber-500" />
            <span className="text-xs tracking-wide">Retrieving Visuals...</span>
          </div>
        ) : imageUrl ? (
          // Result State
          <div className="relative w-full h-full group">
            <img 
              src={imageUrl} 
              alt={champion.name} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${champion.name}&background=1e293b&color=cbd5e1&size=256`;
              }}
            />
            {/* Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-90"></div>
          </div>
        ) : (
          // Placeholder State (Selected but no image yet)
          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-700 relative overflow-hidden">
             <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-700/20 via-slate-900 to-slate-900"></div>
             <HelpCircle className="w-24 h-24 opacity-10" />
          </div>
        )}
      </div>

      {/* Info Area */}
      <div className="p-5 relative -mt-16 z-10">
        <div className={`
          inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest mb-1 border
          ${isRolling ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-black/60 text-white/80 border-white/10 backdrop-blur-sm'}
        `}>
          {isRolling ? '???' : champion.skin}
        </div>
        
        <h3 className={`
          text-3xl font-display font-bold mb-3 drop-shadow-md
          ${isRolling ? 'text-slate-600 blur-sm' : 'text-white'}
        `}>
          {champion.name}
        </h3>
        
        <div className="flex flex-wrap gap-2">
          {champion.origin.map(o => (
            <span key={o} className={`
              px-2 py-1 rounded text-[10px] uppercase tracking-wide font-semibold border
              ${isRolling ? 'bg-slate-800 border-slate-700 text-slate-600' : 'bg-blue-950/60 border-blue-500/30 text-blue-200'}
            `}>
              {o}
            </span>
          ))}
          {champion.class.map(c => (
            <span key={c} className={`
              px-2 py-1 rounded text-[10px] uppercase tracking-wide font-semibold border
              ${isRolling ? 'bg-slate-800 border-slate-700 text-slate-600' : 'bg-purple-950/60 border-purple-500/30 text-purple-200'}
            `}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
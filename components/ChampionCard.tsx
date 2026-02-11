import React from 'react';
import { Champion } from '../types';
import { Loader } from 'lucide-react';

interface ChampionCardProps {
  champion: Champion;
  imageUrl: string | null;
  loading: boolean;
}

export const ChampionCard: React.FC<ChampionCardProps> = ({ champion, imageUrl, loading }) => {
  return (
    <div className="relative bg-slate-800 rounded-lg overflow-hidden border border-slate-700 shadow-lg group hover:border-amber-500/50 transition-all duration-300">
      <div className="absolute top-2 right-2 z-10">
        <div className="bg-black/60 backdrop-blur-sm text-amber-400 border border-amber-500/30 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider">
          {champion.cost} Gold
        </div>
      </div>

      <div className="h-48 md:h-64 bg-slate-900 w-full relative">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Loader className="animate-spin w-8 h-8 text-amber-500" />
            <span className="text-xs tracking-wide">Searching Database...</span>
          </div>
        ) : imageUrl ? (
          <img 
            src={imageUrl} 
            alt={champion.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              // Fallback if image fails to load
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${champion.name}&background=1e293b&color=cbd5e1`;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-600">
             <span className="text-4xl font-display opacity-20">{champion.name[0]}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90"></div>
      </div>

      <div className="p-4 relative -mt-12">
        <h3 className="text-2xl font-display text-white mb-1">{champion.name}</h3>
        <p className="text-sm text-slate-400 mb-3">{champion.skin}</p>
        
        <div className="flex flex-wrap gap-1.5 mb-2">
          {champion.origin.map(o => (
            <span key={o} className="px-1.5 py-0.5 bg-blue-900/40 text-blue-300 border border-blue-800 rounded text-[10px] uppercase tracking-wide">
              {o}
            </span>
          ))}
          {champion.class.map(c => (
            <span key={c} className="px-1.5 py-0.5 bg-purple-900/40 text-purple-300 border border-purple-800 rounded text-[10px] uppercase tracking-wide">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
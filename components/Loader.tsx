import React from 'react';

export const Loader: React.FC = () => {
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
      <div className="absolute inset-0 border-t-4 border-amber-500 rounded-full animate-spin"></div>
      <div className="absolute inset-4 border-4 border-slate-800 rounded-full"></div>
      <div className="absolute inset-4 border-b-4 border-blue-500 rounded-full animate-spin reverse-spin duration-700"></div>
    </div>
  );
};
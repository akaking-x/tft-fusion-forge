import React, { useState } from 'react';
import { Button } from './Button';
import { User } from '../types';
import { authService } from '../services/authService';
import { Shield, Key, Lock, User as UserIcon } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate Auth Delay
    setTimeout(() => {
      const user = authService.login(username, password);
      
      if (user) {
        onLogin(user);
        setLoading(false);
      } else {
        setLoading(false);
        setError('Invalid credentials');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-600/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-amber-600/10 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-slate-800/80 backdrop-blur-lg border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-full border border-amber-500/30 mb-4 shadow-lg shadow-amber-900/20">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">TFT Fusion Forge</h1>
          <p className="text-slate-400 text-sm">Restricted Access • Vertex AI Powered</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                placeholder="Enter Username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 border border-red-900/50 p-2 rounded text-center">
              {error}
            </div>
          )}

          <Button 
            fullWidth 
            type="submit" 
            variant="accent"
            disabled={loading}
            icon={loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Key className="w-4 h-4" />}
          >
            {loading ? 'Authenticating...' : 'Access Terminal'}
          </Button>

          <p className="text-xs text-center text-slate-500 mt-4">
            Authorized Personnel Only. <br/> Users must provide valid Vertex/Gemini Keys.
          </p>
        </form>
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { Button } from './Button';
import { User } from '../types';
import { authService } from '../services/authService';
import { Lock, X, Check } from 'lucide-react';

interface ChangePasswordModalProps {
  user: User;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, onClose }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    const result = authService.changePassword(user.id, oldPassword, newPassword);
    if (result) {
      setSuccess(true);
      setTimeout(onClose, 1500);
    } else {
      setError("Incorrect old password.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        
        <h3 className="text-xl font-display font-bold mb-6 text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-500" /> Change Password
        </h3>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-green-400">
             <div className="w-12 h-12 bg-green-900/30 rounded-full flex items-center justify-center mb-3">
               <Check className="w-6 h-6" />
             </div>
             <p>Password updated successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">Old Password</label>
              <input 
                type="password" 
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Confirm New Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"
                required
              />
            </div>

            {error && <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded">{error}</div>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" fullWidth icon={<Check className="w-4 h-4" />}>Update</Button>
              <Button type="button" variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
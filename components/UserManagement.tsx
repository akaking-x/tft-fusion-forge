import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { Button } from './Button';
import { Trash2, Edit, Plus, UserPlus, ShieldAlert, Key } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<Partial<User>>({ username: '', role: 'user', password: '' });
  const [error, setError] = useState('');

  const loadUsers = () => {
    setUsers(authService.getAllUsers());
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentUserData.username || (!isEditing && !currentUserData.password)) {
      setError('Username and Password are required');
      return;
    }

    if (isEditing && currentUserData.id) {
      // Update
      const updates: Partial<User> = { 
        username: currentUserData.username, 
        role: currentUserData.role as 'admin' | 'user' 
      };
      if (currentUserData.password) {
        updates.password = currentUserData.password;
      }
      
      const success = authService.updateUser(currentUserData.id, updates);
      if (!success) setError('Failed to update user.');
    } else {
      // Create
      const success = authService.addUser({
        username: currentUserData.username!,
        password: currentUserData.password!,
        role: currentUserData.role as 'admin' | 'user'
      });
      if (!success) setError('Username already exists.');
    }

    if (!error) {
      resetForm();
      loadUsers();
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      if (authService.deleteUser(id)) {
        loadUsers();
      } else {
        alert("Cannot delete default admin.");
      }
    }
  };

  const startEdit = (user: User) => {
    setIsEditing(true);
    setCurrentUserData({ ...user, password: '' }); // Don't show password
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentUserData({ username: '', role: 'user', password: '' });
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
        <h4 className="text-sm font-bold text-amber-500 mb-3 flex items-center gap-2">
           {isEditing ? <Edit className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
           {isEditing ? 'Edit User' : 'Add New User'}
        </h4>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Username</label>
            <input 
              type="text" 
              value={currentUserData.username}
              onChange={e => setCurrentUserData({...currentUserData, username: e.target.value})}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Password {isEditing && '(Leave blank to keep)'}</label>
            <input 
              type="text" 
              value={currentUserData.password}
              onChange={e => setCurrentUserData({...currentUserData, password: e.target.value})}
              placeholder={isEditing ? '********' : 'Password'}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Role</label>
            <select 
              value={currentUserData.role}
              onChange={e => setCurrentUserData({...currentUserData, role: e.target.value as any})}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="md" icon={isEditing ? <Edit className="w-3 h-3"/> : <UserPlus className="w-3 h-3"/>}>
              {isEditing ? 'Update' : 'Add'}
            </Button>
            {isEditing && (
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
            )}
          </div>
        </form>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      <div className="border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-800 text-slate-400">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 bg-slate-800/50">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-700/50">
                <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                  {user.role === 'admin' ? <ShieldAlert className="w-4 h-4 text-amber-500"/> : <div className="w-4 h-4"/>}
                  {user.username}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${user.role === 'admin' ? 'bg-amber-900/40 text-amber-500' : 'bg-blue-900/40 text-blue-400'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-right flex justify-end gap-2">
                  <button onClick={() => startEdit(user)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
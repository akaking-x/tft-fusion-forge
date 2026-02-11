import { User } from "../types";

const USERS_KEY = 'tft_forge_users';

const DEFAULT_ADMIN: User = {
  id: 'admin-001',
  username: 'admin',
  password: 'admin123456',
  role: 'admin'
};

const getUsers = (): User[] => {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    localStorage.setItem(USERS_KEY, JSON.stringify([DEFAULT_ADMIN]));
    return [DEFAULT_ADMIN];
  }
  return JSON.parse(stored);
};

const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const authService = {
  login: (username: string, password: string): User | null => {
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (user) {
      // Return user without password for session state
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safeUser } = user;
      return safeUser as User;
    }
    return null;
  },

  getAllUsers: (): User[] => {
    return getUsers().map(u => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...safe } = u;
      return safe as User;
    });
  },

  addUser: (user: Omit<User, 'id'>): boolean => {
    const users = getUsers();
    if (users.some(u => u.username.toLowerCase() === user.username.toLowerCase())) {
      return false; // User exists
    }
    const newUser = { ...user, id: crypto.randomUUID() };
    users.push(newUser);
    saveUsers(users);
    return true;
  },

  updateUser: (id: string, updates: Partial<User>) => {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      // Prevent removing the last admin or changing default admin username
      if (users[idx].id === DEFAULT_ADMIN.id && updates.username && updates.username !== DEFAULT_ADMIN.username) {
        return false;
      }
      
      users[idx] = { ...users[idx], ...updates };
      saveUsers(users);
      return true;
    }
    return false;
  },

  deleteUser: (id: string) => {
    if (id === DEFAULT_ADMIN.id) return false; // Cannot delete default admin
    let users = getUsers();
    users = users.filter(u => u.id !== id);
    saveUsers(users);
    return true;
  },

  // Used by "Change Password" (Self)
  changePassword: (userId: string, oldPassword: string, newPassword: string): boolean => {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === userId);
    
    if (idx !== -1) {
      if (users[idx].password !== oldPassword) {
        return false; // Old password incorrect
      }
      users[idx].password = newPassword;
      saveUsers(users);
      return true;
    }
    return false;
  }
};
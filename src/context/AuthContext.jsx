
import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService, STORAGE_KEYS } from '../services/storageService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedSession, setSavedSession] = useState(null);

  useEffect(() => {
    storageService.initStorage();
    const storedUser = storageService.get(STORAGE_KEYS.CURRENT_USER);
    if (storedUser) {
      setUser(storedUser);
      setSavedSession(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password, rememberMe = true) => {
    const cleanEmail = email.trim().toLowerCase();
    const users = storageService.get(STORAGE_KEYS.REGISTERED_USERS, {});
    const match = users[cleanEmail];

    if (match && match.password === password) {
      const isAysha = cleanEmail === 'jazaaa34@gmail.com' || cleanEmail === 'aysha@example.com';
      const userData = { email: cleanEmail, name: match.name || (isAysha ? 'Aysha' : 'User'), rememberMe };
      setUser(userData);
      if (rememberMe) {
        storageService.set(STORAGE_KEYS.CURRENT_USER, userData);
        setSavedSession(userData);
      } else {
        storageService.remove(STORAGE_KEYS.CURRENT_USER);
      }
      return { success: true };
    }

    // Default fallback allow login for demo account if user typed it
    if ((cleanEmail === 'jazaaa34@gmail.com' || cleanEmail === 'aysha@example.com') && password === 'password123') {
      const userData = { email: cleanEmail, name: 'Aysha', rememberMe };
      setUser(userData);
      if (rememberMe) {
        storageService.set(STORAGE_KEYS.CURRENT_USER, userData);
        setSavedSession(userData);
      }
      return { success: true };
    }

    return { success: false, message: 'Invalid email or password. Hint: jazaaa34@gmail.com / password123' };
  };

  const signUp = async (name, email, password, rememberMe = true) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const users = storageService.get(STORAGE_KEYS.REGISTERED_USERS, {});

    if (users[cleanEmail]) {
      return { success: false, message: 'An account with this email already exists.' };
    }

    users[cleanEmail] = { name: cleanName, password };
    storageService.set(STORAGE_KEYS.REGISTERED_USERS, users);

    const userData = { email: cleanEmail, name: cleanName, rememberMe };
    setUser(userData);
    if (rememberMe) {
      storageService.set(STORAGE_KEYS.CURRENT_USER, userData);
      setSavedSession(userData);
    }
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setSavedSession(null);
    storageService.remove(STORAGE_KEYS.CURRENT_USER);
    window.dispatchEvent(new CustomEvent('walletweather_logout'));
  };

  const updateProfile = (newName) => {
    if (!user) return;
    const updated = { ...user, name: newName.trim() };
    setUser(updated);
    storageService.set(STORAGE_KEYS.CURRENT_USER, updated);
    
    // Also update in registered users map
    const users = storageService.get(STORAGE_KEYS.REGISTERED_USERS, {});
    if (users[user.email]) {
      users[user.email].name = newName.trim();
      storageService.set(STORAGE_KEYS.REGISTERED_USERS, users);
    }
  };

  const requestLogout = () => {
    window.dispatchEvent(new CustomEvent('walletweather_open_exit_dialog'));
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoggedIn: Boolean(user),
      isLoading,
      savedSession,
      login,
      signUp,
      logout,
      requestLogout,
      updateProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

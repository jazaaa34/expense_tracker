
import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService, STORAGE_KEYS } from '../services/storageService';
import { apiRequest } from '../services/apiClient';

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
    let match = users[cleanEmail];

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

    // Check MongoDB database for user account
    try {
      const { ok, data } = await apiRequest('/api/db/user/find', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail })
      });
      if (ok && data?.user && data.user.password === password) {
        users[cleanEmail] = { name: data.user.name, password: data.user.password };
        storageService.set(STORAGE_KEYS.REGISTERED_USERS, users);
        const userData = { email: cleanEmail, name: data.user.name || 'User', rememberMe };
        setUser(userData);
        if (rememberMe) {
          storageService.set(STORAGE_KEYS.CURRENT_USER, userData);
          setSavedSession(userData);
        } else {
          storageService.remove(STORAGE_KEYS.CURRENT_USER);
        }
        return { success: true };
      }
    } catch {}

    return { success: false, message: 'Invalid email or password.' };
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

    // Also persist user account to MongoDB backend
    try {
      await apiRequest('/api/db/user/save', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, name: cleanName, password })
      });
    } catch (e) {
      console.warn('Backend user sync notice:', e.message);
    }

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

  const resetPassword = async ({ email, otp, newPassword, verificationToken }) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    try {
      const { ok, data } = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          otp,
          newPassword,
          verificationToken
        })
      });

      if (!ok || !data?.success) {
        return {
          success: false,
          message: data?.error || 'Failed to reset password. Please check the code.'
        };
      }

      // Update local storage registered users
      const users = storageService.get(STORAGE_KEYS.REGISTERED_USERS, {});
      if (!users[cleanEmail]) {
        users[cleanEmail] = { name: data.user?.name || 'User', password: newPassword };
      } else {
        users[cleanEmail].password = newPassword;
      }
      storageService.set(STORAGE_KEYS.REGISTERED_USERS, users);

      return {
        success: true,
        message: data.message || 'Password reset successfully!'
      };
    } catch (e) {
      return {
        success: false,
        message: e.message || 'Network error while resetting password.'
      };
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    if (!user?.email) {
      return { success: false, message: 'You must be logged in to change your password.' };
    }
    const cleanEmail = user.email.trim().toLowerCase();

    try {
      const { ok, data } = await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          currentPassword,
          newPassword
        })
      });

      if (!ok || !data?.success) {
        return {
          success: false,
          message: data?.error || 'Failed to change password.'
        };
      }

      // Update local storage registered users
      const users = storageService.get(STORAGE_KEYS.REGISTERED_USERS, {});
      if (users[cleanEmail]) {
        users[cleanEmail].password = newPassword;
        storageService.set(STORAGE_KEYS.REGISTERED_USERS, users);
      }

      return {
        success: true,
        message: data.message || 'Password changed successfully!'
      };
    } catch (e) {
      return {
        success: false,
        message: e.message || 'Network error while changing password.'
      };
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
      updateProfile,
      resetPassword,
      changePassword
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

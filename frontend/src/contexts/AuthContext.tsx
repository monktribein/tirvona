import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services';
import { getErrorMessage, TOKEN_KEY } from '../lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  district?: string;
  state?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; isSuspended?: boolean; suspensionData?: any }>;
  loginOTP: (phone: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  registerUser: (userData: any) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from stored token on mount.
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      setToken(savedToken);
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async () => {
    try {
      const res = await authService.me();
      if (res.data.success) {
        setUser(res.data.data);
      } else {
        logout();
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const persistSession = (data: any) => {
    const { token: userToken, ...userData } = data;
    localStorage.setItem(TOKEN_KEY, userToken);
    setToken(userToken);
    setUser(userData);
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await authService.login(email, password);
      if (res.data.success) {
        persistSession(res.data.data);
        return { success: true };
      }
      return {
        success: false,
        message: res.data.message || 'Login failed',
        isSuspended: res.data.isSuspended,
        suspensionData: res.data.suspensionData,
      };
    } catch (err: any) {
      if (err.response?.data?.isSuspended) {
        return {
          success: false,
          message: err.response.data.message || 'Account Suspended',
          isSuspended: true,
          suspensionData: err.response.data.suspensionData,
        };
      }
      return { success: false, message: getErrorMessage(err, 'Invalid credentials') };
    }
  };

  const loginOTP = async (phone: string, otp: string) => {
    try {
      const res = await authService.verifyOtp(phone, otp);
      if (res.data.success) {
        persistSession(res.data.data);
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Invalid OTP code' };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, 'Invalid OTP') };
    }
  };

  const registerUser = async (userData: any) => {
    try {
      const res = await authService.register(userData);
      if (res.data.success) {
        persistSession(res.data.data);
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Registration failed' };
    } catch (err) {
      return { success: false, message: getErrorMessage(err, 'Error occurred') };
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginOTP, registerUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

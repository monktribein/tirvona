import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

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
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginOTP: (phone: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  registerUser: (userData: any) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth`;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set default authorization header
  useEffect(() => {
    const savedToken = localStorage.getItem('ab_token');
    if (savedToken) {
      setToken(savedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      fetchUserProfile(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserProfile = async (authToken: string) => {
    try {
      const res = await axios.get(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
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

  const login = async (email: string, password: string) => {
    try {
      const res = await axios.post(`${API_URL}/login`, { email, password });
      if (res.data.success) {
        const { token: userToken, ...userData } = res.data.data;
        localStorage.setItem('ab_token', res.data.data.token);
        setToken(res.data.data.token);
        setUser(userData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.data.token}`;
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Login failed' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Invalid credentials' };
    }
  };

  const loginOTP = async (phone: string, otp: string) => {
    try {
      const res = await axios.post(`${API_URL}/otp/verify`, { phone, otp });
      if (res.data.success) {
        const { token: userToken, ...userData } = res.data.data;
        localStorage.setItem('ab_token', res.data.data.token);
        setToken(res.data.data.token);
        setUser(userData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.data.token}`;
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Invalid OTP code' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Invalid OTP' };
    }
  };

  const registerUser = async (userData: any) => {
    try {
      const res = await axios.post(`${API_URL}/register`, userData);
      if (res.data.success) {
        const { token: userToken, ...registeredData } = res.data.data;
        localStorage.setItem('ab_token', res.data.data.token);
        setToken(res.data.data.token);
        setUser(registeredData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.data.token}`;
        return { success: true };
      }
      return { success: false, message: res.data.message || 'Registration failed' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || 'Error occurred' };
    }
  };

  const logout = () => {
    localStorage.removeItem('ab_token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
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

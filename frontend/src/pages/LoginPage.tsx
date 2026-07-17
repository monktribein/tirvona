import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Mail, Phone, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import axios from 'axios';

export const LoginPage: React.FC = () => {
  const { login, loginOTP } = useAuth();
  const navigate = useNavigate();

  const [useOtp, setUseOtp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [serverOtpMsg, setServerOtpMsg] = useState(''); // For demo helper notice
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      navigate('/');
    } else {
      setError(res.message || 'Login failed');
    }
  };

  const handleSendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    if (!phone) return setError('Enter phone number');
    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/otp/send`, { phone });
      setLoading(false);
      if (res.data.success) {
        setOtpSent(true);
        // Save mock OTP response for dev visibility
        setServerOtpMsg(`[DEMO ONLY] Simulated SMS sent! Use OTP code: ${res.data.otp}`);
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.response?.data?.message || 'Error requesting OTP');
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await loginOTP(phone, otpCode);
    setLoading(false);
    if (res.success) {
      navigate('/');
    } else {
      setError(res.message || 'Invalid OTP');
    }
  };

  // Pre-fill helper accounts for easy evaluation of all features
  const prefillAccount = (role: string) => {
    if (role === 'guest' || role === 'pilgrim') {
      setEmail('pilgrim@ashraybharat.gov.in');
      setPassword('password123');
    } else if (role === 'owner') {
      setEmail('owner@ashraybharat.gov.in');
      setPassword('password123');
    } else if (role === 'officer') {
      setEmail('officer@ashraybharat.gov.in');
      setPassword('password123');
    } else if (role === 'admin') {
      setEmail('admin@ashraybharat.gov.in');
      setPassword('password123');
    }
    setUseOtp(false);
  };

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center bg-background">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-secondary to-primary items-center justify-center text-white font-bold text-xl shadow-lg">
            T
          </div>
          <h2 className="text-2xl font-extrabold text-secondary dark:text-white flex items-center justify-center gap-1.5">
            Log in to Tirrthiva <ShieldCheck size={20} className="text-accent" />
          </h2>
          <p className="text-xs text-gray-500">
            Sign in to access reservations, verification panels, and audit logs
          </p>
        </div>

        {/* Demo Prefills Bar */}
        <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-secondary dark:text-accent">
            <Sparkles size={14} /> Quick Demo Logins:
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <button onClick={() => prefillAccount('guest')} className="px-2.5 py-1.5 bg-card hover:bg-gray-50 dark:hover:bg-slate-800 border border-border rounded-lg font-semibold text-center cursor-pointer">
              Guest Stay
            </button>
            <button onClick={() => prefillAccount('owner')} className="px-2.5 py-1.5 bg-card hover:bg-gray-50 dark:hover:bg-slate-800 border border-border rounded-lg font-semibold text-center cursor-pointer">
              Ashram Owner
            </button>
            <button onClick={() => prefillAccount('officer')} className="px-2.5 py-1.5 bg-card hover:bg-gray-50 dark:hover:bg-slate-800 border border-border rounded-lg font-semibold text-center cursor-pointer">
              District Officer
            </button>
            <button onClick={() => prefillAccount('admin')} className="px-2.5 py-1.5 bg-card hover:bg-gray-50 dark:hover:bg-slate-800 border border-border rounded-lg font-semibold text-center cursor-pointer">
              Super Admin
            </button>
          </div>
        </div>

        {/* Toggle Login Method */}
        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => { setUseOtp(false); setError(''); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${!useOtp ? 'bg-white dark:bg-slate-700 text-secondary dark:text-white shadow-sm' : 'text-gray-500'}`}
          >
            Password
          </button>
          <button
            onClick={() => { setUseOtp(true); setError(''); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${useOtp ? 'bg-white dark:bg-slate-700 text-secondary dark:text-white shadow-sm' : 'text-gray-500'}`}
          >
            Mobile OTP
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-3 bg-danger/10 text-danger border border-danger/25 text-xs rounded-lg font-semibold">
            {error}
          </div>
        )}

        {/* Password Form */}
        {!useOtp ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                <input
                  type="email"
                  required
                  placeholder="name@govt.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-white rounded-lg font-bold text-sm shadow-md hover:opacity-95 transition-all cursor-pointer"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* OTP Form */
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Mobile Phone Number</label>
              <div className="relative flex gap-2">
                <div className="relative flex-grow">
                  <Phone className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                  <input
                    type="tel"
                    required
                    placeholder="+91 XXXXX XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg text-sm focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="px-4 py-3 bg-secondary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all cursor-pointer"
                >
                  {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>

            {otpSent && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-2.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200/50 text-[10px] rounded-lg font-semibold leading-relaxed">
                  {serverOtpMsg}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500">Enter 6-digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full px-4 py-3 bg-card border border-border rounded-lg text-sm text-center tracking-widest font-extrabold focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-primary text-white rounded-lg font-bold text-sm shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Verify & Log In
                </button>
              </div>
            )}
          </form>
        )}

        {/* Footer info links */}
        <div className="text-center text-xs text-gray-500">
          New stay seeker or property owner?{' '}
          <Link to="/register" className="text-primary font-bold hover:underline">
            Register now
          </Link>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;

import React, { useState } from 'react';
import logo from '../assets/logo.png';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Mail, Phone, Lock, Eye, EyeOff } from 'lucide-react';
import { authService } from '../services';
import { getErrorMessage } from '../lib/api';

export const LoginPage: React.FC = () => {
  const { login, loginOTP } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

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

  const getRedirectTarget = () => {
    if (redirect) return redirect;
    const pendingRaw = localStorage.getItem('pending_booking');
    if (pendingRaw) {
      try {
        const pb = JSON.parse(pendingRaw);
        if (pb.ashramId) {
          return `/ashram/${pb.ashramId}?checkIn=${pb.checkInDate || ''}&checkOut=${pb.checkOutDate || ''}&guests=${pb.guestsCount || 1}`;
        }
      } catch (e) {}
    }
    return '/';
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      navigate(getRedirectTarget());
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
      const res = await authService.sendOtp(phone);
      setLoading(false);
      if (res.data.success) {
        setOtpSent(true);
        // The backend only returns `otp` outside production (dev/testing helper).
        if (res.data.otp) {
          setServerOtpMsg(`[DEV ONLY] Simulated SMS sent! Use OTP code: ${res.data.otp}`);
        } else {
          setServerOtpMsg('OTP sent to your registered phone number.');
        }
      }
    } catch (err) {
      setLoading(false);
      setError(getErrorMessage(err, 'Error requesting OTP'));
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await loginOTP(phone, otpCode);
    setLoading(false);
    if (res.success) {
      navigate(getRedirectTarget());
    } else {
      setError(res.message || 'Invalid OTP');
    }
  };



  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center bg-gray-50/50 dark:bg-[#070F1B]">
      <div className="w-full max-w-md bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] shadow-sm p-8 space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <img src={logo} alt="Tirvona Logo" className="w-12 h-12 object-contain inline-block" />
          <h2 className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center justify-center gap-1.5">
            Log in to Tirvona <ShieldCheck size={20} className="text-[#0A4DA6]" />
          </h2>
          <p className="text-xs text-gray-400">
            Sign in to access reservations, verification panels, and audit logs
          </p>
        </div>

        {/* Toggle Login Method */}
        <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-full">
          <button
            onClick={() => { setUseOtp(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${!useOtp ? 'bg-white dark:bg-slate-800 text-[#0B192C] dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
          >
            Password
          </button>
          <button
            onClick={() => { setUseOtp(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${useOtp ? 'bg-white dark:bg-slate-800 text-[#0B192C] dark:text-white shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
          >
            Mobile OTP
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* Password Form */}
        {!useOtp ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                <input
                  type="email"
                  required
                  placeholder="name@govt.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0A4DA6] hover:bg-opacity-95 text-white font-extrabold rounded-full text-xs shadow-md transition-all cursor-pointer"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* OTP Form */
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400">Mobile Phone Number</label>
              <div className="relative flex gap-2">
                <div className="relative flex-grow">
                  <Phone className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                  <input
                    type="tel"
                    required
                    placeholder="+91 XXXXX XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="px-4 py-3 bg-[#0B192C] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all cursor-pointer shrink-0"
                >
                  {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>

            {otpSent && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200/50 text-[10px] rounded-xl font-semibold leading-relaxed">
                  {serverOtpMsg}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">Enter 6-digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm text-center tracking-widest font-extrabold focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#0A4DA6] text-white rounded-full font-extrabold text-xs shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  Verify & Log In
                </button>
              </div>
            )}
          </form>
        )}

        {/* Footer info links */}
        <div className="text-center text-xs text-gray-400">
          New stay seeker or property owner?{' '}
          <Link to={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-[#0A4DA6] font-bold hover:underline">
            Register now
          </Link>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;

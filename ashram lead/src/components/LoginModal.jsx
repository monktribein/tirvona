/**
 * LoginModal.jsx — Exact Tirvona Authentication Modal
 * Restricts phone number input strictly to 10 numeric digits only.
 */
import React, { useState } from 'react';
import { X, Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Restrict input strictly to max 10 numeric digits
  const handlePhoneChange = (e) => {
    const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(numericOnly);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!phone) {
      setError('Please enter your phone number');
      return;
    }
    if (phone.length < 10) {
      setError('Please enter a complete 10-digit phone number');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess({
        name: 'Field Lead Agent',
        phone: phone,
        role: 'field_agent'
      });
      onClose();
    }, 600);
  };

  const inputClass = "w-full min-h-[48px] px-4 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs animate-fadeIn">
      
      {/* Modal Container */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-xl relative animate-scaleUp text-left">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[#64748B] hover:text-[#0F172A] rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close Modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header with Real Tirvona Logo */}
        <div className="text-center space-y-2 mb-6">
          <div className="flex items-center justify-center mb-3">
            <img
              src="/logo.png"
              alt="Tirvona Sacred Destinations Logo"
              className="h-12 w-auto object-contain"
            />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Tirvona Agent Login
          </h2>
          <p className="text-xs text-[#64748B] font-medium">
            Enter your credentials to access the Ashram Field Verification Console
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Phone Number Field — Restricted to 10 Numbers Only */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#64748B] tracking-wider block">
                Phone Number
              </label>
              <span className="text-[10px] font-bold text-[#94A3B8]">
                {phone.length}/10 digits
              </span>
            </div>
            <div className="relative">
              <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                className={`${inputClass} pl-11`}
                value={phone}
                onChange={handlePhoneChange}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#64748B] tracking-wider block">
                Password
              </label>
              <button
                type="button"
                onClick={() => alert('Please contact system administrator to reset password.')}
                className="text-[11px] font-bold text-[#0A4DA6] hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter account password"
                className={`${inputClass} pl-11 pr-11`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#E2E8F0] accent-[#0A4DA6] cursor-pointer"
              />
              <span className="text-xs font-medium text-[#64748B]">Remember this device</span>
            </label>
          </div>

          {/* Submit CTA Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] bg-[#0A4DA6] hover:bg-[#083D85] text-white font-extrabold rounded-full text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Console</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Demo Helper Footer */}
        <div className="mt-6 pt-4 border-t border-[#E2E8F0] text-center">
          <p className="text-[11px] text-[#64748B]">
            Demo credentials: Enter any 10-digit number &amp; password
          </p>
        </div>

      </div>
    </div>
  );
}

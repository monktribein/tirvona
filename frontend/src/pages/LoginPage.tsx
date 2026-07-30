import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth, type OtpChallenge } from '../contexts/AuthContext';
import OtpChallengeForm from '../components/OtpChallengeForm';
import CompleteProfileModal from '../components/CompleteProfileModal';
import useGoogleAuth from '../hooks/useGoogleAuth';
import { isGoogleConfigured } from '../lib/googleAuth';
import {
  ShieldCheck, Lock, Mail, Phone, Eye, EyeOff, BadgeCheck,
  Headphones, ArrowRight, Landmark, Zap, Smartphone
} from 'lucide-react';
import { authService } from '../services';
import { getErrorMessage } from '../lib/api';
import { getRoleDefaultDashboard, getPostLoginRedirect } from '../utils/roleRedirect';

// Small multicolor Google mark (lucide has no brand logos).
const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

export const LoginPage: React.FC = () => {
  const { user, login, loginOTP, verifyLoginOtp, resendOtp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [useOtp, setUseOtp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [serverOtpMsg, setServerOtpMsg] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [suspensionInfo, setSuspensionInfo] = useState<any | null>(null);
  // Set when a Guest Visitor's password is accepted and an OTP is issued.
  const [loginChallenge, setLoginChallenge] = useState<OtpChallenge | null>(null);

  const google = useGoogleAuth((userArg) => {
    const target = getPostLoginRedirect(userArg?.role);
    navigate(target.url, { replace: true });
  });

  const handleGoogle = async () => {
    setError('');
    setNotice('');
    const message = await google.start();
    if (message) setError(message);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuspensionInfo(null);
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.success) {
      // Guest Visitors: password accepted, now confirm the OTP.
      if (res.otpRequired && res.challenge) {
        setLoginChallenge(res.challenge);
        return;
      }
      const target = getPostLoginRedirect(res.user?.role);
      navigate(target.url, { replace: true });
    } else {
      if (res.isSuspended && res.suspensionData) {
        setSuspensionInfo(res.suspensionData);
      } else {
        setError(res.message || 'Login failed');
      }
    }
  };

  // Emails a reset link to the address already typed in the Email / Phone field.
  // The reply is deliberately the same whether or not the address is registered.
  const handleForgotPassword = async () => {
    setError('');
    setNotice('');
    const identifier = email.trim();
    if (!identifier) {
      setError('Enter your registered email address above, then click Forgot Password.');
      return;
    }
    if (!identifier.includes('@')) {
      setError('Password reset links are sent by email. Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.forgotPassword(identifier);
      setNotice(res.data.message || 'If that email is registered, a password reset link has been sent to it.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send the reset link. Please try again.'));
    } finally {
      setLoading(false);
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
        setServerOtpMsg('OTP sent to your registered phone number.');
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
      const target = getPostLoginRedirect(user?.role);
      navigate(target.url, { replace: true });
    } else {
      setError(res.message || 'Invalid OTP');
    }
  };

  const switchMode = (otp: boolean) => {
    setUseOtp(otp);
    setError('');
    setNotice('');
  };

  const heroFeatures = [
    { icon: <ShieldCheck size={18} />, label: 'Trusted Properties' },
    { icon: <Lock size={18} />, label: 'Secure Booking' },
    { icon: <BadgeCheck size={18} />, label: 'Verified Hosts' },
    { icon: <Headphones size={18} />, label: '24×7 Support' },
  ];

  const trustBadges = [
    { icon: <ShieldCheck size={16} />, title: 'SSL Secure Login', sub: 'Your data is protected' },
    { icon: <Landmark size={16} />, title: 'Government', sub: 'Verified Platform' },
    { icon: <Zap size={16} />, title: 'Fast OTP Delivery', sub: 'Instant & reliable' },
  ];

  return (
    <section className="relative w-full min-h-screen bg-[#0B192C] overflow-hidden -mt-24 lg:-mt-28">
      {/* Full-cover background; section pulled up under the floating navbar so there is no white gap */}
      <img
        src="/auth-page/background.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B192C]/90 via-[#0B192C]/60 to-[#0A4DA6]/25" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen grid lg:grid-cols-2 gap-10 lg:gap-12 items-center pt-36 lg:pt-40 pb-16">

        {/* ── Left: Marketing hero ── */}
        <div className="hidden lg:flex flex-col justify-center text-white space-y-7">
          <div className="space-y-5">
            <h1 className="font-black leading-[1.05] tracking-tight" style={{ fontSize: 'clamp(2.5rem, 5vw, 3.75rem)' }}>
              Discover Divine<br />Destinations
            </h1>
            <div className="flex items-center gap-3 text-[#E58C28]">
              <span className="h-px w-24 bg-gradient-to-r from-transparent to-[#E58C28]" />
              <span className="text-lg">✦</span>
              <span className="h-px w-24 bg-gradient-to-l from-transparent to-[#E58C28]" />
            </div>
            <p className="text-base text-gray-200 max-w-md leading-relaxed">
              Sign in to manage bookings, present digital check-in passes, and continue your sacred journey across India.
            </p>
          </div>

          <div className="space-y-4">
            {heroFeatures.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-[#E58C28] backdrop-blur-sm">
                  {f.icon}
                </div>
                <span className="font-bold text-sm">{f.label}</span>
              </div>
            ))}
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-6">
            {[
              { n: '1,200+', l: 'Verified Ashrams' },
              { n: '50+', l: 'Sacred Cities' },
              { n: '25k+', l: 'Happy Pilgrims' },
            ].map((s, i) => (
              <React.Fragment key={s.l}>
                {i > 0 && <span className="h-8 w-px bg-white/20" />}
                <div>
                  <p className="text-2xl font-black leading-none">{s.n}</p>
                  <p className="text-[11px] text-gray-300 font-semibold mt-1">{s.l}</p>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Testimonial */}
          <blockquote className="border-l-2 border-[#E58C28]/60 pl-4 max-w-md">
            <p className="text-sm text-gray-200 italic leading-relaxed">
              “Booked our Kedarnath stay in minutes — verified, safe, and truly blessed.”
            </p>
            <footer className="text-[11px] text-gray-400 font-bold mt-1.5">— Ananya Sharma, Pune</footer>
          </blockquote>
        </div>

        {/* ── Right: Auth card ── */}
        <div className="w-full max-w-md mx-auto lg:ml-auto lg:mr-0 space-y-4">
          <div className="bg-white/95 dark:bg-[#0B192C]/95 backdrop-blur-xl border border-white/40 dark:border-slate-800 rounded-[28px] shadow-2xl p-6 sm:p-8 space-y-5">

            {/* Brand */}
            <div className="text-center space-y-2">
              <img src="/logo/logo.png" alt="Tirvona" className="w-14 h-14 object-contain inline-block" />
              <h2 className="text-2xl font-black text-[#0B192C] dark:text-white">Welcome Back <span className="align-middle">👋</span></h2>
              <p className="text-xs text-gray-400 font-semibold">Sign in to continue your spiritual journey</p>
            </div>

            {google.stage === 'otp' && google.challenge ? (
              /* Google sign-up: verify the address before the account exists. */
              <OtpChallengeForm
                challenge={google.challenge}
                destination={google.challenge.sentTo || ''}
                title="Verify Email"
                onVerify={(otp) => google.verifyOtp(otp)}
                onResend={google.resendOtp}
                onCancel={google.reset}
                /* Advancing to the profile modal is handled by the hook. */
                onVerified={() => {}}
              />
            ) : loginChallenge ? (
              /* OTP step for Guest Visitors — same card, styling untouched. */
              <OtpChallengeForm
                challenge={loginChallenge}
                /* The identifier they typed is also where the code was sent. */
                destination={email}
                title="Verify OTP"
                onVerify={(otp) => verifyLoginOtp(loginChallenge.otpToken, otp)}
                onResend={async () => {
                  const res = await resendOtp(loginChallenge.otpToken);
                  if (res.challenge) setLoginChallenge(res.challenge);
                  return res;
                }}
                onCancel={() => setLoginChallenge(null)}
                onVerified={() => navigate(getPostLoginRedirect(user?.role).url, { replace: true })}
              />
            ) : (
            <>
            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-full">
              <button
                onClick={() => switchMode(false)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all cursor-pointer ${!useOtp ? 'bg-white dark:bg-slate-800 text-[#0A4DA6] shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
              >
                Password
              </button>
              <button
                onClick={() => switchMode(true)}
                className={`flex-1 py-2.5 text-xs font-bold rounded-full transition-all cursor-pointer ${useOtp ? 'bg-white dark:bg-slate-800 text-[#0A4DA6] shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
              >
                Mobile OTP
              </button>
            </div>

            {suspensionInfo ? (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-6 space-y-4 text-left shadow-lg animate-in zoom-in-95 duration-150">
                <div className="flex items-center gap-3 border-b border-rose-200 dark:border-rose-900/60 pb-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-rose-800 dark:text-rose-200">
                      {suspensionInfo.suspensionType === 'permanent'
                        ? 'Account Permanently Suspended'
                        : 'Account Temporarily Suspended'}
                    </h3>
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">
                      Access to Tirvona platform has been restricted by System Administration.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
                    <span className="text-gray-500 font-bold">Reason:</span>
                    <span className="font-extrabold text-rose-700 dark:text-rose-300">{suspensionInfo.suspensionReason}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
                    <span className="text-gray-500 font-bold">Suspended By:</span>
                    <span className="font-bold text-gray-700 dark:text-gray-200">{suspensionInfo.suspendedBy || 'Super Admin'}</span>
                  </div>

                  {suspensionInfo.suspendedAt && (
                    <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
                      <span className="text-gray-500 font-bold">Suspended On:</span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{suspensionInfo.suspendedAt}</span>
                    </div>
                  )}

                  {suspensionInfo.suspensionType === 'temporary' && (
                    <>
                      <div className="flex justify-between items-center py-1 border-b border-rose-100 dark:border-rose-900/40">
                        <span className="text-gray-500 font-bold">Suspension Ends:</span>
                        <span className="font-bold text-gray-700 dark:text-gray-200">{suspensionInfo.suspensionEndDate || 'N/A'}</span>
                      </div>

                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-500 font-bold">Remaining Duration:</span>
                        <span className="font-black text-rose-600 dark:text-rose-400">
                          {suspensionInfo.remainingDays !== null ? `${suspensionInfo.remainingDays} Days` : 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {suspensionInfo.visibleMessage && (
                  <div className="p-3 bg-white/80 dark:bg-slate-900/80 rounded-xl border border-rose-100 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 italic">
                    "{suspensionInfo.visibleMessage}"
                  </div>
                )}

                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 text-center space-y-2">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">Need Help? Contact Support</p>
                  <a
                    href="mailto:support@tirvona.com"
                    className="inline-block px-5 py-2 rounded-full bg-rose-600 text-white font-extrabold text-xs hover:bg-rose-700 transition-colors shadow-md"
                  >
                    support@tirvona.com
                  </a>
                  <div>
                    <button
                      onClick={() => setSuspensionInfo(null)}
                      className="text-[11px] text-gray-400 underline font-semibold mt-1 cursor-pointer"
                    >
                      Back to Login
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">{error}</div>
                )}
                {notice && (
                  <div className="p-3 bg-[#0A4DA6]/10 text-[#0A4DA6] border border-[#0A4DA6]/20 text-xs rounded-xl font-semibold">{notice}</div>
                )}
              </>
            )}

            {/* Password form */}
            {!useOtp ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">Email / Phone</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                    <input
                      type="text"
                      required
                      placeholder="name@govt.in or +91 98765 43210"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#0A4DA6] cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-xs font-bold text-[#0A4DA6] hover:underline cursor-pointer disabled:opacity-60"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white font-extrabold rounded-full text-sm shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? 'Signing in…' : <>Continue <ArrowRight size={16} /></>}
                </button>
              </form>
            ) : (
              /* OTP form */
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">Mobile Phone Number</label>
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <Phone className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
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
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-[#0B192C] dark:text-gray-200">Enter 6-digit OTP Code</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-sm text-center tracking-[0.4em] font-extrabold focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full font-extrabold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {loading ? 'Verifying…' : <>Verify &amp; Continue <ArrowRight size={16} /></>}
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <span className="h-px flex-grow bg-gray-200 dark:bg-slate-800" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Or</span>
              <span className="h-px flex-grow bg-gray-200 dark:bg-slate-800" />
            </div>

            {/* Social / alt login */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogle}
                disabled={google.busy || !isGoogleConfigured()}
                title={isGoogleConfigured() ? undefined : 'Google Sign-In is not configured on this deployment'}
                className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#0B192C] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <GoogleIcon /> {google.busy ? 'Connecting…' : 'Continue with Google'}
              </button>
              <button
                type="button"
                onClick={() => switchMode(true)}
                className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-[#0B192C] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <Smartphone size={16} className="text-[#0A4DA6]" /> Login with Mobile OTP
              </button>
            </div>

            {/* Register */}
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 font-semibold">
              Don't have an account?{' '}
              <Link to={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-[#0A4DA6] font-black hover:underline">
                Create Account
              </Link>
            </p>

            <p className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 font-semibold">
              <Lock size={11} /> 256-bit encrypted sign-in · We never share your data
            </p>
            </>
            )}
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-2 text-white">
            {trustBadges.map((b) => (
              <div key={b.title} className="flex items-center gap-2 justify-center sm:justify-start">
                <div className="text-[#E58C28] shrink-0">{b.icon}</div>
                <div className="leading-tight">
                  <p className="text-[10px] sm:text-[11px] font-black">{b.title}</p>
                  <p className="text-[9px] text-gray-300 font-semibold hidden sm:block">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Google sign-up final step: the account is created only when this
          modal is submitted. */}
      {google.stage === 'profile' && (
        <CompleteProfileModal
          email={google.email}
          suggestedName={google.suggestedName}
          onSubmit={google.completeProfile}
          onDone={() => navigate(getPostLoginRedirect(user?.role).url, { replace: true })}
          onCancel={google.reset}
        />
      )}
    </section>
  );
};
export default LoginPage;

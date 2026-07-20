import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Mail, Phone, Lock, User as UserIcon, Building2 } from 'lucide-react';
import logo from '../assets/logo.png';

export const RegisterPage: React.FC = () => {
  const { registerUser } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<'customer' | 'owner'>('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [govtIdType, setGovtIdType] = useState('Aadhaar');
  const [govtIdNumber, setGovtIdNumber] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const payload: any = {
      name,
      email,
      phone,
      password,
      role,
    };

    if (role === 'owner') {
      payload.govtIdType = govtIdType;
      payload.govtIdNumber = govtIdNumber;
      payload.govtIdUrl = 'https://res.cloudinary.com/ashray-bharat/image/upload/ids/owner_id_sample.jpg';
    }

    const res = await registerUser(payload);
    setLoading(false);
    if (res.success) {
      if (role === 'owner') {
        navigate('/owner/dashboard');
      } else {
        navigate('/');
      }
    } else {
      setError(res.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center bg-gray-50/50 dark:bg-[#070F1B]">
      <div className="w-full max-w-md bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[32px] shadow-sm p-8 space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <img src={logo} alt="Tirvona Logo" className="w-12 h-12 object-contain inline-block" />
          <h2 className="text-2xl font-black text-[#0B192C] dark:text-white flex items-center justify-center gap-1.5">
            Create Portal Account <ShieldCheck size={20} className="text-[#0A4DA6]" />
          </h2>
          <p className="text-xs text-gray-400">
            Join the national digital spiritual stays platform
          </p>
        </div>

        {/* Role Select Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole('customer')}
            className={`p-4 rounded-[20px] border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
              role === 'customer'
                ? 'border-[#0A4DA6] bg-[#0A4DA6]/5 text-[#0A4DA6] shadow-sm'
                : 'border-gray-150 text-gray-400 hover:border-gray-300'
            }`}
          >
            <UserIcon size={18} />
            <span className="text-xs font-bold">Guest Visitor</span>
          </button>
          <button
            type="button"
            onClick={() => setRole('owner')}
            className={`p-4 rounded-[20px] border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
              role === 'owner'
                ? 'border-[#0A4DA6] bg-[#0A4DA6]/5 text-[#0A4DA6] shadow-sm'
                : 'border-gray-150 text-gray-400 hover:border-gray-300'
            }`}
          >
            <Building2 size={18} />
            <span className="text-xs font-bold">Ashram Owner</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-xs rounded-xl font-semibold">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400">Full Name</label>
            <input
              type="text"
              required
              placeholder="Enter name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
            />
          </div>

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
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400">Mobile Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
              <input
                type="tel"
                required
                placeholder="+91 XXXXX XXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400">Security Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]"
              />
            </div>
          </div>

          {/* Dynamic Owner Verification Section */}
          {role === 'owner' && (
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-[20px] space-y-3">
              <span className="text-[10px] uppercase font-bold text-[#0A4DA6] tracking-wider">
                Government KYC Verification Required
              </span>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={govtIdType}
                    onChange={(e) => setGovtIdType(e.target.value)}
                    className="p-2.5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="Service ID">Service ID</option>
                    <option value="VoterID">Voter ID</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="ID Number"
                    value={govtIdNumber}
                    onChange={(e) => setGovtIdNumber(e.target.value)}
                    className="p-2.5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-850 rounded-xl text-xs focus:outline-none"
                  />
                </div>
                <div className="text-[10px] text-gray-400 leading-normal">
                  By submitting, you agree to undergo physical and document checks by State/District officers.
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#0A4DA6] text-white rounded-full font-extrabold text-xs shadow-md hover:opacity-95 transition-all cursor-pointer"
          >
            {loading ? 'Registering Account...' : 'Create Account'}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-[#0A4DA6] font-bold hover:underline">
            Log in here
          </Link>
        </div>
      </div>
    </div>
  );
};
export default RegisterPage;

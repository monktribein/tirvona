import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Building2,
  Plus,
  RefreshCw,
  Search,
  Pencil,
  KeyRound,
  Trash2,
  UserCheck,
  UserX,
  LayoutDashboard,
  ClipboardList,
  MapPin,
  Phone,
  Mail,
  Lock,
  Eye,
  LogOut,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Clock3,
  XCircle,
  TrendingUp,
  Calendar,
  Clock,
  ChevronRight,
  ShieldCheck,
  X,
  ArrowLeft,
  ExternalLink,
  Bell,
  Globe,
  ChevronDown,
  ArrowRight,
  Check,
  CheckCheck
} from 'lucide-react';
import { supervisorApi } from '../services/supervisorApi';
import { formatDate } from '../utils/formatDate';
import { useLanguage } from '../context/LanguageContext';

export default function SupervisorDashboard({ supervisor, onLogout, onOpenFieldPortal }) {
  const { language: selectedLanguage, setLanguage: setSelectedLanguage, t } = useLanguage();
  const [activeNav, setActiveNav] = useState('agents'); // 'dashboard' | 'agents' | 'leads' | 'agent-detail'
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const [dashboardData, setDashboardData] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentSearch, setAgentSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [districtLeads, setDistrictLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');

  const [agentDetail, setAgentDetail] = useState(null);
  const [agentLeads, setAgentLeads] = useState([]);
  const [loadingAgentDetail, setLoadingAgentDetail] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    employeeCode: '',
    notes: '',
  });

  const [resettingAgent, setResettingAgent] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const [confirmDeleteAgent, setConfirmDeleteAgent] = useState(null);

  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langRef = useRef(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Lead Verification Pending',
      desc: 'Field agent Sachin submitted 1 ashram lead in Ayodhya for review.',
      time: '10 min ago',
      unread: true,
      type: 'lead'
    },
    {
      id: 2,
      title: 'Field Agent Active',
      desc: 'Sachin (S01) logged in to Ayodhya district jurisdiction.',
      time: '1 hr ago',
      unread: true,
      type: 'agent'
    },
    {
      id: 3,
      title: 'District Coverage Sync',
      desc: 'Tirvona sacred lead pipeline active for Uttar Pradesh.',
      time: 'Today',
      unread: false,
      type: 'system'
    }
  ]);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadNotifCount = notifications.filter(n => n.unread).length;

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const openEdit = (agent) => {
    setEditingAgent(agent);
    setForm({
      name: agent.name || '',
      phone: agent.phone || '',
      email: agent.email || '',
      password: '',
      role: agent.role || 'field_agent',
      employeeCode: agent.employeeCode || '',
      notes: agent.notes || '',
    });
    setCreateError('');
    setShowCreateModal(true);
  };

  const openCreate = () => {
    setEditingAgent(null);
    setForm({
      name: '',
      phone: '',
      email: '',
      password: '',
      role: 'field_agent',
      employeeCode: '',
      notes: '',
    });
    setCreateError('');
    setShowCreateModal(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    setSaving(true);
    try {
      await supervisorApi.resetAgentPassword(resettingAgent._id, newPassword);
      showToast(`Password reset successfully for ${resettingAgent.name}`);
      setResettingAgent(null);
      setNewPassword('');
    } catch (err) {
      showToast(err.message || 'Could not reset password', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (agent) => {
    const nextStatus = agent.status === 'active' ? 'suspended' : 'active';
    setSaving(true);
    try {
      await supervisorApi.updateAgent(agent._id, { status: nextStatus });
      showToast(`Agent marked as ${nextStatus}`);
      loadAgents();
    } catch (err) {
      showToast(err.message || 'Could not update status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!confirmDeleteAgent) return;
    setSaving(true);
    try {
      await supervisorApi.deleteAgent(confirmDeleteAgent._id);
      showToast(`Field agent ${confirmDeleteAgent.name} deleted`);
      setConfirmDeleteAgent(null);
      loadAgents();
      loadDashboard();
    } catch (err) {
      showToast(err.message || 'Could not delete field agent', 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const data = await supervisorApi.getDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const res = await supervisorApi.listAgents({ limit: 100 });
      setAgents(res?.items || []);
    } catch (err) {
      showToast(err.message || 'Could not load field agents', 'error');
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const loadDistrictLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const res = await supervisorApi.getAgentLeads('all', { limit: 100 }).catch(async () => {
        return { items: [] };
      });
      setDistrictLeads(res?.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadAgents();
  }, [loadDashboard, loadAgents]);

  const handleRefresh = () => {
    loadDashboard();
    loadAgents();
    if (activeNav === 'leads') loadDistrictLeads();
  };

  const handleOpenAgent = async (agentId) => {
    setSelectedAgentId(agentId);
    setActiveNav('agent-detail');
    setLoadingAgentDetail(true);
    try {
      const [agent, leadsRes] = await Promise.all([
        supervisorApi.getAgent(agentId),
        supervisorApi.getAgentLeads(agentId, { limit: 100 }),
      ]);
      setAgentDetail(agent);
      setAgentLeads(leadsRes?.items || []);
    } catch (err) {
      showToast(err.message || 'Failed to load agent details', 'error');
    } finally {
      setLoadingAgentDetail(false);
    }
  };

  const handleSaveAgent = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!form.name.trim()) return setCreateError('Agent name is required');
    const cleanPhone = form.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) return setCreateError('Enter a valid 10-digit mobile number');
    if (!editingAgent && (!form.password || form.password.length < 8)) {
      return setCreateError('Password must be at least 8 characters');
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: cleanPhone,
        email: form.email.trim() || undefined,
        role: form.role || 'field_agent',
        employeeCode: form.employeeCode.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (editingAgent) {
        await supervisorApi.updateAgent(editingAgent._id, payload);
        showToast(`Account "${form.name}" updated successfully!`);
      } else {
        await supervisorApi.createAgent({
          ...payload,
          password: form.password,
        });
        showToast(`Account "${form.name}" created successfully!`);
      }

      setShowCreateModal(false);
      setEditingAgent(null);
      setForm({
        name: '',
        phone: '',
        email: '',
        password: '',
        role: 'field_agent',
        employeeCode: '',
        notes: '',
      });
      loadAgents();
      loadDashboard();
    } catch (err) {
      setCreateError(err.message || 'Could not save account');
    } finally {
      setSaving(false);
    }
  };

  const filteredAgents = agents.filter((ag) => {
    if (!agentSearch) return true;
    const term = agentSearch.toLowerCase();
    return (
      ag.name?.toLowerCase().includes(term) ||
      ag.phone?.includes(term) ||
      ag.email?.toLowerCase().includes(term) ||
      ag.employeeCode?.toLowerCase().includes(term) ||
      ag.region?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredAgents.length / limit) || 1;
  const paginatedAgents = filteredAgents.slice((page - 1) * limit, page * limit);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-left">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-5 py-3 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 border ${
              toastMessage.type === 'error'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {toastMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5 shrink-0">
          <div className="w-10 h-10 rounded-full border border-blue-100 bg-blue-50/50 flex items-center justify-center p-1 shadow-2xs">
            <img src="/logo.png" alt="Tirvona Logo" className="h-6 w-auto object-contain" />
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#0F172A] leading-tight tracking-tight">{t('Tirvona')}</div>
            <div className="text-[10px] font-semibold text-[#0A4DA6] uppercase tracking-wider mt-0.5">
              {t('Field Supervisor')}
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center relative flex-1 max-w-xl mx-4 lg:mx-8">
          <div className="relative w-full">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A4DA6]" />
            <input
              type="text"
              placeholder={`${t('Search pages, agents, ashrams, leads in')} ${supervisor?.district || 'district'}...`}
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              className="w-full pl-10 pr-16 py-2 bg-gradient-to-r from-blue-50/10 to-gray-50/30 border border-amber-200/80 hover:border-amber-300 focus:border-[#0A4DA6] rounded-full text-xs font-semibold text-[#0B192C] placeholder:text-gray-400 focus:outline-none transition-all shadow-2xs"
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded shadow-3xs pointer-events-none">
              Ctrl K
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          
          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => {
                setLangDropdownOpen(!langDropdownOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#0A4DA6] bg-gray-50/80 hover:bg-blue-50/50 border border-gray-200 rounded-full transition-colors cursor-pointer"
              title={t('Select Language')}
            >
              <Globe size={13} className="text-slate-500" />
              <span>{selectedLanguage}</span>
              <ChevronDown size={11} className={`text-gray-400 transition-transform duration-200 ${langDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-2xl p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  {t('Select Language')}
                </div>
                {[
                  { code: 'EN', name: 'English', flag: '🇬🇧' },
                  { code: 'HI', name: 'हिन्दी', flag: '🇮🇳' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLanguage(lang.code);
                      setLangDropdownOpen(false);
                      showToast(`Language switched to ${lang.name}`);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      selectedLanguage === lang.code
                        ? 'bg-blue-50 text-[#0A4DA6]'
                        : 'text-slate-700 hover:bg-gray-50 hover:text-[#0B192C]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </div>
                    {selectedLanguage === lang.code && <Check size={14} className="text-[#0A4DA6]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setLangDropdownOpen(false);
              }}
              className={`w-8 h-8 rounded-full border border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 flex items-center justify-center relative text-slate-600 transition-colors cursor-pointer ${
                notificationsOpen ? 'bg-blue-50 border-[#0A4DA6]' : ''
              }`}
              title={t('Notifications')}
            >
              <Bell size={14} />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-xs">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-3xl p-4 shadow-2xl z-50 space-y-3 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#0B192C] uppercase tracking-wider">{t('Notifications')}</span>
                    {unreadNotifCount > 0 && (
                      <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        {unreadNotifCount} {t('New')}
                      </span>
                    )}
                  </div>
                  {unreadNotifCount > 0 && (
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-[11px] font-bold text-[#0A4DA6] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <CheckCheck size={13} />
                      <span>{t('Mark all as read')}</span>
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 space-y-1">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-2.5 rounded-2xl transition-colors cursor-pointer ${
                        notif.unread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, unread: false } : n));
                        if (notif.type === 'agent') setActiveNav('agents');
                        if (notif.type === 'lead') setActiveNav('dashboard');
                        setNotificationsOpen(false);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-black text-[#0B192C] flex items-center gap-1.5">
                          {notif.unread && <span className="w-1.5 h-1.5 rounded-full bg-[#0A4DA6]" />}
                          <span>{t(notif.title)}</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 shrink-0">{notif.time}</span>
                      </div>
                      <p className="text-[11px] text-gray-600 font-medium mt-1 leading-snug">{notif.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-gray-100 text-center">
                  <span className="text-[10px] font-bold text-gray-400">
                    {t('Jurisdiction')}: {supervisor?.district || 'Ayodhya'}, {supervisor?.state || 'Uttar Pradesh'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenFieldPortal && onOpenFieldPortal(null)}
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-extrabold transition-all shadow-xs cursor-pointer"
            title={t('Lead Portal')}
          >
            <Globe size={13} />
            <span>{t('Lead Portal')}</span>
            <ArrowRight size={13} />
          </button>

          <button
            onClick={onLogout}
            className="px-3.5 py-2 text-xs font-bold text-gray-700 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 rounded-full flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title={t('Sign Out')}
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">{t('Sign Out')}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-5 sm:gap-6 text-left">
        
        <aside className="space-y-4 sm:space-y-5">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs space-y-1.5">
            <div className="px-3 py-1.5 text-xs font-bold text-[#64748B] tracking-wider uppercase">
              {t('LEAD COLLECTION')}
            </div>

            <button
              onClick={() => {
                setActiveNav('dashboard');
                setSelectedAgentId(null);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeNav === 'dashboard'
                  ? 'bg-[#0A4DA6] text-white shadow-xs font-extrabold'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              }`}
            >
              <LayoutDashboard size={17} />
              <span>{t('Overview')}</span>
            </button>

            <button
              onClick={() => {
                setActiveNav('agents');
                setSelectedAgentId(null);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeNav === 'agents' || activeNav === 'agent-detail'
                  ? 'bg-[#0A4DA6] text-white shadow-xs font-extrabold'
                  : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={17} />
                <span>{t('Field Agents')}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeNav === 'agents' || activeNav === 'agent-detail'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-50 text-[#0A4DA6]'
                }`}
              >
                {agents.length}
              </span>
            </button>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#0F172A] uppercase tracking-wider">
              <ShieldCheck size={16} className="text-[#0A4DA6]" />
              <span>{t('Jurisdiction')}</span>
            </div>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                <span className="text-[#64748B] font-medium">{t('District')}</span>
                <span className="font-extrabold text-[#0A4DA6] capitalize">{supervisor?.district}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#E2E8F0]">
                <span className="text-[#64748B] font-medium">{t('State')}</span>
                <span className="font-extrabold text-[#0F172A] capitalize">{supervisor?.state}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#64748B] font-medium">{t('Role')}</span>
                <span className="font-extrabold text-emerald-700">{t('Supervisor')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-4 shadow-xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0A4DA6] flex items-center justify-center font-extrabold text-sm shrink-0">
              {supervisor?.name?.slice(0, 2).toUpperCase() || 'SP'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs sm:text-sm font-extrabold text-[#0F172A] truncate">{supervisor?.name}</div>
              <div className="text-xs font-medium text-[#64748B] truncate">{supervisor?.phone}</div>
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          
          {(activeNav === 'agents' || !activeNav) && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#0A4DA6] flex items-center justify-center shrink-0">
                    <Users size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-base sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                        {t('Field Agents')}
                      </h1>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200/80">
                        {t('LEAD COLLECTION')}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#64748B] font-medium mt-0.5">
                      Accounts that sign in to the Tirvona lead app to capture ashram leads in {supervisor?.district}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-5 py-2.5 sm:px-6 sm:py-3 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <Plus size={16} />
                    <span>{t('Create Field Agent')}</span>
                  </button>
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs">
                <div className="relative w-full lg:w-[420px]">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    placeholder={t('Search field agents by name, phone, code...')}
                    value={agentSearch}
                    onChange={(e) => {
                      setAgentSearch(e.target.value);
                      setPage(1);
                    }}
                    className="w-full min-h-[44px] pl-11 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]"
                  />
                </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs">
                {loadingAgents ? (
                  <div className="p-16 flex flex-col items-center gap-3 text-[#64748B]">
                    <Loader2 size={26} className="animate-spin text-[#0A4DA6]" />
                    <span className="text-xs sm:text-sm font-bold">Loading field agents…</span>
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div className="p-16 flex flex-col items-center gap-2 text-[#64748B] text-center">
                    <Users size={32} className="text-slate-300 mb-1" />
                    <span className="text-base font-extrabold text-[#0F172A]">{t('No field agents found')}</span>
                    <span className="text-xs sm:text-sm font-medium text-center max-w-sm text-[#64748B]">
                      Create an account here and share the phone number and password with the agent — they sign in to the lead app with those.
                    </span>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 px-6 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs sm:text-sm font-extrabold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                    >
                      <Plus size={16} />
                      <span>{t('Create Field Agent')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr className="text-xs font-bold text-[#64748B] tracking-wider uppercase">
                          <th className="px-6 py-4">{t('Agent')}</th>
                          <th className="px-6 py-4">{t('Phone')}</th>
                          <th className="px-6 py-4">{t('Role')}</th>
                          <th className="px-6 py-4">{t('Region')}</th>
                          <th className="px-6 py-4">{t('Leads')}</th>
                          <th className="px-6 py-4">{t('Last Login')}</th>
                          <th className="px-6 py-4">{t('Status')}</th>
                          <th className="px-6 py-4 text-right">{t('Actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {paginatedAgents.map((agent) => (
                          <tr
                            key={agent._id}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div
                                onClick={() => handleOpenAgent(agent._id)}
                                className="text-xs sm:text-sm font-extrabold text-[#0F172A] hover:text-[#0A4DA6] cursor-pointer transition-colors"
                              >
                                {agent.name}
                              </div>
                              <div className="text-xs font-medium text-[#64748B] mt-0.5">
                                {agent.email || agent.employeeCode || '—'}
                              </div>
                            </td>

                            <td className="px-6 py-4 text-xs sm:text-sm font-semibold text-[#0F172A]">
                              {agent.phone}
                            </td>

                            <td className="px-6 py-4 text-xs sm:text-sm font-medium text-[#64748B] capitalize">
                              {agent.role === 'lead_executive' ? t('Lead Executive') : agent.role ? agent.role.replace(/_/g, ' ') : t('Field Agent')}
                            </td>

                            <td className="px-6 py-4 text-xs sm:text-sm font-medium text-[#64748B] capitalize">
                              {agent.region || `${agent.district || supervisor?.district}, ${agent.state || supervisor?.state}`}
                            </td>

                            <td className="px-6 py-4 text-xs sm:text-sm font-extrabold text-[#0A4DA6]">
                              <button
                                onClick={() => handleOpenAgent(agent._id)}
                                className="hover:underline cursor-pointer"
                              >
                                {agent.leadCount ?? 0}
                              </button>
                            </td>

                            <td className="px-6 py-4 text-xs font-medium text-[#64748B]">
                              {agent.lastLoginAt ? formatDate(agent.lastLoginAt) : 'Never'}
                            </td>

                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                <CheckCircle2 size={13} />
                                <span className="capitalize">{agent.status || 'Active'}</span>
                              </span>
                            </td>

                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  title={t('Edit')}
                                  onClick={() => openEdit(agent)}
                                  className="p-2 rounded-xl text-[#0A4DA6] hover:bg-blue-50 cursor-pointer transition-colors"
                                >
                                  <Pencil size={15} />
                                </button>

                                <button
                                  title={t('Reset Password')}
                                  onClick={() => {
                                    setNewPassword('');
                                    setResettingAgent(agent);
                                  }}
                                  className="p-2 rounded-xl text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors"
                                >
                                  <KeyRound size={15} />
                                </button>

                                <button
                                  title={agent.status === 'active' ? t('Suspend') : t('Activate')}
                                  disabled={saving}
                                  onClick={() => handleToggleStatus(agent)}
                                  className={`p-2 rounded-xl cursor-pointer transition-colors disabled:opacity-40 ${
                                    agent.status === 'active'
                                      ? 'text-[#64748B] hover:bg-slate-100'
                                      : 'text-emerald-600 hover:bg-emerald-50'
                                  }`}
                                >
                                  {agent.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                                </button>

                                <button
                                  title={t('Delete')}
                                  onClick={() => setConfirmDeleteAgent(agent)}
                                  className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                                >
                                  <Trash2 size={15} />
                                </button>

                                <button
                                  onClick={() => handleOpenAgent(agent._id)}
                                  title={t('View Details')}
                                  className="p-2 rounded-xl text-slate-400 hover:text-[#0A4DA6] hover:bg-blue-50 cursor-pointer transition-colors"
                                >
                                  <Eye size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {!loadingAgents && filteredAgents.length > 0 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]/50">
                    <span className="text-xs sm:text-sm font-medium text-[#64748B]">
                      Showing {(page - 1) * limit + 1}–{Math.min(page * limit, filteredAgents.length)} of {filteredAgents.length}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-5 py-2 bg-white border border-[#E2E8F0] rounded-full text-xs sm:text-sm font-bold text-[#64748B] hover:text-[#0A4DA6] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                      >
                        Previous
                      </button>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-5 py-2 bg-white border border-[#E2E8F0] rounded-full text-xs sm:text-sm font-bold text-[#64748B] hover:text-[#0A4DA6] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeNav === 'dashboard' && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200/80 rounded-full text-xs font-bold text-amber-900 mb-2 capitalize">
                    <MapPin size={13} className="text-[#E58C28]" />
                    {supervisor?.district} Command
                  </div>
                  <h1 className="text-xl font-extrabold text-[#0F172A]">{t('Overview')}</h1>
                  <p className="text-xs text-[#64748B] font-medium mt-0.5">
                    Real-time metrics for ashram verification in {supervisor?.district}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 shadow-xs">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('Total Field Agents')}</div>
                  <div className="text-2xl font-extrabold text-[#0F172A] mt-2">{dashboardData?.totalAgents ?? agents.length}</div>
                  <div className="text-[10px] font-medium text-[#64748B] mt-1">In {supervisor?.district}</div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 shadow-xs">
                  <div className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">{t('Total Leads Captured')}</div>
                  <div className="text-2xl font-extrabold text-[#0A4DA6] mt-2">{dashboardData?.total ?? 0}</div>
                  <div className="text-[10px] font-medium text-[#64748B] mt-1">Captured leads</div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 shadow-xs">
                  <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">{t('Pending Review')}</div>
                  <div className="text-2xl font-extrabold text-amber-600 mt-2">{dashboardData?.pending ?? 0}</div>
                  <div className="text-[10px] font-medium text-[#64748B] mt-1">Awaiting decision</div>
                </div>

                <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-5 shadow-xs">
                  <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">{t('Verified Ashrams')}</div>
                  <div className="text-2xl font-extrabold text-emerald-600 mt-2">{dashboardData?.approved ?? 0}</div>
                  <div className="text-[10px] font-medium text-[#64748B] mt-1">Verified ashrams</div>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'agent-detail' && (
            <div className="space-y-5">
              <button
                onClick={() => setActiveNav('agents')}
                className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0A4DA6] hover:underline cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>{t('Field Agents')}</span>
              </button>

              {loadingAgentDetail ? (
                <div className="p-16 flex flex-col items-center gap-3 text-[#64748B]">
                  <Loader2 size={26} className="animate-spin text-[#0A4DA6]" />
                  <span className="text-xs font-bold">Loading agent details…</span>
                </div>
              ) : (
                <>
                  <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-6 shadow-xs">
                    <div className="flex items-center gap-4 pb-4 border-b border-[#E2E8F0]">
                      <div className="w-12 h-12 rounded-2xl bg-[#0A4DA6] text-white flex items-center justify-center font-extrabold text-base">
                        {agentDetail?.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold text-[#0F172A]">{agentDetail?.name}</h2>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 uppercase">
                            {agentDetail?.status || 'active'}
                          </span>
                        </div>
                        <div className="text-xs text-[#64748B] font-medium mt-0.5">
                          {agentDetail?.phone} · {agentDetail?.district || supervisor?.district}, {agentDetail?.state || supervisor?.state}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase block">{t('Email')}</span>
                        <span className="font-extrabold text-[#0F172A]">{agentDetail?.email || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase block">{t('Employee Code')}</span>
                        <span className="font-extrabold text-[#0F172A]">{agentDetail?.employeeCode || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase block">{t('Total Leads')}</span>
                        <span className="font-extrabold text-[#0A4DA6]">{agentDetail?.stats?.total ?? agentLeads.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase block">{t('Last Login')}</span>
                        <span className="font-extrabold text-[#0F172A]">{agentDetail?.lastLoginAt ? formatDate(agentDetail.lastLoginAt) : 'Never'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-extrabold text-[#0F172A]">{t('Captured Leads')} ({agentLeads.length})</h3>

                    {agentLeads.length === 0 ? (
                      <div className="p-10 text-center text-[#64748B] text-xs font-medium">
                        {t('No captured leads found for this agent')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {agentLeads.map((ld) => (
                          <div
                            key={ld._id}
                            onClick={() => setSelectedLead(ld)}
                            className="p-5 bg-white hover:bg-slate-50/70 border border-[#E2E8F0] hover:border-amber-300 rounded-2xl cursor-pointer transition-all flex flex-col justify-between shadow-2xs"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-extrabold text-[#0F172A] truncate">{ld.name}</span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200/80">
                                  {ld.status}
                                </span>
                              </div>
                              <div className="text-xs text-[#64748B] font-medium truncate">
                                {ld.location?.city || ld.location?.address || '—'}
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-[#E2E8F0] text-xs text-[#64748B] flex justify-between items-center font-medium">
                              <span>{formatDate(ld.capturedAt || ld.createdAt)}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenFieldPortal && onOpenFieldPortal(ld);
                                  }}
                                  className="text-[#0A4DA6] font-extrabold hover:underline cursor-pointer"
                                >
                                  {t('Open in Form')}
                                </button>
                                <span className="text-slate-300">·</span>
                                <span className="text-[#64748B] font-bold">{t('View')}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </main>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#E2E8F0] w-full max-w-2xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 space-y-5 text-left shadow-2xl animate-scaleUp relative overflow-hidden">
            
            <div className="flex justify-between items-start border-b border-[#E2E8F0] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0A4DA6] flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-[#0F172A] leading-tight">
                    {editingAgent ? t('Edit') + ' ' + t('Field Agent') : t('Create Field Agent')}
                  </h3>
                  <p className="text-xs text-[#64748B] font-medium mt-0.5">
                    Signs in to the lead app with phone number and password.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingAgent(null);
                }}
                className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAgent} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">{t('Full Name')} *</label>
                  <input
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">{t('Mobile Number')} *</label>
                  <input
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]"
                    value={form.phone}
                    maxLength={10}
                    onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    required
                  />
                  <p className="text-[11px] text-[#64748B] font-medium">Used as the sign-in handle.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">{t('Email')}</label>
                  <input
                    type="email"
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                {!editingAgent && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">{t('Password')} *</label>
                    <input
                      type="password"
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                    <p className="text-[11px] text-[#64748B] font-medium">Minimum 8 characters.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">{t('Role')} *</label>
                  <select
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all cursor-pointer"
                    value={form.role || 'field_agent'}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="field_agent">{t('Field Agent')}</option>
                    <option value="lead_executive">{t('Lead Executive')}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">{t('Region')} *</label>
                  <select
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:border-[#0A4DA6] transition-all cursor-not-allowed"
                    disabled
                  >
                    <option>{supervisor?.state || 'Uttar Pradesh'} — {supervisor?.district || 'Ayodhya'}</option>
                  </select>
                  <p className="text-[11px] text-[#64748B] font-medium">The agent is restricted to this state and district.</p>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">{t('Employee Code')}</label>
                  <input
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]"
                    value={form.employeeCode}
                    onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">INTERNAL NOTES</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6] transition-all placeholder:text-[#94A3B8]"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingAgent(null);
                  }}
                  className="rounded-full font-extrabold px-6 py-2.5 text-xs border border-[#E2E8F0] text-[#64748B] bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full font-extrabold px-6 py-2.5 text-xs bg-[#0A4DA6] hover:bg-[#083D85] text-white shadow-md shadow-[#0A4DA6]/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? t('Saving') : editingAgent ? t('Save') : t('Create Field Agent')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resettingAgent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#E2E8F0] w-full max-w-md rounded-2xl sm:rounded-3xl p-6 space-y-4 text-left shadow-2xl animate-scaleUp relative overflow-hidden">
            <div className="flex justify-between items-start border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <KeyRound size={17} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0F172A]">{t('Reset Password')}</h3>
                  <p className="text-xs text-[#64748B] font-medium">{resettingAgent?.name} will be signed out.</p>
                </div>
              </div>
              <button
                onClick={() => setResettingAgent(null)}
                className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#475569] block tracking-wider uppercase">{t('New Password')} *</label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0A4DA6]/20 focus:border-[#0A4DA6]"
                  required
                />
                <p className="text-[11px] text-[#64748B] font-medium">Share this with the agent directly.</p>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResettingAgent(null)}
                  className="px-5 py-2 rounded-full text-xs font-extrabold border border-[#E2E8F0] text-[#64748B] bg-white hover:bg-slate-50 cursor-pointer"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-full text-xs font-extrabold bg-[#0A4DA6] hover:bg-[#083D85] text-white shadow-md shadow-[#0A4DA6]/20 cursor-pointer disabled:opacity-50"
                >
                  {saving ? t('Saving') : t('Reset Password')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDeleteAgent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-[#E2E8F0] w-full max-w-md rounded-2xl sm:rounded-3xl p-6 space-y-4 text-left shadow-2xl animate-scaleUp relative overflow-hidden">
            <div className="flex justify-between items-start border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 size={17} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0F172A]">{t('Delete')} {t('Field Agent')}?</h3>
                  <p className="text-xs text-[#64748B] font-medium">Their captured leads are kept.</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmDeleteAgent(null)}
                className="p-1.5 text-[#64748B] hover:text-[#0F172A] rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs font-medium text-[#64748B]">
              <span className="font-extrabold text-[#0F172A]">{confirmDeleteAgent.name}</span> will lose access to the lead app immediately. The {confirmDeleteAgent.leadCount ?? 0} lead(s) they captured stay in the system, attributed to their name.
            </p>

            <div className="pt-3 border-t border-[#E2E8F0] flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConfirmDeleteAgent(null)}
                className="px-5 py-2 rounded-full font-extrabold border border-[#E2E8F0] text-[#64748B] bg-white hover:bg-slate-50 cursor-pointer"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDeleteAgent}
                className="px-5 py-2 rounded-full font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {saving ? t('Saving') : t('Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl p-6 sm:p-8 w-full max-w-xl shadow-2xl relative animate-scaleUp text-left max-h-[90vh] overflow-y-auto space-y-4">
            <button
              onClick={() => setSelectedLead(null)}
              className="absolute top-4 right-4 p-2 text-[#64748B] hover:text-[#0F172A] rounded-full hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200/80">
                  {selectedLead.status || 'Pending'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-[#0A4DA6] border border-blue-200/80">
                  {selectedLead.interest || 'Interested'}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-[#0F172A]">{selectedLead.name}</h2>
              <p className="text-xs text-[#64748B] font-medium flex items-center gap-1 mt-0.5">
                <MapPin size={12} className="text-[#0A4DA6]" />
                {selectedLead.location?.address ? `${selectedLead.location.address}, ` : ''}
                {selectedLead.location?.city || selectedLead.city}, {selectedLead.location?.district || selectedLead.district || supervisor?.district}, {selectedLead.location?.state || selectedLead.state || supervisor?.state}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-[#F8FAFC] rounded-2xl text-xs border border-[#E2E8F0]">
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block uppercase">TOTAL ROOMS</span>
                <span className="font-extrabold text-[#0F172A]">{selectedLead.roomInventory?.totalRooms ?? selectedLead.totalRooms ?? '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block uppercase">PRICE / NIGHT</span>
                <span className="font-extrabold text-emerald-700">{selectedLead.roomInventory?.roomPrice ? `₹${selectedLead.roomInventory.roomPrice}` : selectedLead.roomPrice ? `₹${selectedLead.roomPrice}` : '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block uppercase">ONLINE ROOMS</span>
                <span className="font-extrabold text-[#0F172A]">{selectedLead.roomInventory?.onlineRooms ?? selectedLead.onlineRooms ?? '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block uppercase">OFFLINE ROOMS</span>
                <span className="font-extrabold text-[#0F172A]">{selectedLead.roomInventory?.offlineRooms ?? selectedLead.offlineRooms ?? '—'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-[#F8FAFC] rounded-2xl text-xs border border-[#E2E8F0]">
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block uppercase">OWNER / MANAGER</span>
                <span className="font-extrabold text-[#0F172A]">{selectedLead.contact?.ownerName || selectedLead.ownerName || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#64748B] block uppercase">CONTACT PHONE</span>
                <span className="font-extrabold text-[#0A4DA6]">{selectedLead.contact?.phone || selectedLead.phone || '—'}</span>
              </div>
            </div>

            {selectedLead.meeting?.requested && (
              <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs">
                <span className="text-[10px] font-bold text-[#0A4DA6] uppercase block">MEETING REQUESTED</span>
                <div className="text-[#0F172A] font-medium mt-0.5">
                  Mode: <span className="font-bold">{selectedLead.meeting?.mode || 'Call'}</span>
                  {selectedLead.meeting?.time && ` · Time: ${selectedLead.meeting.time}`}
                </div>
              </div>
            )}

            {selectedLead.notes && (
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">INTERNAL NOTES</span>
                <p className="p-3.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-[#0F172A] font-medium leading-relaxed">{selectedLead.notes}</p>
              </div>
            )}

            {Array.isArray(selectedLead.images) && selectedLead.images.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-bold text-[#64748B] uppercase">ATTACHED PHOTOS ({selectedLead.images.length})</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {selectedLead.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt="Ashram inspection"
                      className="w-full h-16 object-cover rounded-xl border border-[#E2E8F0]"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0]">
              <button
                onClick={() => setSelectedLead(null)}
                className="px-5 py-2.5 bg-white border border-[#E2E8F0] hover:bg-slate-50 text-[#64748B] rounded-full text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                {t('Close')}
              </button>

              <button
                type="button"
                onClick={() => {
                  const leadToEdit = selectedLead;
                  setSelectedLead(null);
                  if (onOpenFieldPortal) onOpenFieldPortal(leadToEdit);
                }}
                className="px-6 py-2.5 bg-[#0A4DA6] hover:bg-[#083D85] text-white rounded-full text-xs font-extrabold shadow-md shadow-[#0A4DA6]/20 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                <span>{t('Open in Form')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

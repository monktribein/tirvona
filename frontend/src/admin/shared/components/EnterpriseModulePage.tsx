import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import EnterpriseDataTable, { type TableColumn } from './EnterpriseDataTable';
import { useNotifications } from '../../../contexts/NotificationContext';
import api, { getErrorMessage } from '../../../lib/api';
import {
  Image,
  FileText,
  Tag as TagIcon,
  ShoppingBag,
  Compass,
  Building,
  Bed,
  Calendar,
  BarChart3,
  Users,
  ShieldCheck,
  Check,
  X,
  Plus,
  Sparkles,
  XCircle,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface CmsRequest {
  _id: string;
  page: string;
  section: string;
  title: string;
  oldValue: any;
  newValue: any;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  userId?: { name: string; email: string; phone: string; role: string };
}

export const EnterpriseModulePage: React.FC<{ moduleName?: string; defaultColumns?: TableColumn[] }> = ({
  moduleName,
  defaultColumns,
}) => {
  const params = useParams<{ moduleKey?: string; subKey?: string }>();
  const activeModule = moduleName || params.moduleKey || 'users';
  const activeSubKey = params.subKey || '';

  const { addNotification } = useNotifications();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pending CMS Approval Requests State
  const [pendingCmsRequests, setPendingCmsRequests] = useState<CmsRequest[]>([]);
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Form Modal State for Specific Module Editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const formatTitle = (str: string) =>
    str
      .replace(/-/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

  const title = `${formatTitle(activeModule)}${activeSubKey ? ` — ${formatTitle(activeSubKey)}` : ''}`;

  useEffect(() => {
    fetchModuleData();
    if (activeModule === 'banner') {
      fetchPendingCmsRequests();
    }
  }, [activeModule, activeSubKey]);

  const fetchPendingCmsRequests = async () => {
    try {
      const res = await api.get('/cms/pending-approvals');
      if (res.data?.success) {
        setPendingCmsRequests(res.data.data);
      }
    } catch (err) {
      console.warn('Fetch CMS pending error:', err);
    }
  };

  const handleApproveCms = async (id: string) => {
    try {
      const res = await api.post(`/cms/approve/${id}`, {});
      if (res.data?.success) {
        addNotification('CMS Content Approved', 'The proposed banner/content is now published live!', 'success');
        fetchPendingCmsRequests();
        fetchModuleData();
      }
    } catch (err) {
      addNotification('Action Failed', getErrorMessage(err, 'Could not approve CMS content edit.'), 'error');
    }
  };

  const handleRejectCms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionModalId) return;

    try {
      const res = await api.post(`/cms/reject/${rejectionModalId}`, { reason: rejectionReason });
      if (res.data?.success) {
        addNotification('Request Rejected', 'Feedback has been sent back to BannerBoy.', 'warning');
        setRejectionModalId(null);
        setRejectionReason('');
        fetchPendingCmsRequests();
      }
    } catch (err) {
      addNotification('Action Failed', getErrorMessage(err, 'Could not reject CMS request.'), 'error');
    }
  };

  const handleDeleteCms = async (id: string) => {
    try {
      const res = await api.delete(`/cms/request/${id}`);
      if (res.data?.success) {
        addNotification('Deleted & Reverted', 'Request removed. Reverted to default system image & text.', 'info');
        fetchPendingCmsRequests();
      }
    } catch (err) {
      addNotification('Delete Failed', getErrorMessage(err, 'Could not delete request.'), 'error');
    }
  };

  const fetchModuleData = async () => {
    setLoading(true);
    try {
      // Must go through the shared `api` client: /admin/crud is authenticated,
      // and raw axios sends no Authorization header (it would 401).
      const endpoint = `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ''}`;
      const res = await api.get(endpoint);
      if (res.data?.success) {
        setData(res.data.data || []);
      } else {
        setData(generateFallbackData());
      }
    } catch (err) {
      console.warn(`API load for ${activeModule}:`, err);
      setData(generateFallbackData());
    } finally {
      setLoading(false);
    }
  };

  const generateFallbackData = () => {
    const list = [];
    for (let i = 1; i <= 8; i++) {
      list.push({
        _id: `rec_${i}`,
        title: `Sample ${formatTitle(activeModule)} Item #${i}`,
        category: i % 2 === 0 ? 'Homepage' : 'Special Event',
        deviceType: 'All Devices',
        priorityOrder: i,
        status: i % 3 === 0 ? 'pending' : 'active',
        createdAt: new Date().toISOString(),
      });
    }
    return list;
  };

  // Custom Form & Column Definitions per Feature Area
  const getModuleConfig = () => {
    switch (activeModule) {
      case 'banner':
        return {
          icon: <Image size={20} className="text-[#0A4DA6]" />,
          columns: [
            { key: 'title', label: 'Banner Title' },
            { key: 'category', label: 'Placement Category' },
            { key: 'deviceType', label: 'Device Target' },
            { key: 'priorityOrder', label: 'Priority' },
            { key: 'status', label: 'Approval Status' },
          ],
          fields: [
            { name: 'title', label: 'Banner Title', type: 'text', required: true },
            { name: 'subtitle', label: 'Subtitle / Caption', type: 'text' },
            {
              name: 'category',
              label: 'Placement Category',
              type: 'select',
              options: ['homepage', 'hero_slider', 'offers', 'blog', 'marketplace', 'destination', 'festival', 'mobile', 'desktop'],
            },
            { name: 'imageUrl', label: 'Banner Image URL / Cloudinary', type: 'text', required: true },
            { name: 'targetUrl', label: 'Target Action Link', type: 'text' },
            { name: 'priorityOrder', label: 'Display Order Priority', type: 'number' },
            { name: 'status', label: 'Status', type: 'select', options: ['active', 'pending', 'approved', 'rejected', 'scheduled'] },
          ],
        };

      default:
        return {
          icon: <Building size={20} className="text-[#0A4DA6]" />,
          columns: defaultColumns || [
            { key: 'name', label: 'Record Name / Title' },
            { key: 'category', label: 'Category / Tag' },
            { key: 'owner', label: 'Managed By' },
            { key: 'status', label: 'Status' },
          ],
          fields: [
            { name: 'name', label: 'Record Name', type: 'text', required: true },
            { name: 'category', label: 'Category', type: 'text' },
            { name: 'details', label: 'Description', type: 'textarea' },
            { name: 'status', label: 'Status', type: 'select', options: ['active', 'pending', 'archived'] },
          ],
        };
    }
  };

  const moduleConfig = getModuleConfig();

  const handleEditOpen = (item: any) => {
    setEditingItem(item);
    setFormData(item);
    setIsModalOpen(true);
  };

  const handleCreateOpen = () => {
    setEditingItem(null);
    setFormData({});
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = `/admin/crud/${activeModule}${activeSubKey ? `?subKey=${activeSubKey}` : ''}`;
      await api.post(endpoint, formData);
      addNotification('Saved Successfully', `Record updated in ${title}.`, 'success');
      setIsModalOpen(false);
      fetchModuleData();
    } catch (err) {
      // Report the real failure — a rejected save (e.g. 403 on a privileged
      // field) must not be painted over with a local-only "success".
      addNotification('Save Failed', getErrorMessage(err, `Could not save this ${title} record.`), 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/admin/crud/${activeModule}/${id}`);
      addNotification('Deleted', 'Record removed.', 'info');
      setData((prev) => prev.filter((x) => x._id !== id));
    } catch (err) {
      // Keep the row on screen if the server refused the delete.
      addNotification('Delete Failed', getErrorMessage(err, 'Could not remove this record.'), 'error');
    }
  };

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-12">
      {/* Page Module Banner Header */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-6 rounded-[28px] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#0A4DA6]/10 rounded-2xl">{moduleConfig.icon}</div>
          <div>
            <h2 className="text-xl font-black text-[#0B192C] dark:text-white tracking-tight">{title}</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">
              Enterprise administration, lifecycle controls, and status monitoring console.
            </p>
          </div>
        </div>

        <button
          onClick={handleCreateOpen}
          className="px-5 py-2.5 bg-[#0A4DA6] hover:bg-[#083b80] text-white rounded-full text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-[#0A4DA6]/25 cursor-pointer"
        >
          <Plus size={16} /> Add New Entry
        </button>
      </div>

      {/* ── Banner Management: Real-Time BannerBoy Pending Approvals Console ── */}
      {activeModule === 'banner' && (
        <div className="bg-white dark:bg-[#0B192C] border border-amber-200 dark:border-amber-900/50 p-6 rounded-[28px] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                  BannerBoy CMS Pending Approvals Queue
                </h3>
                <p className="text-xs text-gray-400">Review proposed banner edits submitted by BannerBoy.</p>
              </div>
            </div>

            <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-full text-xs font-black">
              {pendingCmsRequests.length} Request{pendingCmsRequests.length === 1 ? '' : 's'} Pending
            </span>
          </div>

          {pendingCmsRequests.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400 font-medium">
              No pending banner change requests found.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCmsRequests.map((req) => (
                <div
                  key={req._id}
                  className="p-4 bg-amber-50/40 dark:bg-slate-900/60 border border-amber-200/60 dark:border-slate-800 rounded-2xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-sm text-[#0B192C] dark:text-white">{req.title}</span>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2">
                        <span>Submitted by: <strong>{req.userId?.name || 'BannerBoy'}</strong> ({req.userId?.email})</span>
                        <span>•</span>
                        <span>Section: <code className="font-bold text-amber-700 dark:text-amber-300">{req.section}</code></span>
                      </div>
                    </div>

                    <span className="text-[10px] text-gray-400 font-mono">
                      {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Side-by-Side Old vs New Preview */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl space-y-1">
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider block">
                        Current Live Version (Old)
                      </span>
                      <pre className="text-[11px] text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-24">
                        {JSON.stringify(req.oldValue || { note: 'Default system content' }, null, 2)}
                      </pre>
                    </div>

                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                          Proposed BannerBoy Version (New)
                        </span>
                        {req.newValue?.bannerWidth && (
                          <span className="px-2 py-0.5 bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 rounded text-[9px] font-mono font-bold">
                            {req.newValue.bannerWidth} × {req.newValue.bannerHeight} px ({req.newValue.bannerSizePreset || 'Custom'})
                          </span>
                        )}
                      </div>

                      {req.newValue?.bannerImage && (
                        <div className="w-full h-28 rounded-lg overflow-hidden border border-emerald-200 dark:border-emerald-800 bg-gray-100 dark:bg-slate-900">
                          <img
                            src={req.newValue.bannerImage}
                            alt="Proposed Banner"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <pre className="text-[11px] text-emerald-900 dark:text-emerald-200 font-mono whitespace-pre-wrap overflow-x-auto max-h-24">
                        {JSON.stringify(req.newValue, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setRejectionModalId(req._id);
                        setRejectionReason('');
                      }}
                      className="px-4 py-2 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-200 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <XCircle size={14} /> Reject & Request Changes
                    </button>

                    <button
                      onClick={() => handleApproveCms(req._id)}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1"
                    >
                      <ShieldCheck size={14} /> Approve & Publish Live
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModalId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRejectCms}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <h3 className="font-extrabold text-base text-rose-600 flex items-center gap-2">
              <XCircle size={18} /> Reject Proposed Content Change
            </h3>
            <div className="space-y-1 text-xs">
              <label className="font-bold text-gray-700 dark:text-gray-300">Feedback / Reason for Rejection *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Please update hero image resolution and revise discount details..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModalId(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-full font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-rose-600 text-white rounded-full font-extrabold text-xs shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Module Table Data */}
      <EnterpriseDataTable
        title={title}
        columns={moduleConfig.columns}
        data={data}
        loading={loading}
        onSave={(item) => handleEditOpen(item)}
        onDelete={(id) => handleDelete(id)}
      />

      {/* Dedicated Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-lg w-full rounded-[28px] p-6 space-y-5 text-left shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white flex items-center gap-2">
                <Sparkles size={18} className="text-[#0A4DA6]" /> {editingItem ? `Edit ${title}` : `Create ${title}`}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 text-xs">
              {moduleConfig.fields.map((f) => (
                <div key={f.name} className="space-y-1">
                  <label className="font-bold text-gray-700 dark:text-gray-300">
                    {f.label} {f.required && <span className="text-rose-500">*</span>}
                  </label>

                  {f.type === 'select' ? (
                    <select
                      value={formData[f.name] || (f.options ? f.options[0] : '')}
                      onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl font-bold text-[#0A4DA6]"
                    >
                      {f.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt.replace(/_/g, ' ').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={formData[f.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                    />
                  ) : (
                    <input
                      type={f.type}
                      required={f.required}
                      value={formData[f.name] || ''}
                      onChange={(e) => setFormData({ ...formData, [f.name]: e.target.value })}
                      className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full font-black text-xs shadow cursor-pointer"
              >
                Save Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default EnterpriseModulePage;

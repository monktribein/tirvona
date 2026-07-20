import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Building2, 
  MapPin, 
  ShieldCheck, 
  FileCheck,
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStats();
  }, []);

  const fetchSystemStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/analytics/system`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('System stats load error:', err);
      // Fallback mocks
      setStats({
        ashrams: { total: 48, approved: 30, pending: 11, rejected: 7 },
        users: { pilgrims: 582, owners: 44 },
        financials: { revenue: 148200, cancellationRate: 4, totalBookings: 320, approvalRate: 81, monthlyInspections: [
          { month: 'May 2026', count: 15 },
          { month: 'June 2026', count: 22 },
          { month: 'July 2026', count: 28 }
        ] },
        popularDestinations: [
          { city: 'Rishikesh', count: 10 },
          { city: 'Haridwar', count: 10 },
          { city: 'Vrindavan', count: 10 },
        ],
        districtStats: [
          { district: 'Haridwar', approved: 10, pending: 2 },
          { district: 'Dehradun', approved: 10, pending: 4 },
          { district: 'Mathura', approved: 10, pending: 5 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 text-left">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Approved Verified Ashrams */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Verified Ashrams</span>
            <h3 className="text-2xl font-extrabold text-success">{stats?.ashrams?.approved || '0'}</h3>
            <span className="text-[9px] text-success font-semibold flex items-center gap-0.5"><CheckCircle size={10} /> Active retreats</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
        </div>

        {/* Pending Inspections */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pending Inspections</span>
            <h3 className="text-2xl font-extrabold text-[#0A4DA6]">{stats?.ashrams?.pending || '0'}</h3>
            <span className="text-[9px] text-gray-500 font-medium">Awaiting physical check</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0A4DA6]/10 text-[#0A4DA6] flex items-center justify-center">
            <FileCheck size={20} />
          </div>
        </div>

        {/* Rejected Ashrams */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rejected Listings</span>
            <h3 className="text-2xl font-extrabold text-danger">{stats?.ashrams?.rejected || '0'}</h3>
            <span className="text-[9px] text-danger font-medium">Failed compliance checks</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Government Approval Rate */}
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-5 rounded-[24px] shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Govt Approval Rate</span>
            <h3 className="text-2xl font-extrabold text-[#0B192C] dark:text-white">{stats?.financials?.approvalRate || '0'}%</h3>
            <span className="text-[9px] text-gray-500 font-medium">Of decided inspections</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Award size={20} />
          </div>
        </div>

      </div>

      {/* Main Grid: Hubs, Districts, Inspections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* District Statistics Table */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Building2 size={16} className="text-[#0A4DA6]" /> District-Level Onboarding Statistics
            </h3>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">District Name</th>
                    <th className="py-2.5 px-3 text-center">Verified Approved</th>
                    <th className="py-2.5 px-3 text-center">Pending Inspection</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.districtStats || []).map((dist: any, index: number) => (
                    <tr key={index} className="border-b border-gray-50 dark:border-slate-850 hover:bg-gray-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-3 font-semibold text-[#0B192C] dark:text-white">{dist.district}</td>
                      <td className="py-3 px-3 text-center text-success font-bold">{dist.approved}</td>
                      <td className="py-3 px-3 text-center text-[#0A4DA6] font-bold">{dist.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-gray-100 dark:divide-slate-800">
              {(stats?.districtStats || []).map((dist: any, index: number) => (
                <div key={index} className="py-3 flex justify-between items-center text-xs">
                  <span className="font-semibold text-[#0B192C] dark:text-white">{dist.district}</span>
                  <div className="flex gap-4">
                    <span className="text-success font-bold">Approved: {dist.approved}</span>
                    <span className="text-[#0A4DA6] font-bold">Pending: {dist.pending}</span>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Popular Cities Hub list */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
              <MapPin size={16} className="text-[#0A4DA6]" /> Top Spiritual Hubs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats?.popularDestinations?.map((dest: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-xl text-xs font-semibold">
                  <span className="text-[#0B192C] dark:text-white">{dest.city}</span>
                  <span className="px-2 py-0.5 bg-[#0A4DA6]/10 text-[#0A4DA6] rounded text-[9px] font-bold">{dest.count} Ashrams</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Monthly Inspections Progress */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0B192C] dark:text-white flex items-center gap-1.5 border-b border-gray-50 dark:border-slate-850 pb-3">
              <Calendar size={16} className="text-[#0A4DA6]" /> Monthly Inspections Performed
            </h3>
            <div className="space-y-4">
              {(stats?.financials?.monthlyInspections || []).map((ins: any, index: number) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-gray-505">
                    <span>{ins.month}</span>
                    <span>{ins.count} Inspections</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-850 rounded-full h-2">
                    <div 
                      className="bg-[#0A4DA6] h-2 rounded-full" 
                      style={{ width: `${Math.min(100, (ins.count / 30) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ministry Guidelines Notification Board */}
          <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-[#0B192C] dark:text-white">Ministry Guidelines Notification</h3>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/10 border border-yellow-100 text-xs text-yellow-750 leading-relaxed rounded-[16px]">
              <strong>[ATTENTION DISTRICT OFFICERS]:</strong> Please ensure physical inspections verify separate washrooms for women pilgrims and emergency medical kits are fully stocked before submitting approvals.
            </div>
            <div className="p-4 bg-[#0A4DA6]/5 rounded-[16px] border border-[#0A4DA6]/10 text-xs text-[#0A4DA6] leading-relaxed">
              <strong>[DIGITAL INDIA DIRECTIVE]:</strong> Standardize guest logbook integration by pushing local counter walk-ins straight into the reception check-in portal.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
export default AdminDashboard;

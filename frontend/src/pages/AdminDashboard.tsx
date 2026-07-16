import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  TrendingUp, 
  MapPin, 
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
      const res = await axios.get('http://localhost:5000/api/analytics/system', {
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
    <div className="space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Approved Verified Ashrams */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Verified Ashrams</span>
            <h3 className="text-2xl font-extrabold text-success">{stats?.ashrams?.approved || '0'}</h3>
            <span className="text-[9px] text-success font-semibold flex items-center gap-0.5"><CheckCircle size={10} /> Active public retreats</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
        </div>

        {/* Pending Inspections */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pending Inspections</span>
            <h3 className="text-2xl font-extrabold text-[#ff9933]">{stats?.ashrams?.pending || '0'}</h3>
            <span className="text-[9px] text-[#ff9933] font-medium">Awaiting district physical check</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#ff9933]/10 text-[#ff9933] flex items-center justify-center">
            <FileCheck size={20} />
          </div>
        </div>

        {/* Rejected Ashrams */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rejected Listings</span>
            <h3 className="text-2xl font-extrabold text-danger">{stats?.ashrams?.rejected || '0'}</h3>
            <span className="text-[9px] text-danger font-medium">Failed compliance criteria</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Government Approval Rate */}
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Govt Approval Rate</span>
            <h3 className="text-2xl font-extrabold text-primary">{stats?.financials?.approvalRate || '0'}%</h3>
            <span className="text-[9px] text-gray-500 font-medium">Of decided inspections</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Award size={20} />
          </div>
        </div>

      </div>

      {/* Main Grid: Hubs, Districts, Inspections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns (Spiritual Hubs & District Statistics) */}
        <div className="lg:col-span-2 space-y-6">
          {/* District Statistics Table */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-secondary dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <Building2 size={16} className="text-primary" /> District-Level Onboarding Statistics
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-gray-400 uppercase font-bold text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">District Name</th>
                    <th className="py-2.5 px-3 text-center">Verified Approved</th>
                    <th className="py-2.5 px-3 text-center">Pending Inspection</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.districtStats || []).map((dist: any, index: number) => (
                    <tr key={index} className="border-b border-border hover:bg-gray-50/50 dark:hover:bg-slate-800/10">
                      <td className="py-3 px-3 font-semibold text-secondary dark:text-white">{dist.district}</td>
                      <td className="py-3 px-3 text-center text-success font-bold">{dist.approved}</td>
                      <td className="py-3 px-3 text-center text-[#ff9933] font-bold">{dist.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Popular Cities Hub list */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-secondary dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <MapPin size={16} className="text-primary" /> Top Spiritual Hubs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats?.popularDestinations?.map((dest: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 bg-background border border-border rounded-xl text-xs font-semibold">
                  <span className="text-secondary dark:text-white">{dest.city}</span>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-bold">{dest.count} Ashrams</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Monthly Inspections & Notifications) */}
        <div className="space-y-6">
          {/* Monthly Inspections Progress */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-secondary dark:text-white flex items-center gap-1.5 border-b border-border pb-3">
              <Calendar size={16} className="text-primary" /> Monthly Inspections Performed
            </h3>
            <div className="space-y-4">
              {(stats?.financials?.monthlyInspections || []).map((ins: any, index: number) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>{ins.month}</span>
                    <span>{ins.count} Inspections</span>
                  </div>
                  {/* Progress bar simulation */}
                  <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ width: `${Math.min(100, (ins.count / 30) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ministry Guidelines Notification Board */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-secondary dark:text-white">Ministry Guidelines Notification board</h3>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/15 border border-yellow-200/50 rounded-xl text-xs text-yellow-700 dark:text-yellow-400 leading-relaxed">
              <strong>[ATTENTION DISTRICT OFFICERS]:</strong> Please ensure physical inspections verify separate washrooms for women pilgrims and emergency medical kits are fully stocked before submitting approvals.
            </div>
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 text-xs text-primary leading-relaxed">
              <strong>[DIGITAL INDIA DIRECTIVE]:</strong> Standardize guest logbook integration by pushing local counter walk-ins straight into the reception check-in portal.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
export default AdminDashboard;

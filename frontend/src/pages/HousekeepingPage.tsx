import React, { useState } from 'react';
import { ClipboardList, CheckCircle, Wrench, AlertTriangle, ShieldCheck } from 'lucide-react';

export const HousekeepingPage: React.FC = () => {
  // Simple state simulation for rooms cleaning statuses
  const [housekeepingLogs, setHousekeepingLogs] = useState([
    { id: '101', roomName: 'Ganga View Deluxe AC Room - 101', status: 'dirty', assignedTo: 'Ramesh Singh' },
    { id: '102', roomName: 'Ganga View Deluxe AC Room - 102', status: 'cleaning', assignedTo: 'Suresh Kumar' },
    { id: '103', roomName: 'Vedic Shared Dormitory Bed - A1', status: 'clean', assignedTo: 'Karan Dev' },
    { id: '104', roomName: 'Vedic Shared Dormitory Bed - A2', status: 'maintenance', assignedTo: 'Rohan Lal' },
  ]);

  const updateStatus = (id: string, newStatus: string) => {
    setHousekeepingLogs((prev) =>
      prev.map((log) => (log.id === id ? { ...log, status: newStatus } : log))
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
        <h2 className="text-lg font-bold text-secondary dark:text-white">Housekeeping & Maintenance Console</h2>
        <p className="text-xs text-gray-500">Monitor room cleaning statuses, log maintenance blocks, and view staff duties.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {housekeepingLogs.map((log) => {
          const isDirty = log.status === 'dirty';
          const isCleaning = log.status === 'cleaning';
          const isClean = log.status === 'clean';
          const isMaintenance = log.status === 'maintenance';

          return (
            <div
              key={log.id}
              className={`bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden`}
            >
              {/* Dynamic Left Colored bar */}
              <div className={`absolute left-0 inset-y-0 w-1 ${
                isClean ? 'bg-success' :
                isCleaning ? 'bg-primary' :
                isDirty ? 'bg-danger' :
                'bg-yellow-500'
              }`} />

              <div className="space-y-1">
                <h4 className="font-bold text-xs text-secondary dark:text-white truncate pr-2">{log.roomName}</h4>
                <p className="text-[9px] text-gray-400 font-bold uppercase">Staff: {log.assignedTo}</p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                  isClean ? 'bg-success/10 text-success' :
                  isCleaning ? 'bg-primary/10 text-primary animate-pulse' :
                  isDirty ? 'bg-danger/10 text-danger' :
                  'bg-yellow-50 text-yellow-700'
                }`}>
                  {log.status}
                </span>

                <div className="flex gap-1.5">
                  {!isClean && (
                    <button
                      onClick={() => updateStatus(log.id, 'clean')}
                      className="p-1 hover:bg-success/10 text-gray-400 hover:text-success rounded transition-colors cursor-pointer"
                      title="Mark Clean"
                    >
                      <CheckCircle size={14} />
                    </button>
                  )}
                  {!isCleaning && !isClean && (
                    <button
                      onClick={() => updateStatus(log.id, 'cleaning')}
                      className="p-1 hover:bg-primary/10 text-gray-400 hover:text-primary rounded transition-colors cursor-pointer"
                      title="Start Cleaning"
                    >
                      <ClipboardList size={14} />
                    </button>
                  )}
                  {!isMaintenance && (
                    <button
                      onClick={() => updateStatus(log.id, 'maintenance')}
                      className="p-1 hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 rounded transition-colors cursor-pointer"
                      title="Log Maintenance"
                    >
                      <Wrench size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default HousekeepingPage;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar as CalendarIcon, Sparkles, Check, Edit2, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export const InventoryCalendarPage: React.FC = () => {
  const { addNotification } = useNotifications();
  
  const [myRooms, setMyRooms] = useState<any[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [calendar, setCalendar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Override Form State
  const [showOverride, setShowOverride] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [maintenanceCount, setMaintenanceCount] = useState('0');

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      fetchCalendar();
    }
  }, [selectedRoomId]);

  const fetchRooms = async () => {
    try {
      const ashramsRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams/my-listings/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (ashramsRes.data.success && ashramsRes.data.data.length > 0) {
        const roomsRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams/${ashramsRes.data.data[0]._id}`);
        if (roomsRes.data.success && roomsRes.data.data.rooms.length > 0) {
          setMyRooms(roomsRes.data.data.rooms);
          setSelectedRoomId(roomsRes.data.data.rooms[0]._id);
        }
      }
    } catch (err) {
      console.error('Fetch rooms error:', err);
      // Mocks fallback
      setMyRooms([{ _id: 'room-1', name: 'Ganga View Deluxe AC Room' }]);
      setSelectedRoomId('room-1');
    }
  };

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rooms/${selectedRoomId}/calendar`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setCalendar(res.data.data);
      }
    } catch (err) {
      console.error('Calendar load error:', err);
      // Mocks fallback
      const mocks = [];
      const start = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        mocks.push({
          date: d.toISOString().split('T')[0],
          price: 1200,
          booked: i % 3 === 0 ? 3 : 1,
          available: 12,
          maintenance: 0,
        });
      }
      setCalendar(mocks);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rooms/${selectedRoomId}/availability`,
        {
          date: targetDate,
          customPrice: parseFloat(customPrice) || undefined,
          maintenanceCount: parseInt(maintenanceCount) || 0,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setShowOverride(false);
        setCustomPrice('');
        setMaintenanceCount('0');
        addNotification('Rate / Inventory Override Applied', `Daily rules updated for ${targetDate}`, 'success');
        fetchCalendar();
      }
    } catch (err) {
      console.error('Override save error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card border border-border p-6 rounded-2xl shadow-sm gap-4">
        <div>
          <h2 className="text-lg font-bold text-secondary dark:text-white">Daily Inventory & Pricing Calendar</h2>
          <p className="text-xs text-gray-500">Monitor booking occupancy and apply manual rate overrides on holiday peaks.</p>
        </div>
        
        {myRooms.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold text-gray-400 uppercase">Active Category</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="p-2.5 bg-background border border-border rounded-lg text-xs font-bold"
            >
              {myRooms.map((room) => (
                <option key={room._id} value={room._id}>{room.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-40 bg-card border border-border rounded-2xl animate-pulse" />
      ) : (
        /* Calendar Grid */
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {calendar.map((item, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3 relative hover:border-primary/50 transition-colors"
            >
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                  <CalendarIcon size={12} className="text-primary" /> {new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </span>
                <button
                  onClick={() => {
                    setTargetDate(item.date);
                    setCustomPrice(item.price.toString());
                    setShowOverride(true);
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-gray-400 hover:text-primary transition-colors cursor-pointer"
                  title="Override daily pricing"
                >
                  <Edit2 size={10} />
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[9px] text-gray-400 block uppercase">Night Price</span>
                <span className="text-xs font-extrabold text-secondary dark:text-accent">₹{item.price}</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-dashed border-border text-center text-[10px]">
                <div className="p-1 bg-primary/5 text-primary rounded font-semibold">
                  <span>{item.booked} Booked</span>
                </div>
                <div className="p-1 bg-green-50 text-green-700 rounded font-semibold">
                  <span>{item.available} Left</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Daily Override Modal */}
      {showOverride && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleOverrideSubmit} className="bg-card border border-border max-w-md w-full rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-sm text-secondary dark:text-white flex items-center gap-1.5">
                <Sparkles size={16} className="text-accent" /> Override Stay Details
              </h3>
              <button type="button" onClick={() => setShowOverride(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Selected Target Date</label>
                <input
                  type="text"
                  disabled
                  value={targetDate}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-border rounded-lg text-xs font-bold text-gray-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Custom Price Override (₹)</label>
                  <input
                    type="number"
                    required
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-bold text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Maintenance Blocks (Units)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={maintenanceCount}
                    onChange={(e) => setMaintenanceCount(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-bold text-center"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-white rounded-lg font-bold text-xs"
            >
              Apply Daily Adjustments
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
export default InventoryCalendarPage;

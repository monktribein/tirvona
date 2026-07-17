import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bed, Plus, ClipboardCheck, Trash2, X } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

export const ManageRoomsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [rooms, setRooms] = useState<any[]>([]);
  const [myAshrams, setMyAshrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAshramId, setSelectedAshramId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('private_room');
  const [acType, setAcType] = useState('AC');
  const [capacity, setCapacity] = useState('2');
  const [totalInventory, setTotalInventory] = useState('10');
  const [basePrice, setBasePrice] = useState('800');
  const [amenities, setAmenities] = useState('Attached Bath, WiFi, Cooler');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const ashramsRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams/my-listings/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (ashramsRes.data.success && ashramsRes.data.data.length > 0) {
        setMyAshrams(ashramsRes.data.data);
        setSelectedAshramId(ashramsRes.data.data[0]._id);
        
        // Fetch rooms for first ashram
        const roomsRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ashrams/${ashramsRes.data.data[0]._id}`);
        if (roomsRes.data.success) {
          setRooms(roomsRes.data.data.rooms);
        }
      }
    } catch (err) {
      console.error('Fetch data error:', err);
      // Mocks fallback
      setMyAshrams([{ _id: 'ashram-1', name: 'Parmarth Niketan Ashram' }]);
      setSelectedAshramId('ashram-1');
      setRooms([
        {
          _id: 'room-1',
          name: 'Ganga View Deluxe AC Room',
          type: 'private_room',
          acType: 'AC',
          capacity: 3,
          basePrice: 1200,
          totalInventory: 15,
          amenities: ['Attached Bath', 'Geyser'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ashramId: selectedAshramId,
      name,
      type,
      acType,
      capacity: parseInt(capacity),
      totalInventory: parseInt(totalInventory),
      basePrice: parseFloat(basePrice),
      amenities: amenities.split(',').map((a) => a.trim()),
    };

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/rooms`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setShowCreate(false);
        setName('');
        setAmenities('Attached Bath, WiFi');
        addNotification('Room Category Added', 'New room configuration saved successfully.', 'success');
        fetchInitialData();
      }
    } catch (err) {
      console.error('Room create error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-secondary dark:text-white">Configure Room Categories</h2>
          <p className="text-xs text-gray-500">Add dormitories, private suites, and apply base and peak seasonal rates.</p>
        </div>
        {myAshrams.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} /> Add Room Category
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-40 bg-card border border-border rounded-2xl animate-pulse" />
      ) : rooms.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl space-y-3">
          <Bed className="mx-auto text-gray-400" size={32} />
          <h4 className="font-bold text-sm">No room categories listed</h4>
          <p className="text-xs text-gray-500">Configure your first stay options to receive guest reservations.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div key={room._id} className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-start border-b border-border pb-3">
                <div>
                  <h3 className="font-bold text-sm text-secondary dark:text-white">{room.name}</h3>
                  <span className="text-[9px] uppercase font-bold text-gray-400">{room.type.replace('_', ' ')} • {room.acType}</span>
                </div>
                <span className="text-sm font-extrabold text-secondary dark:text-accent">₹{room.basePrice} <span className="text-[10px] text-gray-400 font-normal">/ night</span></span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-background border border-border rounded-lg">
                  <span className="text-[9px] text-gray-400 block uppercase">Max Capacity</span>
                  <span className="font-semibold">{room.capacity} Persons</span>
                </div>
                <div className="p-2 bg-background border border-border rounded-lg">
                  <span className="text-[9px] text-gray-400 block uppercase">Total Rooms</span>
                  <span className="font-semibold">{room.totalInventory} Units</span>
                </div>
                <div className="p-2 bg-background border border-border rounded-lg">
                  <span className="text-[9px] text-gray-400 block uppercase">Status</span>
                  <span className="font-semibold text-success flex items-center justify-center gap-0.5"><ClipboardCheck size={12} /> Active</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-card border border-border max-w-md w-full rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-sm text-secondary dark:text-white flex items-center gap-1.5">
                <Bed size={16} /> Add Room Category
              </h3>
              <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-bold">Select Ashram</label>
                <select
                  value={selectedAshramId}
                  onChange={(e) => setSelectedAshramId(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-lg text-xs"
                >
                  {myAshrams.map((a) => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500">Room Category Name</label>
                <input type="text" required placeholder="e.g. Standard Triple AC Suite" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Stay Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full p-2.5 bg-background border border-border rounded-lg text-xs">
                    <option value="private_room">Private Room</option>
                    <option value="dormitory">Dormitory Bed</option>
                    <option value="family_room">Family Suite</option>
                    <option value="hall">Satsang Hall Bed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">AC / Ventilation</label>
                  <select value={acType} onChange={(e) => setAcType(e.target.value)} className="w-full p-2.5 bg-background border border-border rounded-lg text-xs">
                    <option value="AC">AC (Air Conditioned)</option>
                    <option value="Non-AC">Non-AC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Capacity</label>
                  <input type="number" min={1} required value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-center font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Total Units</label>
                  <input type="number" min={1} required value={totalInventory} onChange={(e) => setTotalInventory(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-center font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Base Price (₹)</label>
                  <input type="number" min={0} required value={basePrice} onChange={(e) => setBasePrice(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-center font-bold" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500">Amenities (Comma separated)</label>
                <input type="text" placeholder="Attached Bath, WiFi, Cooler, Geyser" value={amenities} onChange={(e) => setAmenities(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-white rounded-lg font-bold text-xs"
            >
              Configure Category
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
export default ManageRoomsPage;

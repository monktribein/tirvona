import React, { useState, useEffect } from "react";
import { Bed, Plus, ClipboardCheck, X } from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import { ashramService, roomService } from "../services";
import { getErrorMessage } from "../lib/api";

export const ManageRoomsPage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [rooms, setRooms] = useState<any[]>([]);
  const [myAshrams, setMyAshrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal State
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAshramId, setSelectedAshramId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("private_room");
  const [acType, setAcType] = useState("AC");
  const [capacity, setCapacity] = useState("2");
  const [totalInventory, setTotalInventory] = useState("10");
  const [basePrice, setBasePrice] = useState("800");
  const [amenities, setAmenities] = useState("Attached Bath, WiFi, Cooler");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const ashramsRes = await ashramService.myListings();
      if (ashramsRes.data.success && ashramsRes.data.data.length > 0) {
        setMyAshrams(ashramsRes.data.data);
        setSelectedAshramId(ashramsRes.data.data[0]._id);

        const roomsRes = await ashramService.getManagedById(
          ashramsRes.data.data[0]._id,
        );
        if (roomsRes.data.success) {
          setRooms(roomsRes.data.data.rooms);
        }
      } else {
        setMyAshrams([]);
        setRooms([]);
      }
    } catch (err) {
      console.error("Fetch data error:", err);
      addNotification(
        "Load Failed",
        getErrorMessage(err, "Unable to load your rooms."),
        "error",
      );
      setMyAshrams([]);
      setRooms([]);
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
      amenities: amenities.split(",").map((a) => a.trim()),
    };

    try {
      const res = await roomService.create(payload);
      if (res.data.success) {
        setShowCreate(false);
        setName("");
        setAmenities("Attached Bath, WiFi");
        addNotification(
          "Room Category Added",
          "New room configuration saved successfully.",
          "success",
        );
        fetchInitialData();
      }
    } catch (err) {
      console.error("Room create error:", err);
      addNotification(
        "Save Failed",
        getErrorMessage(err, "Could not add room category."),
        "error",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start sm:items-center gap-3 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 p-4 sm:p-6 rounded-[24px] shadow-sm">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[#0B192C] dark:text-white">
            Configure Room Categories
          </h2>
          <p className="text-xs text-gray-400 font-semibold mt-1">
            Add dormitories, private suites, and apply base and peak seasonal
            rates.
          </p>
        </div>
        {myAshrams.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="shrink-0 px-5 py-2.5 bg-[#0A4DA6] text-white text-xs font-bold rounded-full hover:bg-opacity-95 shadow flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} /> Add Room Category
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-40 bg-gray-50 border border-gray-100 rounded-[24px] animate-pulse" />
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] space-y-4">
          <Bed className="mx-auto text-gray-300" size={32} />
          <h4 className="font-extrabold text-base text-[#0B192C] dark:text-white">
            No room categories listed
          </h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            Configure your first stay options to receive guest reservations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div
              key={room._id}
              className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 shadow-sm space-y-4"
            >
              <div className="flex justify-between items-start border-b border-gray-50 dark:border-slate-850 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-[#0B192C] dark:text-white">
                    {room.name}
                  </h3>
                  <span className="text-[9px] uppercase font-bold text-gray-400">
                    {room.type.replace("_", " ")} • {room.acType}
                  </span>
                </div>
                <span className="text-sm font-extrabold text-[#0B192C] dark:text-white">
                  ₹{room.basePrice}{" "}
                  <span className="text-[10px] text-gray-400 font-normal">
                    / night
                  </span>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-[12px]">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">
                    Max Capacity
                  </span>
                  <span className="font-semibold text-secondary dark:text-white">
                    {room.capacity} Persons
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-[12px]">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">
                    Total Rooms
                  </span>
                  <span className="font-semibold text-secondary dark:text-white">
                    {room.totalInventory} Units
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-850 rounded-[12px]">
                  <span className="text-[9px] text-gray-400 block uppercase font-bold">
                    Status
                  </span>
                  <span className="font-semibold text-success flex items-center justify-center gap-0.5">
                    <ClipboardCheck size={12} /> Active
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-md w-full rounded-[28px] p-6 space-y-4 max-h-[85vh] overflow-y-auto text-left"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
                <Bed size={16} className="text-[#0A4DA6]" /> Add Room Category
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-650"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Select Ashram
                </label>
                <select
                  value={selectedAshramId}
                  onChange={(e) => setSelectedAshramId(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                >
                  {myAshrams.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Room Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Triple AC Suite"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Stay Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="private_room">Private Room</option>
                    <option value="dormitory">Dormitory Bed</option>
                    <option value="family_room">Family Suite</option>
                    <option value="hall">Satsang Hall Bed</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    AC / Ventilation
                  </label>
                  <select
                    value={acType}
                    onChange={(e) => setAcType(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                  >
                    <option value="AC">AC (Air Conditioned)</option>
                    <option value="Non-AC">Non-AC</option>
                  </select>
                </div>
              </div>

              {/* Two-up on phones so each numeric field keeps a usable tap
                  target; three across 320px leaves ~57px of content box. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Total Units
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={totalInventory}
                    onChange={(e) => setTotalInventory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400">
                    Base Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs text-center font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Amenities (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Attached Bath, WiFi, Cooler, Geyser"
                  value={amenities}
                  onChange={(e) => setAmenities(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#0A4DA6] text-white rounded-full font-extrabold text-xs shadow-md transition-all cursor-pointer"
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

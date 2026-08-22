import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  LifeBuoy,
  Send,
  MessageSquare,
  Clock,
  CheckCircle,
  X,
} from "lucide-react";
import { supportService } from "../services";
import { getErrorMessage } from "../lib/api";

export const SupportTicketsPage: React.FC = () => {
  const { user } = useAuth();

  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("booking_issue");

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await supportService.list();
      if (res.data.success) {
        setTickets(res.data.data);
        if (res.data.data.length > 0) {
          setActiveTicket(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error("Fetch tickets error:", err);
      setTickets([]);
      setActiveTicket(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await supportService.create({ title, description, category });
      if (res.data.success) {
        setShowCreate(false);
        setTitle("");
        setDescription("");
        fetchTickets();
      }
    } catch (err) {
      console.error("Create ticket error:", getErrorMessage(err));
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket) return;

    try {
      const res = await supportService.addMessage(activeTicket._id, newMessage);
      if (res.data.success) {
        setNewMessage("");
        const updated = res.data.data;
        setActiveTicket(updated);
        setTickets((prev) =>
          prev.map((t) => (t._id === updated._id ? updated : t)),
        );
      }
    } catch (err) {
      console.error("Send message error:", getErrorMessage(err));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[calc(100vh-12rem)] text-left">
      <aside className="lg:col-span-1 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] p-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-[#0B192C] dark:text-white flex items-center gap-1.5">
              <LifeBuoy size={16} className="text-[#0A4DA6]" /> Help & Tickets
            </h3>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-[#0A4DA6] text-white text-[10px] font-bold rounded-full cursor-pointer hover:bg-opacity-95 shadow-md shadow-[#0A4DA6]/10"
            >
              New Ticket
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[400px]">
            {loading ? (
              <div className="h-20 bg-gray-50 border border-gray-100 rounded-xl animate-pulse" />
            ) : tickets.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-8">
                No tickets logged
              </div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t._id}
                  onClick={() => setActiveTicket(t)}
                  className={`p-3.5 rounded-[16px] border text-left cursor-pointer transition-all ${
                    activeTicket?._id === t._id
                      ? "border-[#0A4DA6] bg-[#0A4DA6]/5"
                      : "border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-900"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-extrabold truncate max-w-[140px] text-[#0B192C] dark:text-white">
                      {t.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[8px] font-bold capitalize ${
                        t.status === "resolved"
                          ? "bg-success/10 text-success"
                          : "bg-yellow-50 text-yellow-750"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-gray-400 block mt-1">
                    {t.category.replace("_", " ")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className="lg:col-span-2 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[24px] flex flex-col justify-between overflow-hidden min-h-[400px]">
        {activeTicket ? (
          <>
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/10 flex justify-between items-center">
              <div>
                <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
                  {activeTicket.title}
                </h4>
                <p className="text-[10px] text-gray-450 mt-0.5 font-semibold">
                  {activeTicket.description}
                </p>
              </div>
              <div className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                {activeTicket.status === "resolved" ? (
                  <>
                    <CheckCircle className="text-success" size={12} /> Resolved
                  </>
                ) : (
                  <>
                    <Clock className="text-[#0A4DA6]" size={12} /> In Progress
                  </>
                )}
              </div>
            </div>

            <div className="flex-grow p-5 space-y-3 overflow-y-auto max-h-[300px]">
              {activeTicket.messages?.map((msg: any, i: number) => {
                const isMe = msg.senderId === user?.id || !msg.senderId;
                return (
                  <div
                    key={i}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`p-3 px-4 rounded-[20px] max-w-sm text-xs leading-relaxed ${
                        isMe
                          ? "bg-[#0A4DA6] text-white rounded-tr-none"
                          : "bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-[#0B192C] dark:text-gray-200 rounded-tl-none font-semibold"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeTicket.status !== "resolved" && (
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-gray-100 dark:border-slate-800 flex gap-2"
              >
                <input
                  type="text"
                  required
                  placeholder="Type message reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-grow px-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                />
                <button
                  type="submit"
                  className="p-2.5 bg-[#0A4DA6] text-white rounded-xl cursor-pointer hover:bg-opacity-95 transition-all"
                >
                  <Send size={14} />
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-12 flex-grow space-y-2">
            <MessageSquare className="text-gray-300 animate-bounce" size={32} />
            <h4 className="font-extrabold text-sm text-[#0B192C] dark:text-white">
              Select a ticket to begin
            </h4>
            <p className="text-xs text-gray-400">
              Pick any open ticket from the sidebar to chat with support.
            </p>
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTicket}
            className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 max-w-4xl w-full rounded-[28px] p-6 sm:p-8 space-y-5 text-left shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-base text-[#0B192C] dark:text-white">
                File a Support Request
              </h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Subject Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Booking failed transaction lock"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none cursor-pointer"
                >
                  <option value="booking_issue">Booking Issue</option>
                  <option value="payment_failed">Payment Failed</option>
                  <option value="refund_request">Refund Request</option>
                  <option value="ashram_complaint">Ashram Complaint</option>
                  <option value="other">Other Query</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400">
                Describe Issue
              </label>
              <textarea
                required
                rows={3}
                placeholder="Details of transaction date, Ashram name, reference ID..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0A4DA6] text-white rounded-full text-xs font-bold cursor-pointer shadow"
              >
                Log Ticket
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default SupportTicketsPage;

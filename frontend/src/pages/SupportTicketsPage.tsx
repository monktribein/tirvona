import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { LifeBuoy, Send, MessageSquare, Clock, CheckCircle } from 'lucide-react';

export const SupportTicketsPage: React.FC = () => {
  const { user } = useAuth();
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  // New ticket modal state
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('booking_issue');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/support', {
        headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` },
      });
      if (res.data.success) {
        setTickets(res.data.data);
        if (res.data.data.length > 0) {
          setActiveTicket(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error('Fetch tickets error:', err);
      // Fallback mocks
      const mocks = [
        {
          _id: 'ticket-mock-1',
          title: 'Refund Request for Booking Cancellation',
          description: 'My booking AB-2026-9812 was cancelled but refund has not posted.',
          category: 'refund_request',
          status: 'open',
          messages: [
            { senderId: 'user-1', text: 'Please check the status of my refund.', timestamp: new Date() },
          ],
        },
      ];
      setTickets(mocks);
      setActiveTicket(mocks[0]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        'http://localhost:5000/api/support',
        { title, description, category },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setShowCreate(false);
        setTitle('');
        setDescription('');
        fetchTickets();
      }
    } catch (err) {
      console.error('Create ticket error:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket) return;

    try {
      const res = await axios.post(
        `http://localhost:5000/api/support/${activeTicket._id}/message`,
        { text: newMessage },
        { headers: { Authorization: `Bearer ${localStorage.getItem('ab_token')}` } }
      );
      if (res.data.success) {
        setNewMessage('');
        // Reload active ticket details
        const updated = res.data.data;
        setActiveTicket(updated);
        setTickets(prev => prev.map(t => t._id === updated._id ? updated : t));
      }
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[calc(100vh-12rem)]">
      
      {/* Left List Pane */}
      <aside className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-secondary dark:text-white flex items-center gap-1.5">
              <LifeBuoy size={16} /> Help & Tickets
            </h3>
            <button
              onClick={() => setShowCreate(true)}
              className="px-2.5 py-1.5 bg-primary text-white text-[10px] font-bold rounded-lg cursor-pointer"
            >
              New Ticket
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[400px]">
            {loading ? (
              <div className="h-20 bg-background border border-border rounded-lg animate-pulse" />
            ) : tickets.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-8">No tickets logged</div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t._id}
                  onClick={() => setActiveTicket(t)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    activeTicket?._id === t._id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-gray-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold truncate max-w-[140px] text-secondary dark:text-white">{t.title}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold capitalize ${
                      t.status === 'resolved' ? 'bg-success/10 text-success' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                  <span className="text-[9px] uppercase font-bold text-gray-400 block mt-1">{t.category.replace('_', ' ')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Right Message Chat Stream */}
      <section className="lg:col-span-2 bg-card border border-border rounded-2xl flex flex-col justify-between overflow-hidden">
        {activeTicket ? (
          <>
            {/* Header info */}
            <div className="p-4 border-b border-border bg-gray-50/50 dark:bg-slate-900/10 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-sm text-secondary dark:text-white">{activeTicket.title}</h4>
                <p className="text-[10px] text-gray-500">{activeTicket.description}</p>
              </div>
              <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
                {activeTicket.status === 'resolved' ? (
                  <><CheckCircle className="text-success" size={12} /> Resolved</>
                ) : (
                  <><Clock className="text-yellow-500" size={12} /> In Progress</>
                )}
              </div>
            </div>

            {/* Chat Board */}
            <div className="flex-grow p-5 space-y-3 overflow-y-auto max-h-[300px]">
              {activeTicket.messages?.map((msg: any, i: number) => {
                const isMe = msg.senderId === user?.id || !msg.senderId;
                return (
                  <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-2xl max-w-sm text-xs leading-relaxed ${
                      isMe 
                        ? 'bg-primary text-white rounded-tr-none' 
                        : 'bg-background border border-border text-gray-700 dark:text-gray-200 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Bar */}
            {activeTicket.status !== 'resolved' && (
              <form onSubmit={handleSendMessage} className="p-4 border-t border-border flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Type message reply..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-grow px-4 py-2 bg-background border border-border rounded-lg text-xs"
                />
                <button type="submit" className="p-2 bg-primary text-white rounded-lg cursor-pointer">
                  <Send size={14} />
                </button>
              </form>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-12 flex-grow space-y-2">
            <MessageSquare className="text-gray-400 animate-bounce" size={32} />
            <h4 className="font-bold text-sm">Select a ticket to begin</h4>
            <p className="text-xs text-gray-500">Pick any open ticket from the sidebar to chat with support.</p>
          </div>
        )}
      </section>

      {/* Create Ticket Modal Overlay */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTicket} className="bg-card border border-border max-w-md w-full rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-sm text-secondary dark:text-white">File a Support Request</h3>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Subject Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Booking failed transaction lock"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-xs text-gray-500 font-bold">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="p-2 bg-background border border-border rounded-lg text-xs"
              >
                <option value="booking_issue">Booking Issue</option>
                <option value="payment_failed">Payment Failed</option>
                <option value="refund_request">Refund Request</option>
                <option value="ashram_complaint">Ashram Complaint</option>
                <option value="other">Other Query</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Describe Issue</label>
              <textarea
                required
                rows={3}
                placeholder="Details of transaction date, Ashram name, reference ID..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 bg-background border border-border rounded-lg text-xs"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-primary text-white rounded-lg text-xs font-bold"
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

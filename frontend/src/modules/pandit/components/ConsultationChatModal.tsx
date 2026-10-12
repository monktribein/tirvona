import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, CheckCheck, Clock, Loader2, MessageSquare, RefreshCw, Send } from "lucide-react";
import { consultationService } from "../services/provider.service";
import { useAuth } from "../../../contexts/AuthContext";
import { getErrorMessage } from "../../../lib/api";
import { Button, Modal, StatusBadge, cx } from "../ui";

export interface ConsultationChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultationId: string;
  recipientName: string;
  recipientSubtitle?: string;
  /** Overrides the status loaded from the server. */
  consultationStatus?: string;
  scheduledTime?: string;
}

const MAX_LENGTH = 4000;
const POLL_MS = 6000;

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export const ConsultationChatModal: React.FC<ConsultationChatModalProps> = ({
  isOpen,
  onClose,
  consultationId,
  recipientName,
  recipientSubtitle = "Vedic consultation",
  consultationStatus,
  scheduledTime,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<string | undefined>(consultationStatus);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const messageCount = useRef(0);
  useEffect(() => {
    messageCount.current = messages.length;
  }, [messages.length]);

  const fetchMessages = useCallback(async () => {
    if (!consultationId) return;
    try {
      const res = await consultationService.getMessages(consultationId);
      if (res.data?.success) setMessages(res.data.data || []);
      setLoadError(null);
      setReconnecting(false);
    } catch (err) {
      // Keep the conversation on screen if a later refresh fails; only a failed first load blocks the view.
      if (messageCount.current === 0) setLoadError(getErrorMessage(err, "Failed to load the conversation."));
      else setReconnecting(true);
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setMessages([]);
    setLoadError(null);
    setReconnecting(false);
    fetchMessages();
    const timer = window.setInterval(() => {
      if (!document.hidden) fetchMessages();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, fetchMessages]);

  // The consultation's real status, unless the caller already knows it.
  useEffect(() => {
    if (!isOpen || consultationStatus || !consultationId) return;
    let active = true;
    consultationService
      .getById(consultationId)
      .then((res) => {
        if (active && res.data?.success) setStatus(res.data.data?.status);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isOpen, consultationId, consultationStatus]);

  useEffect(() => {
    if (stickToBottom.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await consultationService.sendMessage(consultationId, { content: trimmed });
      if (res.data?.success) {
        stickToBottom.current = true;
        setMessages((prev) => [...prev, res.data.data]);
        setText("");
      }
    } catch (err) {
      // The typed message stays in the box so it can be sent again.
      setSendError(getErrorMessage(err, "Your message was not sent."));
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const closed = status === "CANCELLED" || status === "NO_SHOW";
  let lastDay = "";

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={recipientName}
      fullHeight
      flush
      footer={undefined}
      headerExtra={
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{recipientSubtitle}</span>
          {status && <StatusBadge status={status} />}
          {scheduledTime && (
            <span className="flex items-center gap-1">
              <Clock size={12} aria-hidden="true" />
              {new Date(scheduledTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          )}
        </div>
      }
    >
      {reconnecting && (
        <div role="status" className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <RefreshCw size={14} aria-hidden="true" />
          Reconnecting… new messages may be delayed.
        </div>
      )}

      <div
        ref={listRef}
        onScroll={onScroll}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${recipientName}`}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#F7F4EE] px-4 py-4 dark:bg-[#070F1B]"
      >
        {loading ? (
          <div role="status" className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 size={24} className="animate-spin text-[#B45309] motion-reduce:animate-none" aria-hidden="true" />
            Loading messages…
          </div>
        ) : loadError ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle size={28} className="text-rose-600" aria-hidden="true" />
            <p className="text-sm text-gray-700 dark:text-gray-300">{loadError}</p>
            <Button variant="outline" onClick={fetchMessages}>
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF4E5] text-[#B45309] dark:bg-[#F28C28]/15" aria-hidden="true">
              <MessageSquare size={22} />
            </span>
            <h3 className="text-sm font-bold text-[#0B192C] dark:text-white">No messages yet</h3>
            <p className="mt-1 max-w-xs text-sm text-gray-500">Your messages with {recipientName} are private and saved here. Start by sharing your question.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const mine = String(msg.senderUserId) === String(user?.id);
            const day = dayLabel(msg.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <React.Fragment key={msg.id || idx}>
                {showDay && (
                  <div className="flex justify-center">
                    <span className="rounded-full bg-white px-3 py-0.5 text-[11px] font-semibold text-gray-500 shadow-sm dark:bg-slate-800">{day}</span>
                  </div>
                )}
                <div className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
                  <div
                    className={cx(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]",
                      mine
                        ? "rounded-br-md bg-[#0B192C] text-white"
                        : "rounded-bl-md border border-gray-200 bg-white text-[#0B192C] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100",
                    )}
                  >
                    {!mine && msg.senderName && <p className="mb-0.5 text-xs font-bold text-[#B45309] dark:text-[#F28C28]">{msg.senderName}</p>}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <p className="mt-1 flex items-center gap-1 px-1 text-[11px] text-gray-500">
                    {timeLabel(msg.createdAt)}
                    {mine && (msg.readAt ? <CheckCheck size={12} className="text-emerald-600" aria-label="Read" /> : <Check size={12} aria-label="Delivered" />)}
                  </p>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="shrink-0 border-t border-gray-100 bg-white px-3 pb-3 pt-3 dark:border-slate-800 dark:bg-[#0B192C]">
        {sendError && (
          <p role="alert" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <AlertCircle size={13} aria-hidden="true" />
            {sendError}
          </p>
        )}
        {closed ? (
          <p className="py-2 text-center text-sm text-gray-500">This consultation is closed to new messages.</p>
        ) : (
          <div className="flex items-end gap-2">
            <label htmlFor="consult-message" className="sr-only">
              Message to {recipientName}
            </label>
            <textarea
              id="consult-message"
              rows={1}
              value={text}
              maxLength={MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={`Message ${recipientName}`}
              disabled={loading || !!loadError}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#F28C28] focus:ring-2 focus:ring-[#F28C28]/30 disabled:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            <Button type="submit" loading={sending} disabled={!text.trim() || loading || !!loadError} aria-label="Send message" className="!px-4">
              {!sending && <Send size={16} aria-hidden="true" />}
              <span className="hidden sm:inline">Send</span>
            </Button>
          </div>
        )}
        <p className="mt-2 text-center text-[11px] text-gray-500">Enter to send, Shift+Enter for a new line. Guidance chats are separate from paid puja bookings.</p>
      </form>
    </Modal>
  );
};

export default ConsultationChatModal;

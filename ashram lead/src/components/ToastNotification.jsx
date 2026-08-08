/**
 * ToastNotification.jsx
 *
 * Tirvona-themed fixed-position notification banner.
 * White card, saffron border, Royal Blue / success green accent.
 */
import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function ToastNotification({ toast }) {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div
      className="toast-enter"
      style={{
        position: 'fixed',
        bottom: '1.75rem',
        right: '1.5rem',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          background: isError ? '#FEF2F2' : '#FFFFFF',
          border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : 'var(--accent-border)'}`,
          boxShadow: 'var(--shadow-lg)',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '0.875rem',
          fontWeight: 600,
          color: isError ? '#B91C1C' : 'var(--foreground)',
          maxWidth: '360px',
          minWidth: '260px',
        }}
      >
        {isError ? (
          <AlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
        ) : (
          <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
        )}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}

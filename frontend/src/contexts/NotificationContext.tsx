import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../lib/api';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (title: string, message: string, type?: Notification['type']) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const addNotification = (title: string, message: string, type: Notification['type'] = 'info') => {
    const newNotif: Notification = {
      id: Math.random().toString(36).substring(7),
      title,
      message,
      type,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Seed a welcome notification when a user logs in.
  useEffect(() => {
    if (user) {
      setNotifications([
        {
          id: 'init-1',
          title: 'Welcome to Tirvona',
          message: `Namaste ${user.name}, your account is active as an official ${user.role.toUpperCase() === 'CUSTOMER' ? 'Pilgrim' : user.role.toUpperCase()}.`,
          type: 'success',
          timestamp: new Date(),
          read: false,
        },
      ]);
    } else {
      setNotifications([]);
    }
  }, [user]);

  // Establish a real-time Socket.io connection scoped to the logged-in user.
  useEffect(() => {
    if (!user) return;

    const socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_dashboard', user.id);
    });

    // Live booking lifecycle updates pushed by the server.
    socket.on('booking_update', (payload: { event: string; bookingId: string; status: string }) => {
      const labels: Record<string, { title: string; type: Notification['type'] }> = {
        booking_confirmed: { title: 'Booking Confirmed', type: 'success' },
        checked_in: { title: 'Guest Checked In', type: 'info' },
        checked_out: { title: 'Guest Checked Out', type: 'info' },
        cancelled: { title: 'Booking Cancelled', type: 'warning' },
      };
      const meta = labels[payload.event] || { title: 'Booking Update', type: 'info' as const };
      addNotification(meta.title, `Booking ${payload.bookingId} is now ${payload.status}.`, meta.type);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const markAllAsRead = () => {
    setNotifications([]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAllAsRead, removeNotification, clearNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

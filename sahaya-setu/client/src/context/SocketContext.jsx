import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveToast, setLiveToast] = useState(null);

  // Load initial notifications from API
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.warn('Failed to load initial notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Connect to Socket.IO
  useEffect(() => {
    const s = io('/', {
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {
      if (user) {
        s.emit('join', {
          userId: user._id || user.id,
          role: user.role,
          department: user.department,
        });
      }
    });

    s.on('notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
      // Show live toast banner
      setLiveToast(notif);
      setTimeout(() => setLiveToast(null), 5000);
    });

    s.on('disaster_mode_activated', (data) => {
      setLiveToast({
        title: `🚨 EMERGENCY: ${data.title}`,
        message: `Disaster Response Mode has been activated in ${data.area}.`,
        type: 'disaster_alert',
      });
      setTimeout(() => setLiveToast(null), 8000);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [user]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    }
  };

  const markRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Failed to mark read:', err);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        notifications,
        unreadCount,
        liveToast,
        setLiveToast,
        markAllRead,
        markRead,
        refreshNotifications: fetchNotifications,
      }}
    >
      {children}
      {liveToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            maxWidth: '380px',
            zIndex: 9999,
            background: liveToast.type === 'disaster_alert' ? '#b91c1c' : '#1e3a8a',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            animation: 'slideUp 0.3s ease-out',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '15px' }}>{liveToast.title}</strong>
            <button
              onClick={() => setLiveToast(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>
          <span style={{ fontSize: '13px', opacity: 0.9 }}>{liveToast.message}</span>
        </div>
      )}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

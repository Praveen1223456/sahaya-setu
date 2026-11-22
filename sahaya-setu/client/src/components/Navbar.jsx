import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, DEMO_USERS } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { getApiUrl } from '../utils/api';
import {
  ShieldAlert,
  Bell,
  User,
  CheckCircle,
  AlertTriangle,
  Clock,
  LogOut,
  ChevronDown,
  Layers,
  MapPin,
  BarChart3,
  Flame,
  Home,
  Check,
} from 'lucide-react';

export default function Navbar() {
  const { user, token, logout, switchDemoUser } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const [isDisasterMode, setIsDisasterMode] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Check disaster mode status
  useEffect(() => {
    async function checkDisaster() {
      try {
        const res = await fetch(getApiUrl('/api/disaster/status'));
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          setIsDisasterMode(Boolean(data.is_disaster_mode));
        }
      } catch (err) {
        // Silently skip if backend is unreachable
      }
    }
    checkDisaster();
    const interval = setInterval(checkDisaster, 15000);
    return () => clearInterval(interval);
  }, []);

  const navLinks = [
    { to: '/citizen', label: 'Citizen Portal', icon: Home, roles: ['all'] },
    { to: '/dashboard', label: 'Department Ops', icon: Layers, roles: ['department_admin', 'super_admin'] },
    { to: '/field', label: 'Field Mobile', icon: MapPin, roles: ['field_employee', 'department_admin', 'super_admin'] },
    { to: '/disaster', label: 'Disaster Command', icon: Flame, roles: ['all'], badge: isDisasterMode ? 'ACTIVE' : null },
    { to: '/analytics', label: 'City Analytics', icon: BarChart3, roles: ['department_admin', 'super_admin'] },
    { to: '/board', label: 'Public Board', icon: CheckCircle, roles: ['all'] },
  ];

  const handleRoleSelect = async (demoUser) => {
    await switchDemoUser(demoUser);
    setShowDemoModal(false);
    // Route user appropriately based on their new role
    if (demoUser.role === 'citizen') navigate('/citizen');
    else if (demoUser.role === 'field_employee') navigate('/field');
    else if (demoUser.role === 'super_admin') navigate('/analytics');
    else navigate('/dashboard');
  };

  return (
    <header
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Top emergency disaster banner if Disaster Mode is active */}
      {isDisasterMode && (
        <div
          style={{
            background: 'linear-gradient(90deg, #b91c1c, #dc2626)',
            color: '#ffffff',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          <Flame size={16} className="animate-pulse" />
          <span>DISASTER RESPONSE MODE ACTIVE: Heavy Rainfall & Cyclone Response Protocol</span>
          <Link
            to="/disaster"
            style={{
              color: '#fef08a',
              textDecoration: 'underline',
              marginLeft: '8px',
            }}
          >
            View Disaster Incident Queue →
          </Link>
        </div>
      )}

      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Brand */}
        <Link
          to="/"
          style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#1b4f9c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 'bold',
              fontSize: '20px',
            }}
          >
            స
          </div>
          <div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: '#0f3166',
                lineHeight: '1.2',
              }}
            >
              Sahaya Setu <span style={{ fontSize: '14px', color: '#64748b' }}>సహాయ సేతు</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
              Citizen-to-Department Field Response Platform
            </div>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {navLinks.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontSize: '13.5px',
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? '#1b4f9c' : '#475569',
                  background: isActive ? '#eff6ff' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '9px',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions: Notifications & Demo User Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Notifications Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              style={{
                background: showNotifs ? '#eff6ff' : 'transparent',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                color: '#475569',
              }}
              title="Real-time Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Menu */}
            {showNotifs && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '46px',
                  width: '360px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
                  padding: '12px 0',
                  zIndex: 200,
                }}
              >
                <div
                  style={{
                    padding: '0 16px 10px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>Live Notifications</strong>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#1b4f9c',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '500',
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div
                      style={{
                        padding: '24px',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontSize: '13px',
                      }}
                    >
                      No new notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => markRead(n._id)}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid #f8fafc',
                          background: n.read ? '#ffffff' : '#f0f9ff',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: '600',
                              color: '#0f172a',
                            }}
                          >
                            {n.title}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {new Date(n.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Demo User Switcher Button */}
          <button
            onClick={() => setShowDemoModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#1e293b',
              fontWeight: '500',
            }}
          >
            <User size={15} color="#1b4f9c" />
            <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                {user ? user.name : 'Switch Role'}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                {user ? user.role.replace('_', ' ').toUpperCase() : 'Click to select demo role'}
              </div>
            </div>
            <ChevronDown size={14} color="#64748b" />
          </button>
        </div>
      </div>

      {/* Role Switcher Modal for Evaluators */}
      {showDemoModal && (
        <div className="modal-backdrop" onClick={() => setShowDemoModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px' }}
          >
            <div className="card-header">
              <div>
                <h3 style={{ margin: 0 }}>Select Active User Role</h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Test all 4 roles across the end-to-end response workflow
                </p>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DEMO_USERS.map((demo) => {
                const isCurrent = user?.email === demo.email;
                return (
                  <button
                    key={demo.email}
                    onClick={() => handleRoleSelect(demo)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: isCurrent ? '2px solid #1b4f9c' : '1px solid #e2e8f0',
                      background: isCurrent ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{demo.icon}</span>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13.5px', color: '#0f172a' }}>
                          {demo.label}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{demo.email}</div>
                      </div>
                    </div>
                    {isCurrent && <Check size={18} color="#1b4f9c" />}
                  </button>
                );
              })}
            </div>

            {user && (
              <button
                onClick={() => {
                  logout();
                  setShowDemoModal(false);
                }}
                className="btn btn-outline"
                style={{ width: '100%', marginTop: '14px', color: '#dc2626' }}
              >
                <LogOut size={16} /> Logout
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  Layers,
  MapPin,
  Flame,
  BarChart3,
  CheckCircle,
  Shield,
  Zap,
  Droplets,
  Construction,
  Trees,
  Waves,
  ArrowRight,
  Radio,
} from 'lucide-react';

export default function LandingPage() {
  const doors = [
    {
      to: '/citizen',
      title: 'Citizen Reporting Portal',
      desc: 'Report civic problems with GPS photos, detect duplicates, and verify completed fixes.',
      icon: Home,
      accent: '#1b4f9c',
      badge: 'Public Access',
    },
    {
      to: '/dashboard',
      title: 'Department Operations',
      desc: 'Interactive map, smart employee dispatch, SLA tracking, and complaint re-routing.',
      icon: Layers,
      accent: '#0284c7',
      badge: 'Dept Admins',
    },
    {
      to: '/field',
      title: 'Field Workforce Mobile',
      desc: 'Mobile-first task queue, turn-by-turn navigation, and before/after repair proof uploads.',
      icon: MapPin,
      accent: '#d97706',
      badge: 'Field Crews',
    },
    {
      to: '/disaster',
      title: 'Disaster Emergency Command',
      desc: 'Active cyclone/flood response mode, critical life hazard queues, and restoration tracking.',
      icon: Flame,
      accent: '#dc2626',
      badge: 'Emergency Ops',
    },
    {
      to: '/analytics',
      title: 'City-Wide Analytics',
      desc: 'Department resolution rates, Recharts monthly activity trends, and workforce leaderboard.',
      icon: BarChart3,
      accent: '#7c3aed',
      badge: 'Super Admin',
    },
    {
      to: '/board',
      title: 'Public Transparency Board',
      desc: 'Publicly verifiable evidence of completed civic works with before & after photographs.',
      icon: CheckCircle,
      accent: '#059669',
      badge: 'Open Civic Data',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)' }}>
      {/* Hero Section */}
      <div
        style={{
          background: 'linear-gradient(135deg, #091e3a 0%, #0f3166 60%, #1b4f9c 100%)',
          color: '#ffffff',
          padding: '4.5rem 1.5rem 3.5rem',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.12)',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '1rem',
              color: '#93c5fd',
            }}
          >
            <Shield size={16} /> Intelligent Citizen-to-Department Field Response Platform
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
              fontWeight: '800',
              lineHeight: '1.15',
              margin: '0 0 1rem',
              letterSpacing: '-0.02em',
            }}
          >
            సహాయ సేతు • Sahaya Setu
          </h1>

          <p
            style={{
              fontSize: '1.15rem',
              lineHeight: '1.6',
              color: '#dbeafe',
              maxWidth: '750px',
              margin: '0 auto 1.5rem',
            }}
          >
            A modern, intelligent platform connecting citizens, government departments, and field workforces.
            Seamlessly handles both <b>Everyday Civic Infrastructure Repairs</b> and <b>Emergency Disaster Response</b>.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <Link
              to="/citizen"
              className="btn btn-primary"
              style={{
                background: '#ffffff',
                color: '#0f3166',
                fontWeight: 'bold',
                padding: '12px 24px',
                fontSize: '15px',
                borderRadius: '8px',
              }}
            >
              Report Public Problem →
            </Link>
            <Link
              to="/dashboard"
              className="btn btn-outline"
              style={{
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.4)',
                padding: '12px 24px',
                fontSize: '15px',
                borderRadius: '8px',
              }}
            >
              Department Command Center
            </Link>
          </div>
        </div>
      </div>

      {/* Grid of Portals */}
      <div className="app-container" style={{ marginTop: '-2rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {doors.map((door) => {
            const Icon = door.icon;
            return (
              <Link
                key={door.to}
                to={door.to}
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '1.5rem',
                  textDecoration: 'none',
                  color: 'inherit',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: `${door.accent}15`,
                        color: door.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: door.accent,
                        background: `${door.accent}10`,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {door.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', color: '#0f172a', margin: '0 0 6px', fontWeight: '700' }}>
                    {door.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                    {door.desc}
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: door.accent,
                    fontSize: '13px',
                    fontWeight: 'bold',
                    marginTop: '16px',
                  }}
                >
                  <span>Open Portal</span>
                  <ArrowRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Civic Department Coverage Footer */}
        <div
          style={{
            marginTop: '3rem',
            padding: '2rem 1.5rem',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            Integrated Multi-Department Civic Coverage
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '2rem',
              flexWrap: 'wrap',
              fontSize: '14px',
              fontWeight: '600',
              color: '#334155',
            }}
          >
            <span>⚡ Electricity & Streetlights</span>
            <span>💧 Water Supply & Leakage</span>
            <span>🚧 Roads, Potholes & Infrastructure</span>
            <span>🗑️ Municipal Sanitation & Solid Waste</span>
            <span>🌳 Horticulture & Tree Clearances</span>
            <span>🌊 Storm Drainage & Sewage</span>
            <span>🚨 Disaster Emergency Operations</span>
          </div>
        </div>

        <footer style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '12.5px' }}>
          Sahaya Setu Smart Civic Response & Infrastructure Management Platform • Built on MERN Stack (MongoDB, Express, React, Node.js)
        </footer>
      </div>
    </div>
  );
}

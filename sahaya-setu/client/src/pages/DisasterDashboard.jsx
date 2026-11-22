import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import InteractiveMap from '../components/InteractiveMap';
import {
  Flame,
  AlertTriangle,
  ShieldAlert,
  Zap,
  Droplets,
  Construction,
  Waves,
  CheckCircle,
  Clock,
  Radio,
  ExternalLink,
  PlusCircle,
  PowerOff,
} from 'lucide-react';

export default function DisasterDashboard() {
  const { user, token } = useAuth();

  const [disasterStatus, setDisasterStatus] = useState(null);
  const [emergencyIncidents, setEmergencyIncidents] = useState([]);
  const [restorationStats, setRestorationStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Activate Modal State
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: 'Severe Cyclone & Coastal Inundation Emergency',
    hazardType: 'cyclone',
    severity: 'critical',
    areaName: 'Konaseema Delta & Godavari Belt',
    center_lat: 16.5787,
    center_lon: 82.0061,
    radius_km: 30,
  });
  const [isDeclaring, setIsDeclaring] = useState(false);

  useEffect(() => {
    loadAllDisasterData();
    const timer = setInterval(loadAllDisasterData, 10000);
    return () => clearInterval(timer);
  }, []);

  const loadAllDisasterData = async () => {
    try {
      const [statusRes, incidentsRes, statsRes] = await Promise.all([
        fetch('/api/disaster/status'),
        fetch('/api/disaster/incidents'),
        fetch('/api/disaster/restoration-stats'),
      ]);

      if (statusRes.ok) setDisasterStatus(await statusRes.json());
      if (incidentsRes.ok) setEmergencyIncidents(await incidentsRes.json());
      if (statsRes.ok) setRestorationStats(await statsRes.json());
    } catch (err) {
      console.warn('Failed to load disaster data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateDisaster = async (e) => {
    e.preventDefault();
    setIsDeclaring(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/disaster/events', {
        method: 'POST',
        headers,
        body: JSON.stringify(eventForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Activation failed');
      }

      setShowActivateModal(false);
      loadAllDisasterData();
      alert('Disaster Response Mode Activated! Live emergency advisories broadcasted across district.');
    } catch (err) {
      alert(`Activation error: ${err.message}`);
    } finally {
      setIsDeclaring(false);
    }
  };

  const handleEndDisaster = async (eventId) => {
    if (!window.confirm('Are you sure you want to stand down disaster response mode?')) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/disaster/events/${eventId}/end`, {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        loadAllDisasterData();
        alert('Disaster mode ended. System returned to Normal Civic Mode.');
      }
    } catch (err) {
      alert(`Failed to end disaster: ${err.message}`);
    }
  };

  const canManage = user?.role === 'super_admin' || user?.role === 'department_admin';

  return (
    <div className="app-container">
      {/* Citizen Safety Callout Advisory */}
      <div
        style={{
          background: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldAlert size={28} color="#fca5a5" />
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fca5a5', fontWeight: 'bold' }}>
                Operational Disaster Response Command
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '2px 0 0' }}>
                Emergency Infrastructure Restoration Terminal
              </h2>
            </div>
          </div>

          {canManage && (
            <div>
              {disasterStatus?.is_disaster_mode ? (
                <button
                  onClick={() => handleEndDisaster(disasterStatus?.primary_event?._id)}
                  className="btn btn-outline"
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#ffffff', borderColor: '#fca5a5' }}
                >
                  <PowerOff size={16} /> Stand Down Disaster Mode
                </button>
              ) : (
                <button
                  onClick={() => setShowActivateModal(true)}
                  className="btn btn-danger"
                  style={{ background: '#ef4444', border: '1px solid #f87171' }}
                >
                  <Flame size={16} /> Activate Disaster Mode
                </button>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginTop: '12px',
            fontSize: '13px',
            lineHeight: '1.4',
            borderLeft: '4px solid #f87171',
          }}
        >
          <b>CIVIC SAFETY ADVISORY:</b> {disasterStatus?.safety_advisory}
        </div>
      </div>

      {/* Restoration Statistics KPIs */}
      {restorationStats && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-card" style={{ borderLeft: '4px solid #dc2626', background: '#fef2f2' }}>
            <span className="stat-label" style={{ color: '#991b1b', fontWeight: 'bold' }}>
              🚨 Emergency Reports
            </span>
            <span className="stat-value" style={{ color: '#dc2626' }}>
              {restorationStats.total_emergency_reports}
            </span>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
            <span className="stat-label">Restored Infrastructure</span>
            <span className="stat-value" style={{ color: '#16a34a' }}>
              {restorationStats.restored_count}
            </span>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #d97706' }}>
            <span className="stat-label">Pending Restoration</span>
            <span className="stat-value" style={{ color: '#d97706' }}>
              {restorationStats.pending_count}
            </span>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <span className="stat-label">Restoration Rate</span>
            <span className="stat-value" style={{ color: '#1b4f9c' }}>
              {restorationStats.restoration_rate_percentage}%
            </span>
            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: '6px' }}>
              <div
                style={{
                  width: `${restorationStats.restoration_rate_percentage}%`,
                  height: '100%',
                  background: '#16a34a',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Disaster Area Map with Danger Radiuses */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f3166', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="#dc2626" />
            <span>Disaster Damage Zone & Hazard Density Map</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Red circles = Active evacuation & flood/cyclone warning perimeters
          </div>
        </div>

        <InteractiveMap
          center={[16.5787, 82.0061]}
          zoom={12}
          height="400px"
          markers={emergencyIncidents}
          disasterZones={disasterStatus?.active_events || []}
        />
      </div>

      {/* Emergency Prioritization Queue */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 style={{ margin: 0, color: '#0f172a' }}>Emergency Prioritization Queue ({emergencyIncidents.length})</h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Critical hazards ranked by life-threat score and SLA urgency
            </span>
          </div>
        </div>

        {emergencyIncidents.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
            No active emergency or disaster hazards reported.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {emergencyIncidents.map((inc) => (
              <div
                key={inc.id}
                style={{
                  border: inc.emergency_severity === 'critical' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                  background: inc.emergency_severity === 'critical' ? '#fef2f2' : '#ffffff',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f3166' }}>
                      {inc.ticket_code}
                    </span>
                    <span
                      style={{
                        background: inc.emergency_severity === 'critical' ? '#dc2626' : '#d97706',
                        color: '#ffffff',
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                      }}
                    >
                      {inc.emergency_severity || 'High'} Hazard
                    </span>
                    <span className={`badge badge-${inc.status}`}>{inc.status.replace('_', ' ')}</span>
                  </div>

                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>
                    {inc.title || inc.category}
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>📍 {inc.address}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Priority Score</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc2626' }}>
                      {Math.round(inc.priority || 0)}
                    </div>
                  </div>

                  {inc.assigned_employee_name ? (
                    <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>
                      Crew: {inc.assigned_employee_name}
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#d97706', fontWeight: 'bold' }}>
                      Awaiting Crew Dispatch
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal to Declare Disaster Event */}
      {showActivateModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                <Flame size={22} />
                <h3 style={{ margin: 0, color: '#0f172a' }}>Declare Disaster Response Mode</h3>
              </div>
              <button
                onClick={() => setShowActivateModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleActivateDisaster}>
              <div className="form-group">
                <label className="form-label">Disaster Event Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Hazard Type *</label>
                  <select
                    className="form-select"
                    value={eventForm.hazardType}
                    onChange={(e) => setEventForm({ ...eventForm, hazardType: e.target.value })}
                  >
                    <option value="cyclone">Cyclone / Gale Winds</option>
                    <option value="flood">Flash Flood / Inundation</option>
                    <option value="heavy_rainfall">Heavy Rainfall Waterlogging</option>
                    <option value="earthquake">Structural Collapse</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Severity Level *</label>
                  <select
                    className="form-select"
                    value={eventForm.severity}
                    onChange={(e) => setEventForm({ ...eventForm, severity: e.target.value })}
                  >
                    <option value="critical">Critical (Red Alert)</option>
                    <option value="high">High (Orange Alert)</option>
                    <option value="medium">Medium (Yellow Alert)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Affected Geographic Zone / Area Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={eventForm.areaName}
                  onChange={(e) => setEventForm({ ...eventForm, areaName: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Impact Radius (km) *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={eventForm.radius_km}
                    onChange={(e) => setEventForm({ ...eventForm, radius_km: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowActivateModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeclaring}
                  className="btn btn-danger"
                >
                  {isDeclaring ? 'Broadcasting...' : 'Activate Disaster Protocol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import InteractiveMap from '../components/InteractiveMap';
import ComplaintImage from '../components/ComplaintImage';
import {
  Layers,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  TrendingUp,
  MapPin,
  Search,
  Filter,
  UserCheck,
  Send,
  AlertOctagon,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export default function DepartmentDashboard() {
  const { user, token } = useAuth();

  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(user?.department && user.department !== '*' ? user.department : 'electricity');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [complaints, setComplaints] = useState([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [overviewKPIs, setOverviewKPIs] = useState(null);

  // Assignment Modal State
  const [assignModal, setAssignModal] = useState(null);
  const [recommendedEmployees, setRecommendedEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Reroute Modal State
  const [rerouteModal, setRerouteModal] = useState(null);
  const [targetDept, setTargetDept] = useState('roads');
  const [rerouteReason, setRerouteReason] = useState('');

  useEffect(() => {
    fetchDepartments();
    fetchOverviewKPIs();
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [selectedDept, statusFilter, searchQuery]);

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (e) {
      console.warn('Failed to fetch departments:', e);
    }
  };

  const fetchOverviewKPIs = async () => {
    try {
      const res = await fetch('/api/analytics/overview');
      if (res.ok) {
        const data = await res.json();
        setOverviewKPIs(data);
      }
    } catch (e) {
      console.warn('Failed to load KPIs:', e);
    }
  };

  const fetchComplaints = async () => {
    setLoadingComplaints(true);
    try {
      const params = new URLSearchParams();
      if (selectedDept && selectedDept !== '*') params.append('department', selectedDept);
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/complaints?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setComplaints(data.complaints || []);
      }
    } catch (e) {
      console.warn('Failed to load complaints:', e);
    } finally {
      setLoadingComplaints(false);
    }
  };

  const handleOpenAssignModal = async (complaint) => {
    setAssignModal(complaint);
    setSelectedEmployeeId('');
    setAssignmentNotes('');
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/workforce/recommend/${complaint.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setRecommendedEmployees(data.recommended || []);
        if (data.recommended && data.recommended[0]) {
          setSelectedEmployeeId(data.recommended[0]._id);
        }
      }
    } catch (err) {
      console.warn('Failed to load employee recommendations:', err);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployeeId || !assignModal) return;
    setIsAssigning(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/workforce/assign', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          complaint_id: assignModal.id,
          employee_id: selectedEmployeeId,
          notes: assignmentNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Assignment failed');
      }

      setAssignModal(null);
      fetchComplaints();
      fetchOverviewKPIs();
      alert('Task successfully assigned to field employee!');
    } catch (err) {
      alert(`Assignment failed: ${err.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRerouteSubmit = async (e) => {
    e.preventDefault();
    if (!rerouteModal || !targetDept) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/complaints/${rerouteModal.id}/reroute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          new_department: targetDept,
          reason: rerouteReason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Reroute failed');
      }

      setRerouteModal(null);
      setRerouteReason('');
      fetchComplaints();
      alert(`Ticket ${rerouteModal.ticket_code} successfully re-routed to ${targetDept.toUpperCase()} department.`);
    } catch (err) {
      alert(`Rerouting failed: ${err.message}`);
    }
  };

  return (
    <div className="app-container">
      {/* Header & Department Switcher */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#0f3166', margin: 0 }}>
            Department Operations & Workforce Dispatch
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9375rem', margin: '4px 0 0' }}>
            Coordinate field teams, prioritize urgent civic repairs, and track live SLA progress
          </p>
        </div>

        {/* Department Dropdown Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#475569' }}>Department:</span>
          <select
            className="form-select"
            style={{ width: '220px', fontWeight: '600', color: '#1b4f9c' }}
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            <option value="*">All Departments (District Wide)</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      {overviewKPIs && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
          <div className="stat-card" style={{ borderLeft: '4px solid #1b4f9c' }}>
            <span className="stat-label">Total Complaints</span>
            <span className="stat-value" style={{ color: '#0f3166' }}>{overviewKPIs.total}</span>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
            <span className="stat-label">New / Pending</span>
            <span className="stat-value" style={{ color: '#2563eb' }}>{overviewKPIs.pending}</span>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #d97706' }}>
            <span className="stat-label">Assigned & Working</span>
            <span className="stat-value" style={{ color: '#d97706' }}>
              {(overviewKPIs.assigned || 0) + (overviewKPIs.in_progress || 0)}
            </span>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
            <span className="stat-label">Resolved & Closed</span>
            <span className="stat-value" style={{ color: '#16a34a' }}>
              {(overviewKPIs.resolved || 0) + (overviewKPIs.closed || 0)}
            </span>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #dc2626', background: overviewKPIs.overdue > 0 ? '#fef2f2' : '#ffffff' }}>
            <span className="stat-label" style={{ color: overviewKPIs.overdue > 0 ? '#b91c1c' : '#64748b', fontWeight: 'bold' }}>
              ⚠️ Overdue SLA
            </span>
            <span className="stat-value" style={{ color: '#dc2626' }}>{overviewKPIs.overdue}</span>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #b91c1c' }}>
            <span className="stat-label">Critical / Emergency</span>
            <span className="stat-value" style={{ color: '#b91c1c' }}>{overviewKPIs.emergency}</span>
          </div>
        </div>
      )}

      {/* Interactive Map of Complaints */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f3166', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} color="#1b4f9c" />
            <span>Interactive Department Incident Map ({complaints.length} markers)</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontWeight: '600' }}>
            <span style={{ color: '#2563eb' }}>● Received</span>
            <span style={{ color: '#d97706' }}>● Working</span>
            <span style={{ color: '#16a34a' }}>● Resolved</span>
            <span style={{ color: '#dc2626' }}>● Emergency</span>
          </div>
        </div>

        <InteractiveMap
          center={[16.5787, 82.0061]}
          zoom={13}
          height="380px"
          markers={complaints}
        />
      </div>

      {/* Filter Bar & Search */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            className="form-input"
            placeholder="Search by Ticket ID (e.g. SS-1001), address, landmark, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="#64748b" />
          <select
            className="form-select"
            style={{ width: '180px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="received">New / Received</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="escalated">Escalated</option>
          </select>
        </div>
      </div>

      {/* Complaints Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Ticket</th>
                <th style={{ padding: '12px 16px' }}>Category & Location</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Priority</th>
                <th style={{ padding: '12px 16px' }}>Assigned Crew</th>
                <th style={{ padding: '12px 16px' }}>SLA Target</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingComplaints ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    Loading complaints...
                  </td>
                </tr>
              ) : complaints.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    No complaints matching current filters.
                  </td>
                </tr>
              ) : (
                complaints.map((c) => {
                  const isOverdue = c.sla_due_at && new Date(c.sla_due_at) < new Date() && !['resolved', 'closed'].includes(c.status);
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isOverdue ? '#fff1f2' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#1b4f9c' }}>
                        {c.ticket_code}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <ComplaintImage
                            src={c.images?.[0] || c.best_photo_path}
                            alt={c.ticket_code}
                            style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                          />
                          <div>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>{c.title || c.category}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>📍 {c.address}</div>
                            {c.landmark && <div style={{ fontSize: '11px', color: '#94a3b8' }}>Near: {c.landmark}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge badge-${c.status}`}>{c.status.replace('_', ' ')}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 'bold', color: c.priority > 70 ? '#dc2626' : '#0f172a' }}>
                          {Math.round(c.priority || 0)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {c.assigned_employee_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UserCheck size={14} color="#16a34a" />
                            <span style={{ fontWeight: '500' }}>{c.assigned_employee_name}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#d97706', fontSize: '12px', fontWeight: 'bold' }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12.5px' }}>
                        {isOverdue ? (
                          <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ Lapsed</span>
                        ) : c.sla_due_at ? (
                          new Date(c.sla_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {c.status === 'received' && (
                            <button
                              onClick={() => handleOpenAssignModal(c)}
                              className="btn btn-primary"
                              style={{ padding: '6px 10px', fontSize: '12px' }}
                            >
                              Assign Crew
                            </button>
                          )}
                          <button
                            onClick={() => setRerouteModal(c)}
                            className="btn btn-outline"
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                            title="Re-route to another department"
                          >
                            Re-route
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Workforce Assignment Modal */}
      {assignModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '620px' }}>
            <div className="card-header">
              <div>
                <h3 style={{ margin: 0 }}>Assign Field Crew: {assignModal.ticket_code}</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Category: <b>{assignModal.category}</b> | Priority: <b>{Math.round(assignModal.priority)}</b>
                </span>
              </div>
              <button
                onClick={() => setAssignModal(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAssignSubmit}>
              {(assignModal.images?.[0] || assignModal.best_photo_path) && (
                <div style={{ marginBottom: '14px', borderRadius: '8px', overflow: 'hidden' }}>
                  <ComplaintImage
                    src={assignModal.images?.[0] || assignModal.best_photo_path}
                    alt={assignModal.ticket_code}
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Available Field Employees (Sorted by Smart Recommendation):</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                  {recommendedEmployees.map((emp, idx) => {
                    const isSelected = selectedEmployeeId === emp._id;
                    return (
                      <div
                        key={emp._id}
                        onClick={() => setSelectedEmployeeId(emp._id)}
                        style={{
                          border: isSelected ? '2px solid #1b4f9c' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          borderRadius: '8px',
                          padding: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>
                            {emp.name} {idx === 0 && <span style={{ color: '#16a34a', fontSize: '11px', background: '#dcfce7', padding: '2px 6px', borderRadius: '4px' }}>Recommended Match</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Skills: {(emp.skills || []).join(', ') || 'General repair'}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px' }}>
                            Current Load: <b>{emp.activeTasksCount} active tasks</b> | Status: <b style={{ color: emp.availability === 'available' ? '#16a34a' : '#d97706' }}>{emp.availability}</b>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1b4f9c' }}>
                            {emp.matchScore}%
                          </span>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Match Score</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Special Repair Instructions / Equipment Notes:</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Bring safety harnesses, 11kV insulated kit, and crane support..."
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedEmployeeId || isAssigning}
                  className="btn btn-primary"
                >
                  {isAssigning ? 'Dispatching...' : 'Dispatch Field Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Reroute Modal */}
      {rerouteModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Correct Department Assignment</h3>
              <button
                onClick={() => setRerouteModal(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#475569' }}>
              Re-route <b>{rerouteModal.ticket_code}</b> from <b>{rerouteModal.department.toUpperCase()}</b> to another department.
            </p>

            <form onSubmit={handleRerouteSubmit}>
              <div className="form-group">
                <label className="form-label">Target Responsible Department:</label>
                <select
                  className="form-select"
                  value={targetDept}
                  onChange={(e) => setTargetDept(e.target.value)}
                >
                  {departments
                    .filter((d) => d.code !== rerouteModal.department)
                    .map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name} ({d.code.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Re-routing:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Issue involves underground water line, not electrical"
                  value={rerouteReason}
                  onChange={(e) => setRerouteReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRerouteModal(null)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Department Re-route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

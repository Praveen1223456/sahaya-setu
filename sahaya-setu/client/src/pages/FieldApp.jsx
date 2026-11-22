import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ComplaintImage from '../components/ComplaintImage';
import {
  Navigation,
  MapPin,
  CheckCircle,
  Clock,
  Camera,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Play,
  Check,
  ChevronRight,
  ExternalLink,
  Phone,
} from 'lucide-react';

export default function FieldApp() {
  const { user, token } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned' | 'in_progress' | 'completed'
  const [selectedTask, setSelectedTask] = useState(null);

  // Reject Modal State
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Complete Modal State (Proof Photo & Notes)
  const [completeModal, setCompleteModal] = useState(null);
  const [proofPhoto, setProofPhoto] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [repairNotes, setRepairNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // Unable to complete State
  const [unableModal, setUnableModal] = useState(null);
  const [unableReason, setUnableReason] = useState('');
  const [isSubmittingUnable, setIsSubmittingUnable] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/workforce/my-tasks', { headers });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        if (data.tasks && data.tasks.length > 0 && !selectedTask) {
          setSelectedTask(data.tasks[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (taskId, action, reason = '') => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/workforce/tasks/${taskId}/respond`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Action failed');
      }

      setRejectModal(null);
      setRejectReason('');
      fetchTasks();
      alert(action === 'accept' ? 'Task accepted!' : 'Task declined.');
    } catch (err) {
      alert(`Response failed: ${err.message}`);
    }
  };

  const handleStepUpdate = async (taskId, step) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/workforce/tasks/${taskId}/step`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ step }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Step update failed');
      }

      fetchTasks();
    } catch (err) {
      alert(`Step update failed: ${err.message}`);
    }
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!completeModal || !proofPhoto) return;
    setIsCompleting(true);

    try {
      const formData = new FormData();
      formData.append('proof', proofPhoto);
      formData.append('notes', repairNotes);

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/workforce/tasks/${completeModal.id}/complete`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Completion failed');
      }

      setCompleteModal(null);
      setProofPhoto(null);
      setProofPreview(null);
      setRepairNotes('');
      fetchTasks();
      alert('Repair marked completed with photo proof! Citizen notified for verification.');
    } catch (err) {
      alert(`Failed to complete task: ${err.message}`);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleUnableSubmit = async (e) => {
    e.preventDefault();
    if (!unableModal || !unableReason) return;
    setIsSubmittingUnable(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/workforce/tasks/${unableModal.id}/unable`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: unableReason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Unable to update');
      }

      setUnableModal(null);
      setUnableReason('');
      fetchTasks();
      alert('Situation reported. Escalated to department administrator.');
    } catch (err) {
      alert(`Error reporting unable to complete: ${err.message}`);
    } finally {
      setIsSubmittingUnable(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'assigned') return t.status === 'assigned';
    if (activeTab === 'in_progress') return t.status === 'in_progress';
    if (activeTab === 'completed') return ['resolved', 'closed'].includes(t.status);
    return true;
  });

  return (
    <div className="app-container" style={{ maxWidth: '1000px' }}>
      {/* Mobile-Friendly Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f3166, #1b4f9c)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93c5fd' }}>
            Field Workforce Response Terminal
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '4px 0 0' }}>
            {user ? user.name : 'Field Crew'}
          </h1>
          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
            Department: <b>{(user?.department || 'Field Ops').toUpperCase()}</b> | Live Dispatch Active
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('assigned')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === 'assigned' ? '#ffffff' : 'rgba(255,255,255,0.2)',
              color: activeTab === 'assigned' ? '#0f3166' : '#ffffff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Assigned ({tasks.filter((t) => t.status === 'assigned').length})
          </button>
          <button
            onClick={() => setActiveTab('in_progress')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === 'in_progress' ? '#ffffff' : 'rgba(255,255,255,0.2)',
              color: activeTab === 'in_progress' ? '#0f3166' : '#ffffff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            In Progress ({tasks.filter((t) => t.status === 'in_progress').length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: 'none',
              background: activeTab === 'completed' ? '#ffffff' : 'rgba(255,255,255,0.2)',
              color: activeTab === 'completed' ? '#0f3166' : '#ffffff',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Task Cards & Stepper */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading field jobs...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          No jobs currently in "{activeTab}" status.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredTasks.map((task) => {
            const isAccepted = task.assignment_status !== 'assigned';
            return (
              <div key={task.id} className="card" style={{ borderLeft: '5px solid #1b4f9c' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#0f3166' }}>
                      {task.ticket_code}
                    </span>
                    <span className={`badge badge-${task.status}`}>{task.status.replace('_', ' ')}</span>
                  </div>

                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: task.priority > 75 ? '#dc2626' : '#d97706' }}>
                    Priority: {Math.round(task.priority)}
                  </span>
                </div>

                <h3 style={{ fontSize: '15px', color: '#0f172a', margin: '0 0 6px' }}>{task.title || task.category}</h3>
                <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 10px' }}>{task.description}</p>

                {/* Location Details & Google Maps Turn-by-Turn Button */}
                <div
                  style={{
                    background: '#f8fafc',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1b4f9c' }}>📍 Job Location:</div>
                    <div style={{ fontSize: '13px', color: '#0f172a' }}>{task.address}</div>
                    {task.landmark && <div style={{ fontSize: '11px', color: '#64748b' }}>Landmark: {task.landmark}</div>}
                  </div>

                  {task.lat && task.lon && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${task.lat},${task.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ padding: '7px 12px', fontSize: '12.5px', textDecoration: 'none' }}
                    >
                      <Navigation size={14} /> Navigate on Map
                    </a>
                  )}
                </div>

                {/* Initial Before Photo Preview */}
                {(task.images?.[0] || task.best_photo_path) && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>REPORTED DAMAGE PHOTO:</span>
                    <ComplaintImage
                      src={task.images?.[0] || task.best_photo_path}
                      alt="Damage"
                      folder="reports"
                      style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', marginTop: '4px' }}
                    />
                  </div>
                )}

                {/* Workflow Stepper Action Buttons */}
                {task.status === 'assigned' && task.assignment_status === 'assigned' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                    <button
                      onClick={() => handleRespond(task.id, 'accept')}
                      className="btn btn-success"
                      style={{ padding: '10px' }}
                    >
                      <Check size={16} /> Accept Assignment
                    </button>
                    <button
                      onClick={() => setRejectModal(task)}
                      className="btn btn-outline"
                      style={{ padding: '10px', color: '#dc2626' }}
                    >
                      <XCircle size={16} /> Decline Assignment
                    </button>
                  </div>
                )}

                {(task.assignment_status === 'accepted' || task.assignment_status === 'travelling' || task.assignment_status === 'arrived' || task.status === 'in_progress') && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '8px' }}>
                      ON-GROUND WORKFLOW STATUS STEPPER:
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                      <button
                        onClick={() => handleStepUpdate(task.id, 'travelling')}
                        className={`btn ${task.assignment_status === 'travelling' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '8px', fontSize: '12px' }}
                      >
                        🚗 Travelling
                      </button>
                      <button
                        onClick={() => handleStepUpdate(task.id, 'arrived')}
                        className={`btn ${task.assignment_status === 'arrived' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '8px', fontSize: '12px' }}
                      >
                        📍 Arrived On-Site
                      </button>
                      <button
                        onClick={() => handleStepUpdate(task.id, 'in_progress')}
                        className={`btn ${task.assignment_status === 'in_progress' ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '8px', fontSize: '12px' }}
                      >
                        🛠️ Repair In Progress
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px', marginTop: '12px' }}>
                      <button
                        onClick={() => setCompleteModal(task)}
                        className="btn btn-success"
                        style={{ padding: '10px', fontSize: '14px', fontWeight: 'bold' }}
                      >
                        <CheckCircle size={16} /> Complete & Upload Proof
                      </button>
                      <button
                        onClick={() => setUnableModal(task)}
                        className="btn btn-outline"
                        style={{ padding: '10px', fontSize: '12.5px', color: '#d97706' }}
                      >
                        ⚠️ Unable to Complete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Task & Upload Proof Modal */}
      {completeModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Verify & Complete Repair: {completeModal.ticket_code}</h3>
              <button
                onClick={() => setCompleteModal(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#475569' }}>
              An after-repair photograph is mandatory to prove physical resolution to the citizen and department officials.
            </p>

            <form onSubmit={handleCompleteSubmit}>
              <div className="form-group">
                <label className="form-label">After-Repair Proof Photograph *</label>
                {proofPreview ? (
                  <div style={{ position: 'relative', width: '100%', height: '180px', marginBottom: '8px' }}>
                    <img
                      src={proofPreview}
                      alt="Proof"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setProofPhoto(null);
                        setProofPreview(null);
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '50%',
                        width: '28px',
                        height: '28px',
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <label
                    style={{
                      height: '140px',
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: '#f8fafc',
                    }}
                  >
                    <Camera size={32} color="#1b4f9c" />
                    <span style={{ fontSize: '13px', marginTop: '6px', fontWeight: '600' }}>
                      Take / Select After-Repair Photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      required
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setProofPhoto(file);
                          setProofPreview(URL.createObjectURL(file));
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Repair Notes / Work Done Details:</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Detail the materials replaced, repairs performed, and confirmation that site is safe..."
                  value={repairNotes}
                  onChange={(e) => setRepairNotes(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setCompleteModal(null)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!proofPhoto || isCompleting}
                  className="btn btn-success"
                >
                  {isCompleting ? 'Uploading Evidence...' : 'Submit Resolution Proof'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decline Task Modal */}
      {rejectModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Decline Task Assignment</h3>
              <button
                onClick={() => setRejectModal(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#475569' }}>
              Please specify why you are declining ticket <b>{rejectModal.ticket_code}</b>. It will be returned to the department queue.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRespond(rejectModal.id, 'reject', rejectReason);
              }}
            >
              <div className="form-group">
                <label className="form-label">Reason for Declining *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Currently handling live 33kV emergency at bypass"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRejectModal(null)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unable to Complete Modal */}
      {unableModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Report Unable to Complete</h3>
              <button
                onClick={() => setUnableModal(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#475569' }}>
              If a repair cannot be completed on-site due to equipment or safety constraints, document the reason to escalate to officials.
            </p>

            <form onSubmit={handleUnableSubmit}>
              <div className="form-group">
                <label className="form-label">Obstacle / Unresolved Condition *</label>
                <select
                  className="form-select"
                  value={unableReason}
                  onChange={(e) => setUnableReason(e.target.value)}
                  required
                >
                  <option value="">Select Reason...</option>
                  <option value="Requires Heavy Machinery / Crane Support">Requires Heavy Machinery / Crane Support</option>
                  <option value="Sub-station Power Shutdown Authorization Required">Sub-station Power Shutdown Authorization Required</option>
                  <option value="Severe Flooding Water Level Prevents Safe Access">Severe Flooding Water Level Prevents Safe Access</option>
                  <option value="Specialized Replacement Parts Required from Central Depot">Specialized Replacement Parts Required from Central Depot</option>
                  <option value="Site Danger / Unstable Adjacent Structure">Site Danger / Unstable Adjacent Structure</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setUnableModal(null)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!unableReason || isSubmittingUnable}
                  className="btn btn-danger"
                >
                  {isSubmittingUnable ? 'Reporting...' : 'Escalate to Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

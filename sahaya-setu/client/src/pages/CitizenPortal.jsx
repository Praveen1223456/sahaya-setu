import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import InteractiveMap from '../components/InteractiveMap';
import ComplaintImage from '../components/ComplaintImage';
import {
  Camera,
  MapPin,
  Send,
  AlertCircle,
  CheckCircle,
  ThumbsUp,
  Clock,
  RotateCcw,
  Star,
  Layers,
  Sparkles,
  Phone,
  FileText,
  X,
  ChevronRight,
  ExternalLink,
  Mic,
  Volume2,
} from 'lucide-react';
import VoiceComplaintForm from '../components/voice/VoiceComplaintForm';
import VoiceStatusChecker from '../components/voice/VoiceStatusChecker';

const CIVIC_CATEGORIES = [
  { id: 'ELEC-POLE', label: 'Fallen Electricity Pole / Wires', dept: 'Electricity', icon: '⚡', emergency: true },
  { id: 'ELEC-STREETLIGHT', label: 'Streetlight Failure', dept: 'Electricity', icon: '💡', emergency: false },
  { id: 'WATER-LEAK', label: 'Water Pipeline Leakage / Burst', dept: 'Water Supply', icon: '💧', emergency: false },
  { id: 'WATER-SUPPLY', label: 'Water Supply Interruption', dept: 'Water Supply', icon: '🚰', emergency: false },
  { id: 'ROAD-POTHOLE', label: 'Damaged Road / Pothole', dept: 'Roads & Infra', icon: '🚧', emergency: false },
  { id: 'ROAD-BLOCKED', label: 'Blocked Road / Culvert Damage', dept: 'Roads & Infra', icon: '🛑', emergency: false },
  { id: 'GARBAGE-DUMP', label: 'Garbage Accumulation', dept: 'Sanitation', icon: '🗑️', emergency: false },
  { id: 'TREE-FALLEN', label: 'Fallen Tree Blocking Road', dept: 'Horticulture', icon: '🌳', emergency: false },
  { id: 'DRAINAGE-OVERFLOW', label: 'Drainage & Sewage Overflow', dept: 'Drainage', icon: '🌊', emergency: false },
  { id: 'DISASTER-FLOOD', label: 'Flooding & Cyclone Damage', dept: 'Emergency Ops', icon: '🚨', emergency: true },
];

export default function CitizenPortal() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('report'); // 'report' | 'my_reports'

  // Form State
  const [category, setCategory] = useState('ELEC-POLE');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState(16.5787);
  const [lon, setLon] = useState(82.0061);
  const [address, setAddress] = useState('Clock Tower, Amalapuram');
  const [landmark, setLandmark] = useState('');
  const [phone, setPhone] = useState(user?.phone || '9876543210');
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Duplicate Check Modal State
  const [showDupModal, setShowDupModal] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Success Confirmation State
  const [submissionSuccess, setSubmissionSuccess] = useState(null);

  // My Reports State
  const [myReports, setMyReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Verification Modal State
  const [verifyModal, setVerifyModal] = useState(null);
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Auto-detect GPS on mount
  useEffect(() => {
    handleDetectGPS();
  }, []);

  // Fetch my reports when switching to tab
  useEffect(() => {
    if (activeTab === 'my_reports') {
      fetchMyReports();
    }
  }, [activeTab, user]);

  const handleDetectGPS = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const detectedLat = pos.coords.latitude;
        const detectedLon = pos.coords.longitude;
        setLat(detectedLat);
        setLon(detectedLon);
        setIsLocating(false);
        try {
          const res = await fetch(`/api/complaints/check-duplicates?lat=${detectedLat}&lon=${detectedLon}&category=${category}`);
          const geoRes = await fetch(`/geo/reverse?lat=${detectedLat}&lon=${detectedLon}`);
          if (geoRes.ok) {
            const data = await geoRes.json();
            if (data.address) setAddress(data.address);
          }
        } catch (e) {
          // ignore
        }
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleLocationSelect = async (newLat, newLon) => {
    setLat(newLat);
    setLon(newLon);
    try {
      const res = await fetch(`/geo/reverse?lat=${newLat}&lon=${newLon}`);
      if (res.ok) {
        const data = await res.json();
        if (data.address) setAddress(data.address);
      }
    } catch (e) {
      setAddress(`Coordinates: ${newLat.toFixed(5)}, ${newLon.toFixed(5)}`);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setImages((prev) => [...prev, ...files].slice(0, 4));

    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newPreviews].slice(0, 4));
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit flow: first check duplicates, then submit
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Check duplicate detection first!
    try {
      const res = await fetch(
        `/api/complaints/check-duplicates?lat=${lat}&lon=${lon}&category=${category}&radius_m=250`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.has_duplicates && data.matches.length > 0) {
          setDuplicates(data.matches);
          setShowDupModal(true);
          return;
        }
      }
    } catch (err) {
      console.warn('Duplicate check failed, proceeding to submit:', err);
    }

    proceedSubmit();
  };

  const proceedSubmit = async () => {
    setIsSubmitting(true);
    setShowDupModal(false);

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description);
      formData.append('lat', lat);
      formData.append('lon', lon);
      formData.append('address', address);
      formData.append('landmark', landmark);
      formData.append('phone', phone);
      formData.append('citizen_name', user ? user.name : 'Citizen');

      images.forEach((img) => {
        formData.append('images', img);
      });

      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Submission failed');

      setSubmissionSuccess(data);
      // Reset form
      setDescription('');
      setImages([]);
      setPreviews([]);
      setLandmark('');
    } catch (err) {
      alert(`Error submitting report: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvoteExisting = async (dupId) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/complaints/${dupId}/upvote`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowDupModal(false);
        alert(`Thank you! You have backed ticket ${data.ticket_code}. You will receive updates as repairs progress.`);
        setActiveTab('my_reports');
      }
    } catch (err) {
      alert(`Failed to upvote report: ${err.message}`);
    }
  };

  const fetchMyReports = async () => {
    setLoadingReports(true);
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/complaints/my', { headers });
      if (res.ok) {
        const data = await res.json();
        setMyReports(data);
      }
    } catch (err) {
      console.warn('Failed to load my reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleVerifyResolution = async (isResolved) => {
    if (!verifyModal) return;
    setIsVerifying(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/complaints/${verifyModal.id}/verify-resolution`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          is_resolved: isResolved,
          rating: isResolved ? rating : 1,
          comment: feedbackComment,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Verification failed');
      }

      setVerifyModal(null);
      setFeedbackComment('');
      fetchMyReports();
      alert(
        isResolved
          ? 'Thank you! The complaint has been verified and officially closed.'
          : 'Complaint reopened and escalated back to Department Administrator for immediate review.'
      );
    } catch (err) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="app-container">
      {/* Header Tabs */}
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
            Citizen Civic Response Portal
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9375rem', margin: '4px 0 0' }}>
            Report public infrastructure damage, track real-time repairs, and verify completed fixes
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', background: '#e2e8f0', borderRadius: '8px', padding: '4px' }}>
          <button
            onClick={() => setActiveTab('report')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'report' ? '#ffffff' : 'transparent',
              color: activeTab === 'report' ? '#1b4f9c' : '#475569',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              boxShadow: activeTab === 'report' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Report Form
          </button>
          <button
            id="voice-tab-btn"
            onClick={() => setActiveTab('voice')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'voice' ? '#2563eb' : 'transparent',
              color: activeTab === 'voice' ? '#ffffff' : '#1e3a8a',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'voice' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <Mic size={16} /> Speak / Voice Report
          </button>
          <button
            id="status-tab-btn"
            onClick={() => setActiveTab('status')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'status' ? '#16a34a' : 'transparent',
              color: activeTab === 'status' ? '#ffffff' : '#065f46',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: activeTab === 'status' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <Volume2 size={16} /> Voice Status Assistant
          </button>
          <button
            onClick={() => setActiveTab('my_reports')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'my_reports' ? '#ffffff' : 'transparent',
              color: activeTab === 'my_reports' ? '#1b4f9c' : '#475569',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px',
              boxShadow: activeTab === 'my_reports' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            My Reports ({myReports.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Submit Report */}
      {activeTab === 'report' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Submission Form Card */}
          <div className="card">
            {/* Quick banner to switch to voice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                marginBottom: '1rem',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>🎙️</span>
                <div>
                  <div style={{ fontWeight: '600', color: '#1e3a8a', fontSize: '14px' }}>
                    Speak in Telugu, Hindi or English
                  </div>
                  <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                    వాయిస్ ద్వారా సులభంగా ఫిర్యాదు చేయండి / बोलकर शिकायत दर्ज करें
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('voice')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Mic size={14} /> Report by Voice
              </button>
            </div>

            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#0f172a' }}>
              1. What is the infrastructure problem?
            </h2>

            <form onSubmit={handleFormSubmit}>
              {/* Category Selector Grid */}
              <div className="form-group">
                <label className="form-label">Select Issue Category</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: '8px',
                    marginBottom: '1rem',
                  }}
                >
                  {CIVIC_CATEGORIES.map((cat) => {
                    const isSelected = category === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #1b4f9c' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: '600', color: isSelected ? '#1b4f9c' : '#1e293b' }}>
                            {cat.label}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Routes to: {cat.dept}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Detailed Description of the Hazard</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Describe what happened, damage severity, and whether live power or traffic is affected..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* Image Uploads */}
              <div className="form-group">
                <label className="form-label">Photographs of the Damage (Up to 4 images)</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {previews.map((src, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '80px', height: '80px' }}>
                      <img
                        src={src}
                        alt="preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-6px',
                          background: '#dc2626',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {previews.length < 4 && (
                    <label
                      style={{
                        width: '80px',
                        height: '80px',
                        border: '2px dashed #cbd5e1',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#64748b',
                        background: '#f8fafc',
                      }}
                    >
                      <Camera size={22} />
                      <span style={{ fontSize: '11px', marginTop: '4px' }}>Add Photo</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageChange} style={{ display: 'none' }} />
                    </label>
                  )}
                </div>
              </div>

              {/* Landmark & Phone */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Nearby Landmark / Street Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Near SBI Main Branch"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Phone Number (for updates)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '16px', marginTop: '0.5rem' }}
              >
                {isSubmitting ? 'Verifying & Submitting...' : 'Submit Complaint to Department'}
              </button>
            </form>
          </div>

          {/* Interactive Map Pin Selection Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>2. Confirm Exact Location</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Click or drag pin to fine-tune report location</span>
              </div>
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isLocating}
                className="btn btn-outline"
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                <MapPin size={14} /> {isLocating ? 'Locating...' : 'Detect GPS'}
              </button>
            </div>

            <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#eff6ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#1b4f9c', fontWeight: 'bold' }}>📍 Detected Address:</div>
              <div style={{ fontSize: '13px', color: '#0f172a', marginTop: '2px' }}>{address}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                GPS Coordinates: {lat.toFixed(5)}, {lon.toFixed(5)}
              </div>
            </div>

            <InteractiveMap
              center={[lat, lon]}
              zoom={15}
              height="380px"
              selectable={true}
              selectedLocation={{ lat, lng: lon }}
              onLocationSelect={handleLocationSelect}
            />
          </div>
        </div>
      )}

      {/* Tab: Voice Report */}
      {activeTab === 'voice' && (
        <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <VoiceComplaintForm
            onTicketCreated={() => {
              fetchMyReports();
            }}
            onBack={() => setActiveTab('my_reports')}
          />
        </div>
      )}

      {/* Tab: Voice Status Assistant */}
      {activeTab === 'status' && (
        <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <VoiceStatusChecker
            onSelectTicket={(ticket) => {
              setActiveTab('my_reports');
            }}
          />
        </div>
      )}

      {/* Tab 2: My Reports & Resolution Verification */}
      {activeTab === 'my_reports' && (
        <div style={{ display: 'grid', gridTemplateColumns: selectedReport ? '1fr 1fr' : '1fr', gap: '1.5rem' }}>
          {/* Reports Table/Cards */}
          <div className="card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#0f172a' }}>My Submitted Complaints</h2>

            {loadingReports ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading your complaints...</div>
            ) : myReports.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                You have not submitted any complaints yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myReports.map((rep) => (
                  <div
                    key={rep._id || rep.id}
                    onClick={() => setSelectedReport(rep)}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: selectedReport?.id === rep.id ? '2px solid #1b4f9c' : '1px solid #e2e8f0',
                      background: selectedReport?.id === rep.id ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      gap: '14px',
                      alignItems: 'flex-start',
                    }}
                  >
                    <ComplaintImage
                      src={rep.images?.[0] || rep.best_photo_path}
                      alt={rep.ticket_code || 'Complaint'}
                      style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '15px', color: '#0f3166' }}>
                          {rep.ticket_code || `SS-${rep.id}`}
                        </span>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {(rep.input_method === 'VOICE' || rep.inputMethod === 'VOICE' || rep.voice_metadata || rep.voiceMetadata) && (
                            <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                              🎤 Voice Report
                            </span>
                          )}
                          <span className={`badge badge-${rep.status}`}>{rep.status.replace('_', ' ')}</span>
                        </div>
                      </div>

                      <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', color: '#0f172a' }}>
                        {rep.title || rep.category}
                      </div>

                      <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '10px' }}>
                        📍 {rep.address || 'Location on map'}
                      </div>

                      {/* Prominent Action for Resolved Complaints */}
                      {rep.status === 'resolved' && (
                        <div
                          style={{
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontSize: '13px' }}>
                            <CheckCircle size={18} />
                            <span><b>Repair Completed!</b> Please verify the resolution.</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVerifyModal(rep);
                            }}
                            className="btn btn-success"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            Verify Fix
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Report Detailed View & Proof Comparison */}
          {selectedReport && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ margin: 0 }}>Ticket Details: {selectedReport.ticket_code}</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Department: <b>{selectedReport.department?.toUpperCase()}</b>
                  </span>
                </div>
                <button
                  onClick={() => setSelectedReport(null)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                >
                  ×
                </button>
              </div>

              {/* Side-by-Side Proof Photos if Resolved */}
              {selectedReport.status === 'resolved' || selectedReport.status === 'closed' ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13.5px', marginBottom: '8px' }}>
                    📸 Before vs. After Repair Proof:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 'bold' }}>BEFORE REPAIR:</span>
                      <ComplaintImage
                        src={selectedReport.images?.[0] || selectedReport.best_photo_path}
                        alt="Before Repair"
                        folder="reports"
                        style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginTop: '4px' }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold' }}>AFTER REPAIR:</span>
                      <ComplaintImage
                        src={selectedReport.resolution_photo_path || selectedReport.after_images?.[0]}
                        alt="After Repair"
                        folder="resolutions"
                        style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', marginTop: '4px' }}
                      />
                    </div>
                  </div>
                  {selectedReport.resolution_notes && (
                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', marginTop: '8px', fontSize: '12.5px' }}>
                      <b>Field Crew Notes:</b> {selectedReport.resolution_notes}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginBottom: '1rem' }}>
                  <ComplaintImage
                    src={selectedReport.images?.[0] || selectedReport.best_photo_path}
                    alt="Report Evidence"
                    folder="reports"
                    style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                </div>
              )}

              {/* Status Stepper Progression */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#0f172a' }}>
                  Repair Status Progression:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b' }}>
                  <span style={{ color: '#1b4f9c', fontWeight: 'bold' }}>1. Received</span>
                  <span>→</span>
                  <span style={{ color: selectedReport.status !== 'received' ? '#1b4f9c' : '#94a3b8', fontWeight: selectedReport.status !== 'received' ? 'bold' : 'normal' }}>
                    2. Assigned
                  </span>
                  <span>→</span>
                  <span style={{ color: ['in_progress', 'resolved', 'closed'].includes(selectedReport.status) ? '#1b4f9c' : '#94a3b8', fontWeight: ['in_progress', 'resolved', 'closed'].includes(selectedReport.status) ? 'bold' : 'normal' }}>
                    3. In Progress
                  </span>
                  <span>→</span>
                  <span style={{ color: ['resolved', 'closed'].includes(selectedReport.status) ? '#16a34a' : '#94a3b8', fontWeight: ['resolved', 'closed'].includes(selectedReport.status) ? 'bold' : 'normal' }}>
                    4. Resolved
                  </span>
                </div>
              </div>

              {/* Verify Button if Resolved */}
              {selectedReport.status === 'resolved' && (
                <button
                  onClick={() => setVerifyModal(selectedReport)}
                  className="btn btn-success"
                  style={{ width: '100%', padding: '12px', fontSize: '15px' }}
                >
                  Verify Resolution & Close Ticket
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Duplicate Detection Alert Modal */}
      {showDupModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706' }}>
                <AlertCircle size={22} />
                <h3 style={{ margin: 0, color: '#0f172a' }}>Nearby Matching Report Detected</h3>
              </div>
              <button
                onClick={() => setShowDupModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
              We detected an existing open report for a similar <b>{category}</b> issue within 250 meters of your location:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '14px 0' }}>
              {duplicates.slice(0, 2).map((dup) => (
                <div
                  key={dup.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    background: '#f8fafc',
                    display: 'flex',
                    gap: '12px',
                  }}
                >
                  {dup.images && dup.images[0] && (
                    <ComplaintImage
                      src={dup.images[0]}
                      alt="dup"
                      folder="reports"
                      style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '6px' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#0f3166' }}>
                      {dup.ticket_code}: {dup.category}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>📍 {dup.address} ({dup.distance_m}m away)</div>
                    <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 'bold', marginTop: '4px' }}>
                      👍 {dup.upvotes || 0} Citizens currently backing this report
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUpvoteExisting(dup.id)}
                      className="btn btn-primary"
                      style={{ padding: '5px 10px', fontSize: '12px', marginTop: '8px' }}
                    >
                      <ThumbsUp size={13} /> Support / Back This Ticket
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={proceedSubmit}
                className="btn btn-outline"
                style={{ fontSize: '13px' }}
              >
                Continue Submitting Separate Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification & Feedback Modal */}
      {verifyModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Verify Repair Resolution</h3>
              <button
                onClick={() => setVerifyModal(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#475569' }}>
              Ticket <b>{verifyModal.ticket_code}</b> was marked resolved by the field repair team. Did they fix the problem to your satisfaction?
            </p>

            <div className="form-group">
              <label className="form-label">Rate the Resolution Quality:</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setRating(s)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '28px',
                      color: s <= rating ? '#eab308' : '#cbd5e1',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Citizen Feedback / Notes:</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Share your feedback or explain what remains broken if rejecting..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleVerifyResolution(true)}
                className="btn btn-success"
                style={{ padding: '10px' }}
              >
                <CheckCircle size={16} /> Yes, Confirmed Fixed
              </button>
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleVerifyResolution(false)}
                className="btn btn-danger"
                style={{ padding: '10px' }}
              >
                <RotateCcw size={16} /> Not Fixed (Reopen)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Success Dialog */}
      {submissionSuccess && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle size={36} />
            </div>

            <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: '#0f172a' }}>
              Complaint Registered Successfully!
            </h2>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1b4f9c', margin: '10px 0' }}>
              {submissionSuccess.ticket_code}
            </div>
            <p style={{ color: '#64748b', fontSize: '13.5px', marginBottom: '20px' }}>
              Assigned automatically to <b>{submissionSuccess.department.toUpperCase()}</b> department. SLA resolution target: {new Date(submissionSuccess.sla_due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}.
            </p>

            <button
              onClick={() => {
                setSubmissionSuccess(null);
                setActiveTab('my_reports');
              }}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              Track Complaint Progress
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

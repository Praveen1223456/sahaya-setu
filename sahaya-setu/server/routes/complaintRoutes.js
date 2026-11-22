const express = require('express');
const router = express.Router();

const Incident = require('../models/Incident');
const StatusEvent = require('../models/StatusEvent');
const Assignment = require('../models/Assignment');
const Feedback = require('../models/Feedback');
const { getNextSequence } = require('../models/Counter');
const { resolveCategory } = require('../config/categoryRouting');
const formatters = require('../views/formatters');
const geo = require('../services/geo');
const { upload } = require('../middleware/upload');
const { uploadMultipleImages, uploadImage } = require('../services/storage');
const { optionalJWT, authenticateJWT, requireRole } = require('../middleware/jwtAuth');
const {
  notifyDepartment,
  notifyRole,
  notifyUser,
  createAndPushNotification,
} = require('../services/socket');

// Distance calculator (Haversine in meters)
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeComplaint(inc) {
  if (!inc) return inc;
  const obj = typeof inc.toObject === 'function' ? inc.toObject() : { ...inc };
  if (obj.best_photo_path) {
    obj.best_photo_path = formatters.uploadUrl(obj.best_photo_path);
  }
  if (obj.resolution_photo_path) {
    obj.resolution_photo_path = formatters.uploadUrl(obj.resolution_photo_path);
  }
  if (Array.isArray(obj.images)) {
    obj.images = obj.images.map((img) => formatters.uploadUrl(img)).filter(Boolean);
  } else if (obj.images && typeof obj.images === 'string') {
    obj.images = [formatters.uploadUrl(obj.images)].filter(Boolean);
  }
  if (Array.isArray(obj.after_images)) {
    obj.after_images = obj.after_images.map((img) => formatters.uploadUrl(img)).filter(Boolean);
  } else if (obj.after_images && typeof obj.after_images === 'string') {
    obj.after_images = [formatters.uploadUrl(obj.after_images)].filter(Boolean);
  }
  return obj;
}

// 1. Check for Duplicate Complaints (Pre-Submission Check)
router.get('/check-duplicates', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const category = req.query.category || '';
    const radiusM = parseFloat(req.query.radius_m || '250');

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ detail: 'lat and lon are required numbers' });
    }

    const { department } = resolveCategory(category);

    // Find open incidents
    const openIncidents = await Incident.find({
      status: { $in: ['received', 'assigned', 'in_progress', 'review', 'escalated'] },
      lat: { $ne: null },
      lon: { $ne: null },
    }).sort({ created_at: -1 });

    const matches = [];
    for (const inc of openIncidents) {
      const dist = distanceMeters(lat, lon, inc.lat, inc.lon);
      if (dist <= radiusM) {
        // High similarity if category or department matches
        const catMatch =
          inc.category === category ||
          inc.department === department ||
          inc.category.startsWith(category.split('-')[0]);

        if (catMatch) {
          matches.push({
            id: inc.id,
            ticket_code: inc.ticket_code,
            category: inc.category,
            department: inc.department,
            title: inc.title || inc.description,
            description: inc.description,
            address: inc.address,
            landmark: inc.landmark,
            status: inc.status,
            priority: inc.priority,
            upvotes: inc.upvotes || 0,
            report_count: inc.report_count || 1,
            images: (inc.images && inc.images.length > 0 ? inc.images : [inc.best_photo_path].filter(Boolean)).map((img) => formatters.uploadUrl(img)),
            created_at: inc.created_at,
            distance_m: Math.round(dist),
          });
        }
      }
    }

    res.json({
      count: matches.length,
      has_duplicates: matches.length > 0,
      radius_m: radiusM,
      matches,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Upvote / Back an Existing Complaint
router.post('/:id/upvote', optionalJWT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const inc = await Incident.findOne({ id });
    if (!inc) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }

    const supporterKey = req.user
      ? String(req.user.id || req.user._id)
      : req.body.phone || 'anonymous';

    if (!inc.supporters.includes(supporterKey)) {
      inc.supporters.push(supporterKey);
      inc.upvotes = (inc.upvotes || 0) + 1;
      inc.report_count = (inc.report_count || 1) + 1;
      inc.priority = Math.min(100, inc.priority + 5);
      await inc.save();

      // Log status event
      const evId = await getNextSequence('status_events');
      const ev = new StatusEvent({
        id: evId,
        incident_id: inc.id,
        status: inc.status,
        note: `Additional citizen backed this issue (Total supporters: ${inc.upvotes})`,
        actor: req.user ? req.user.name : 'Citizen',
        actor_role: 'citizen',
      });
      await ev.save();

      // Notify department
      notifyDepartment(inc.department, 'complaint_updated', {
        id: inc.id,
        ticket_code: inc.ticket_code,
        upvotes: inc.upvotes,
        priority: inc.priority,
      });
    }

    res.json({
      ok: true,
      id: inc.id,
      ticket_code: inc.ticket_code,
      upvotes: inc.upvotes,
      priority: inc.priority,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Submit New Smart Complaint (Multi-image, GPS, Auto-routing)
router.post('/', optionalJWT, upload.array('images', 5), async (req, res, next) => {
  try {
    const body = req.body || {};
    let meta = body;
    if (typeof body.meta === 'string') {
      try {
        meta = JSON.parse(body.meta);
      } catch (e) {
        meta = body;
      }
    }

    const categoryKey = meta.category || 'OTHER';
    const routing = resolveCategory(categoryKey);

    const lat = meta.lat !== undefined && meta.lat !== null ? parseFloat(meta.lat) : null;
    const lon = meta.lon !== undefined && meta.lon !== null ? parseFloat(meta.lon) : null;
    const gpsAccuracy = meta.gps_accuracy_m ? parseFloat(meta.gps_accuracy_m) : null;

    // Resolve address if lat/lon provided
    let address = meta.address || null;
    if ((!address || address.trim() === '') && lat !== null && lon !== null) {
      try {
        address = await geo.reverseGeocode(lat, lon);
      } catch (e) {
        address = `Coordinates: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      }
    }

    // Process uploaded images
    const imageBuffers = [];
    if (req.files && Array.isArray(req.files)) {
      for (const f of req.files) {
        if (f.buffer) imageBuffers.push(f.buffer);
      }
    } else if (req.file && req.file.buffer) {
      imageBuffers.push(req.file.buffer);
    }

    const uploadedUrls = await uploadMultipleImages(imageBuffers, 'reports');

    // Create unique ID
    const nextId = await getNextSequence('incidents');
    const now = new Date();
    const slaDueAt = new Date(now.getTime() + routing.sla_hours * 3600000);

    const isDisaster = meta.is_disaster_mode === true || meta.is_disaster_mode === 'true';
    const emergencySeverity = meta.emergency_severity || (routing.emergency ? 'high' : 'low');

    const incident = new Incident({
      id: nextId,
      title: meta.title || `${routing.label} reported at ${address ? address.split(',')[0] : 'location'}`,
      description: meta.description || '',
      category: routing.key,
      department: routing.department,
      status: 'received',

      lat,
      lon,
      gps_accuracy_m: gpsAccuracy,
      address,
      landmark: meta.landmark || '',

      citizen_id: req.user ? req.user.id || req.user._id : null,
      citizen_name: req.user ? req.user.name : meta.citizen_name || 'Citizen',
      citizen_phone: req.user ? req.user.phone : meta.phone || '',

      images: uploadedUrls,
      best_photo_path: uploadedUrls[0] || null,

      severity: routing.severity,
      priority: routing.severity * 15 + (isDisaster ? 30 : 0),
      is_disaster_mode: isDisaster,
      emergency_severity: emergencySeverity,

      sla_due_at: slaDueAt,
      created_at: now,
      updated_at: now,
    });

    await incident.save();

    // Log initial timeline event
    const evId = await getNextSequence('status_events');
    const initialEvent = new StatusEvent({
      id: evId,
      incident_id: incident.id,
      status: 'received',
      note: `Complaint submitted. Automatically assigned to ${routing.department.toUpperCase()} department with ${routing.sla_hours}h SLA.`,
      actor: req.user ? req.user.name : 'Citizen',
      actor_role: 'citizen',
      created_at: now,
    });
    await initialEvent.save();

    // Trigger Real-Time Notification over Socket.IO
    await createAndPushNotification({
      department: routing.department,
      title: `New ${routing.label} Reported`,
      message: `${incident.ticket_code}: ${incident.title} (${incident.address || 'Location provided'})`,
      complaint_id: incident.id,
      ticket_code: incident.ticket_code,
      type: 'complaint_submitted',
    });

    res.status(201).json({
      ok: true,
      id: incident.id,
      ticket_code: incident.ticket_code,
      category: incident.category,
      department: incident.department,
      status: incident.status,
      address: incident.address,
      images: incident.images,
      sla_due_at: incident.sla_due_at,
      created_at: incident.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// 4. List Complaints with Filter & Search
router.get('/', optionalJWT, async (req, res, next) => {
  try {
    const filter = {};

    // Role-based restrictions
    if (req.user && req.user.role === 'department_admin' && req.user.department !== '*') {
      filter.department = req.user.department;
    } else if (req.query.department && req.query.department !== '*') {
      filter.department = req.query.department;
    }

    if (req.query.status) {
      filter.status = { $in: req.query.status.split(',').map((s) => s.trim()) };
    }

    if (req.query.is_disaster_mode !== undefined) {
      filter.is_disaster_mode = req.query.is_disaster_mode === 'true';
    }

    if (req.query.emergency_severity) {
      filter.emergency_severity = req.query.emergency_severity;
    }

    if (req.query.search) {
      const q = req.query.search.trim();
      const numMatch = q.match(/\d+/);
      const orClauses = [
        { description: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } },
        { landmark: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
      ];
      if (numMatch) {
        orClauses.push({ id: parseInt(numMatch[0], 10) });
      }
      filter.$or = orClauses;
    }

    const limit = Math.min(parseInt(req.query.limit || '200', 10), 500);
    const complaints = await Incident.find(filter)
      .sort({ is_disaster_mode: -1, priority: -1, created_at: -1 })
      .limit(limit);

    res.json({
      count: complaints.length,
      complaints: complaints.map(normalizeComplaint),
    });
  } catch (err) {
    next(err);
  }
});

// 5. My Complaints (Logged-in Citizen)
router.get('/my', authenticateJWT, async (req, res, next) => {
  try {
    const Report = require('../models/Report');
    const orFilter = [];
    if (req.user._id || req.user.id) {
      orFilter.push({ citizen_id: req.user._id || req.user.id });
    }
    const phone = req.user.phone || req.user.sub || null;
    if (phone) {
      orFilter.push({ citizen_phone: phone });
      const rawNumbers = await Report.distinct('incident_id', { phone });
      if (rawNumbers && rawNumbers.length > 0) {
        orFilter.push({ id: { $in: rawNumbers } });
      }
    }

    if (orFilter.length === 0) {
      return res.json([]);
    }

    const complaints = await Incident.find({ $or: orFilter }).sort({ created_at: -1 });
    res.json(complaints.map(normalizeComplaint));
  } catch (err) {
    next(err);
  }
});

// 6. Single Complaint Detail with Timeline & Evidence
router.get('/:id', optionalJWT, async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const match = rawId.match(/\d+/);
    if (!match) {
      return res.status(400).json({ detail: 'Invalid complaint ID' });
    }

    const id = parseInt(match[0], 10);
    const complaint = await Incident.findOne({ id });
    if (!complaint) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }

    // Load timeline events
    const timeline = await StatusEvent.find({ incident_id: id }).sort({ created_at: 1 });

    // Load current assignment if any
    const assignment = await Assignment.findOne({ complaint_id: id }).sort({ assigned_at: -1 });

    // Load feedback if any
    const feedback = await Feedback.findOne({ complaint_id: id });

    res.json({
      complaint: normalizeComplaint(complaint),
      timeline,
      assignment,
      feedback,
    });
  } catch (err) {
    next(err);
  }
});

// 7. Re-route Department (Admin / Super Admin)
router.post(
  '/:id/reroute',
  authenticateJWT,
  requireRole('department_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { new_department, reason } = req.body || {};

      if (!new_department) {
        return res.status(400).json({ detail: 'new_department is required' });
      }

      const complaint = await Incident.findOne({ id });
      if (!complaint) {
        return res.status(404).json({ detail: 'Complaint not found' });
      }

      const oldDept = complaint.department;
      complaint.department = new_department.toLowerCase().trim();
      complaint.updated_at = new Date();
      await complaint.save();

      // Log event
      const evId = await getNextSequence('status_events');
      const ev = new StatusEvent({
        id: evId,
        incident_id: complaint.id,
        status: complaint.status,
        note: `Department corrected: re-routed from ${oldDept.toUpperCase()} to ${new_department.toUpperCase()}. Reason: ${reason || 'Administrative re-allocation'}`,
        actor: req.user.name,
        actor_role: req.user.role,
      });
      await ev.save();

      // Notify new department
      await createAndPushNotification({
        department: complaint.department,
        title: `Re-routed Task: ${complaint.ticket_code}`,
        message: `${complaint.ticket_code} was re-assigned to your department by ${req.user.name}`,
        complaint_id: complaint.id,
        ticket_code: complaint.ticket_code,
        type: 'complaint_submitted',
      });

      res.json({
        ok: true,
        id: complaint.id,
        ticket_code: complaint.ticket_code,
        old_department: oldDept,
        new_department: complaint.department,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 8. Citizen Verify Resolution & Feedback / Reopen Flow
router.post('/:id/verify-resolution', optionalJWT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { is_resolved, rating, comment } = req.body || {};

    if (typeof is_resolved !== 'boolean') {
      return res.status(400).json({ detail: 'is_resolved boolean is required' });
    }

    const complaint = await Incident.findOne({ id });
    if (!complaint) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }

    const now = new Date();

    if (is_resolved) {
      // Citizen approves resolution
      complaint.status = 'closed';
      complaint.closed_at = now;
      complaint.verification_status = 'verified';
      complaint.citizen_feedback = {
        rating: rating ? parseInt(rating, 10) : 5,
        comment: comment || 'Citizen confirmed issue resolved.',
        submitted_at: now,
      };
      await complaint.save();

      // Save feedback document
      const fb = new Feedback({
        complaint_id: complaint.id,
        incident_oid: complaint._id,
        citizen_id: req.user ? req.user.id || req.user._id : null,
        citizen_phone: complaint.citizen_phone,
        rating: rating ? parseInt(rating, 10) : 5,
        comment: comment || 'Verified and closed',
        is_resolved: true,
        reopened: false,
      });
      await fb.save();

      // Log status event
      const evId = await getNextSequence('status_events');
      const ev = new StatusEvent({
        id: evId,
        incident_id: complaint.id,
        status: 'closed',
        note: `Citizen verified repair and gave ${rating || 5}-star rating. Note: ${comment || 'Resolved successfully'}`,
        actor: req.user ? req.user.name : 'Citizen',
        actor_role: 'citizen',
      });
      await ev.save();

      await createAndPushNotification({
        department: complaint.department,
        title: `Resolution Verified: ${complaint.ticket_code}`,
        message: `Citizen verified resolution of ${complaint.ticket_code} with ${rating || 5} stars.`,
        complaint_id: complaint.id,
        ticket_code: complaint.ticket_code,
        type: 'resolution_verified',
      });
    } else {
      // Citizen REJECTS resolution -> Reopen and escalate back to department admin
      complaint.status = 'escalated';
      complaint.verification_status = 'rejected_reopened';
      complaint.reopen_count = (complaint.reopen_count || 0) + 1;
      complaint.assignment_status = 'rejected';
      complaint.citizen_feedback = {
        rating: rating ? parseInt(rating, 10) : 1,
        comment: comment || 'Citizen reported the issue was NOT fixed.',
        submitted_at: now,
      };
      await complaint.save();

      // Save feedback document
      const fb = new Feedback({
        complaint_id: complaint.id,
        incident_oid: complaint._id,
        citizen_id: req.user ? req.user.id || req.user._id : null,
        citizen_phone: complaint.citizen_phone,
        rating: rating ? parseInt(rating, 10) : 1,
        comment: comment || 'Work incomplete / problem remains',
        is_resolved: false,
        reopened: true,
      });
      await fb.save();

      // Log status event
      const evId = await getNextSequence('status_events');
      const ev = new StatusEvent({
        id: evId,
        incident_id: complaint.id,
        status: 'escalated',
        note: `Citizen rejected resolution: "${comment || 'Problem remains unresolved'}". Reopened for administrative review.`,
        actor: req.user ? req.user.name : 'Citizen',
        actor_role: 'citizen',
      });
      await ev.save();

      await createAndPushNotification({
        department: complaint.department,
        title: `CRITICAL: Reopened Ticket ${complaint.ticket_code}`,
        message: `Citizen rejected repair: "${comment || 'Problem remains'}". Immediate review required.`,
        complaint_id: complaint.id,
        ticket_code: complaint.ticket_code,
        type: 'complaint_reopened',
      });
    }

    res.json({
      ok: true,
      id: complaint.id,
      ticket_code: complaint.ticket_code,
      status: complaint.status,
      verification_status: complaint.verification_status,
      closed_at: complaint.closed_at,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

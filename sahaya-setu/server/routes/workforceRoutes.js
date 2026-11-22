const express = require('express');
const router = express.Router();

const Incident = require('../models/Incident');
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const StatusEvent = require('../models/StatusEvent');
const { getNextSequence } = require('../models/Counter');
const formatters = require('../views/formatters');
const { upload } = require('../middleware/upload');
const { uploadMultipleImages, uploadImage } = require('../services/storage');
const { authenticateJWT, requireRole } = require('../middleware/jwtAuth');
const {
  notifyUser,
  notifyDepartment,
  createAndPushNotification,
} = require('../services/socket');

// 1. Suggest / Recommend Employees for Complaint (Rule-Based Assignment Algorithm)
router.get(
  '/recommend/:complaint_id',
  authenticateJWT,
  requireRole('department_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.complaint_id, 10);
      const inc = await Incident.findOne({ id });
      if (!inc) {
        return res.status(404).json({ detail: 'Complaint not found' });
      }

      // Find employees in the responsible department
      const employees = await User.find({
        role: 'field_employee',
        $or: [{ department: inc.department }, { department: '*' }],
      }).select('-password');

      // Score employees based on availability, current workload, and skills
      const scored = await Promise.all(
        employees.map(async (emp) => {
          const activeTasks = await Incident.countDocuments({
            assigned_employee_id: emp._id,
            status: { $in: ['assigned', 'in_progress'] },
          });

          let score = 100;
          // Availability penalty
          if (emp.availability === 'busy') score -= 30;
          if (emp.availability === 'off_duty') score -= 80;

          // Workload penalty (10 points per active task)
          score -= activeTasks * 12;

          // Department match bonus
          if (emp.department === inc.department) score += 20;

          // Skill match bonus
          const categoryKeywords = inc.category.toLowerCase().split('-');
          const hasSkillMatch = (emp.skills || []).some((skill) =>
            categoryKeywords.some((kw) => skill.toLowerCase().includes(kw))
          );
          if (hasSkillMatch) score += 25;

          return {
            ...emp.toObject(),
            activeTasksCount: activeTasks,
            matchScore: Math.max(0, score),
            hasSkillMatch,
          };
        })
      );

      scored.sort((a, b) => b.matchScore - a.matchScore);

      res.json({
        complaint_id: inc.id,
        ticket_code: inc.ticket_code,
        department: inc.department,
        recommended: scored,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 2. Assign Complaint to Employee (Admin Action)
router.post(
  '/assign',
  authenticateJWT,
  requireRole('department_admin', 'super_admin'),
  async (req, res, next) => {
    try {
      const { complaint_id, employee_id, notes } = req.body || {};

      if (!complaint_id || !employee_id) {
        return res.status(400).json({ detail: 'complaint_id and employee_id are required' });
      }

      const inc = await Incident.findOne({ id: parseInt(complaint_id, 10) });
      if (!inc) {
        return res.status(404).json({ detail: 'Complaint not found' });
      }

      const emp = await User.findById(employee_id);
      if (!emp || emp.role !== 'field_employee') {
        return res.status(400).json({ detail: 'Target user is not a valid field employee' });
      }

      const now = new Date();

      // Update incident
      inc.assigned_employee_id = emp._id;
      inc.assigned_employee_name = emp.name;
      inc.assignment_status = 'assigned';
      inc.status = 'assigned';
      inc.assigned_at = now;
      inc.updated_at = now;
      await inc.save();

      // Create Assignment record
      const assignment = new Assignment({
        complaint_id: inc.id,
        incident_oid: inc._id,
        employee_id: emp._id,
        employee_name: emp.name,
        assigned_by: req.user.id || req.user._id,
        assigned_by_name: req.user.name,
        status: 'assigned',
        repair_notes: notes || '',
        assigned_at: now,
      });
      await assignment.save();

      // Update employee active tasks
      emp.activeTasksCount = (emp.activeTasksCount || 0) + 1;
      await emp.save();

      // Log status event
      const evId = await getNextSequence('status_events');
      const ev = new StatusEvent({
        id: evId,
        incident_id: inc.id,
        status: 'assigned',
        note: `Assigned to field employee ${emp.name} by ${req.user.name}. ${notes ? `Note: ${notes}` : ''}`,
        actor: req.user.name,
        actor_role: req.user.role,
        created_at: now,
      });
      await ev.save();

      // Notify employee
      await createAndPushNotification({
        recipient_id: emp._id,
        recipient_role: 'field_employee',
        department: inc.department,
        title: `New Task Assigned: ${inc.ticket_code}`,
        message: `You have been assigned: ${inc.title} at ${inc.address || 'Reported Location'}.`,
        complaint_id: inc.id,
        ticket_code: inc.ticket_code,
        type: 'complaint_assigned',
      });

      res.json({
        ok: true,
        complaint_id: inc.id,
        ticket_code: inc.ticket_code,
        status: inc.status,
        assignment_status: inc.assignment_status,
        assigned_employee: {
          id: emp._id,
          name: emp.name,
          department: emp.department,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// 3. Employee View: My Assigned Tasks
router.get('/my-tasks', authenticateJWT, async (req, res, next) => {
  try {
    let employeeId = req.user.id || req.user._id;

    // For demo staff tokens (e.g. elec-demo), support matching by department
    const filter = {
      $or: [{ assigned_employee_id: employeeId }],
    };

    if (req.user.department && req.user.department !== '*') {
      filter.$or.push({
        department: req.user.department,
        assigned_employee_id: { $ne: null },
      });
    }

    if (req.query.status) {
      filter.status = { $in: req.query.status.split(',').map((s) => s.trim()) };
    }

    const tasks = await Incident.find(filter).sort({ priority: -1, created_at: -1 });

    res.json({
      count: tasks.length,
      tasks: tasks.map((t) => {
        const obj = t.toObject ? t.toObject() : { ...t };
        if (obj.best_photo_path) {
          obj.best_photo_path = formatters.uploadUrl(obj.best_photo_path);
        }
        if (obj.resolution_photo_path) {
          obj.resolution_photo_path = formatters.uploadUrl(obj.resolution_photo_path);
        }
        if (Array.isArray(obj.images)) {
          obj.images = obj.images.map((img) => formatters.uploadUrl(img)).filter(Boolean);
        }
        if (Array.isArray(obj.after_images)) {
          obj.after_images = obj.after_images.map((img) => formatters.uploadUrl(img)).filter(Boolean);
        }
        return {
          ...obj,
          navigation_url:
            t.lat && t.lon
              ? `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lon}`
              : null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// 4. Employee Action: Accept or Reject Assignment
router.post('/tasks/:id/respond', authenticateJWT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { action, reason } = req.body || {}; // action: 'accept' | 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ detail: 'action must be "accept" or "reject"' });
    }

    const inc = await Incident.findOne({ id });
    if (!inc) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }

    const assignment = await Assignment.findOne({ complaint_id: id }).sort({ assigned_at: -1 });
    const now = new Date();

    if (action === 'accept') {
      inc.assignment_status = 'accepted';
      inc.assignment_response_at = now;
      await inc.save();

      if (assignment) {
        assignment.status = 'accepted';
        assignment.accepted_at = now;
        await assignment.save();
      }

      // Log status event
      const evId = await getNextSequence('status_events');
      const ev = new StatusEvent({
        id: evId,
        incident_id: inc.id,
        status: 'assigned',
        note: `Field employee ${req.user.name} accepted the task assignment.`,
        actor: req.user.name,
        actor_role: 'field_employee',
        created_at: now,
      });
      await ev.save();

      await createAndPushNotification({
        department: inc.department,
        title: `Task Accepted: ${inc.ticket_code}`,
        message: `${req.user.name} accepted task ${inc.ticket_code}`,
        complaint_id: inc.id,
        ticket_code: inc.ticket_code,
        type: 'task_accepted',
      });
    } else {
      // Reject task
      if (!reason || reason.trim() === '') {
        return res.status(400).json({ detail: 'A reason is required when rejecting an assignment' });
      }

      inc.assignment_status = 'rejected';
      inc.status = 'received'; // return to queue for reassignment
      inc.rejection_reason = reason;
      inc.assigned_employee_id = null;
      inc.assigned_employee_name = null;
      await inc.save();

      if (assignment) {
        assignment.status = 'rejected';
        assignment.rejection_reason = reason;
        await assignment.save();
      }

      // Log status event
      const evId = await getNextSequence('status_events');
      const ev = new StatusEvent({
        id: evId,
        incident_id: inc.id,
        status: 'received',
        note: `Field employee ${req.user.name} declined task. Reason: ${reason}. Re-queued for assignment.`,
        actor: req.user.name,
        actor_role: 'field_employee',
        created_at: now,
      });
      await ev.save();

      await createAndPushNotification({
        department: inc.department,
        title: `Task Rejected: ${inc.ticket_code}`,
        message: `${req.user.name} declined task ${inc.ticket_code}. Reason: ${reason}. Needs reassignment.`,
        complaint_id: inc.id,
        ticket_code: inc.ticket_code,
        type: 'task_rejected',
      });
    }

    res.json({
      ok: true,
      complaint_id: inc.id,
      ticket_code: inc.ticket_code,
      assignment_status: inc.assignment_status,
      status: inc.status,
    });
  } catch (err) {
    next(err);
  }
});

// 5. Employee Action: Step-by-Step Status Updates (Travelling -> Arrived -> In Progress)
router.post('/tasks/:id/step', authenticateJWT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { step, note } = req.body || {}; // 'travelling' | 'arrived' | 'in_progress'

    const validSteps = ['travelling', 'arrived', 'in_progress'];
    if (!validSteps.includes(step)) {
      return res.status(400).json({ detail: `step must be one of: ${validSteps.join(', ')}` });
    }

    const inc = await Incident.findOne({ id });
    if (!inc) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }

    const assignment = await Assignment.findOne({ complaint_id: id }).sort({ assigned_at: -1 });
    const now = new Date();

    inc.assignment_status = step;
    if (step === 'in_progress' || step === 'travelling') {
      inc.status = 'in_progress';
    }
    inc.updated_at = now;
    await inc.save();

    if (assignment) {
      assignment.status = step;
      if (step === 'in_progress' && !assignment.started_at) {
        assignment.started_at = now;
      }
      await assignment.save();
    }

    const stepLabels = {
      travelling: 'Field employee is on the way to location.',
      arrived: 'Field employee arrived at the site.',
      in_progress: 'Repair work commenced on-site.',
    };

    // Log status event
    const evId = await getNextSequence('status_events');
    const ev = new StatusEvent({
      id: evId,
      incident_id: inc.id,
      status: inc.status,
      note: note || stepLabels[step],
      actor: req.user.name,
      actor_role: 'field_employee',
      created_at: now,
    });
    await ev.save();

    await createAndPushNotification({
      department: inc.department,
      title: `Field Update: ${inc.ticket_code}`,
      message: `${req.user.name} status: ${step.replace('_', ' ').toUpperCase()}`,
      complaint_id: inc.id,
      ticket_code: inc.ticket_code,
      type: `task_${step}`,
    });

    res.json({
      ok: true,
      complaint_id: inc.id,
      ticket_code: inc.ticket_code,
      status: inc.status,
      assignment_status: inc.assignment_status,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Employee Action: Complete Repair with After-Repair Proof Photos & Notes
router.post(
  '/tasks/:id/complete',
  authenticateJWT,
  upload.array('proof', 3),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { notes } = req.body || {};

      const inc = await Incident.findOne({ id });
      if (!inc) {
        return res.status(404).json({ detail: 'Complaint not found' });
      }

      // Collect uploaded proof photos
      const proofBuffers = [];
      if (req.files && Array.isArray(req.files)) {
        for (const f of req.files) {
          if (f.buffer) proofBuffers.push(f.buffer);
        }
      } else if (req.file && req.file.buffer) {
        proofBuffers.push(req.file.buffer);
      }

      if (proofBuffers.length === 0) {
        return res.status(400).json({ detail: 'At least one after-repair proof photo is required' });
      }

      const uploadedProofUrls = await uploadMultipleImages(proofBuffers, 'resolutions');
      const now = new Date();

      inc.status = 'resolved';
      inc.assignment_status = 'completed';
      inc.resolution_photo_path = uploadedProofUrls[0];
      inc.after_images = uploadedProofUrls;
      inc.resolution_notes = notes || 'Field repair completed successfully.';
      inc.resolved_at = now;
      inc.updated_at = now;
      await inc.save();

      // Update assignment record
      const assignment = await Assignment.findOne({ complaint_id: id }).sort({ assigned_at: -1 });
      if (assignment) {
        assignment.status = 'completed';
        assignment.completed_at = now;
        assignment.repair_notes = notes || 'Repair completed';
        assignment.proof_photos = uploadedProofUrls;
        await assignment.save();
      }

      // Log status event
      const evId = await getNextSequence('status_events');
      const ev = new StatusEvent({
        id: evId,
        incident_id: inc.id,
        status: 'resolved',
        note: `Repair completed by ${req.user.name}. Notes: ${notes || 'Work verified'}. Awaiting citizen verification.`,
        actor: req.user.name,
        actor_role: 'field_employee',
        proof_photo: uploadedProofUrls[0],
        created_at: now,
      });
      await ev.save();

      // Notify citizen and department
      await createAndPushNotification({
        department: inc.department,
        title: `Repair Completed: ${inc.ticket_code}`,
        message: `${inc.ticket_code} fixed by ${req.user.name}. Citizen notified for verification.`,
        complaint_id: inc.id,
        ticket_code: inc.ticket_code,
        type: 'repair_completed',
      });

      res.json({
        ok: true,
        complaint_id: inc.id,
        ticket_code: inc.ticket_code,
        status: inc.status,
        assignment_status: inc.assignment_status,
        after_images: inc.after_images,
        resolved_at: inc.resolved_at,
      });
    } catch (err) {
      next(err);
    }
  }
);

// 7. Employee Action: Unable to Complete Repair
router.post('/tasks/:id/unable', authenticateJWT, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason, note } = req.body || {};

    if (!reason) {
      return res.status(400).json({ detail: 'Reason for unable to complete is required' });
    }

    const inc = await Incident.findOne({ id });
    if (!inc) {
      return res.status(404).json({ detail: 'Complaint not found' });
    }

    const now = new Date();

    inc.status = 'escalated';
    inc.assignment_status = 'unable_to_complete';
    inc.unable_reason = `${reason}. ${note || ''}`;
    inc.updated_at = now;
    await inc.save();

    const assignment = await Assignment.findOne({ complaint_id: id }).sort({ assigned_at: -1 });
    if (assignment) {
      assignment.status = 'unable_to_complete';
      assignment.unable_reason = inc.unable_reason;
      await assignment.save();
    }

    // Log status event
    const evId = await getNextSequence('status_events');
    const ev = new StatusEvent({
      id: evId,
      incident_id: inc.id,
      status: 'escalated',
      note: `Field team unable to complete repair. Reason: ${inc.unable_reason}. Escalated to administrator.`,
      actor: req.user.name,
      actor_role: 'field_employee',
      created_at: now,
    });
    await ev.save();

    await createAndPushNotification({
      department: inc.department,
      title: `ESCALATION: ${inc.ticket_code} Incomplete`,
      message: `${req.user.name} reported unable to complete repair: ${reason}`,
      complaint_id: inc.id,
      ticket_code: inc.ticket_code,
      type: 'complaint_escalated',
    });

    res.json({
      ok: true,
      complaint_id: inc.id,
      ticket_code: inc.ticket_code,
      status: inc.status,
      assignment_status: inc.assignment_status,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

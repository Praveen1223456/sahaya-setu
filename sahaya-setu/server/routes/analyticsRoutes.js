const express = require('express');
const router = express.Router();

const Incident = require('../models/Incident');
const Department = require('../models/Department');
const User = require('../models/User');
const { optionalJWT } = require('../middleware/jwtAuth');

// 1. Overall System Overview KPIs
router.get('/overview', optionalJWT, async (req, res, next) => {
  try {
    const now = new Date();
    const [
      total,
      pending,
      assigned,
      inProgress,
      resolved,
      closed,
      escalated,
      overdue,
      emergency,
    ] = await Promise.all([
      Incident.countDocuments(),
      Incident.countDocuments({ status: { $in: ['received', 'review'] } }),
      Incident.countDocuments({ status: 'assigned' }),
      Incident.countDocuments({ status: 'in_progress' }),
      Incident.countDocuments({ status: 'resolved' }),
      Incident.countDocuments({ status: 'closed' }),
      Incident.countDocuments({ status: 'escalated' }),
      Incident.countDocuments({
        status: { $in: ['received', 'assigned', 'in_progress', 'review', 'escalated'] },
        sla_due_at: { $lt: now, $ne: null },
      }),
      Incident.countDocuments({
        $or: [{ is_disaster_mode: true }, { emergency_severity: 'critical' }, { is_sos: true }],
      }),
    ]);

    const resolvedTotal = resolved + closed;
    const resolutionRate = total > 0 ? Math.round((resolvedTotal / total) * 100) : 100;

    // Calculate average resolution time for resolved incidents
    const resolvedIncidents = await Incident.find({
      resolved_at: { $ne: null },
      created_at: { $ne: null },
    })
      .select('created_at resolved_at')
      .limit(300);

    let avgResolutionHours = 0;
    if (resolvedIncidents.length > 0) {
      const totalMs = resolvedIncidents.reduce((sum, inc) => {
        const diff = new Date(inc.resolved_at) - new Date(inc.created_at);
        return sum + Math.max(0, diff);
      }, 0);
      avgResolutionHours = parseFloat((totalMs / (resolvedIncidents.length * 3600000)).toFixed(1));
    }

    res.json({
      total,
      pending,
      assigned,
      in_progress: inProgress,
      resolved,
      closed,
      escalated,
      overdue,
      emergency,
      resolution_rate: resolutionRate,
      avg_resolution_hours: avgResolutionHours,
    });
  } catch (err) {
    next(err);
  }
});

// 2. Complaints by Category
router.get('/by-category', async (req, res, next) => {
  try {
    const agg = await Incident.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const formatted = agg.map((item) => ({
      category: item._id,
      total: item.count,
      resolved: item.resolved,
      pending: item.count - item.resolved,
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// 3. Complaints by Department & Resolution Rates
router.get('/by-department', async (req, res, next) => {
  try {
    const agg = await Incident.aggregate([
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] },
          },
          in_progress: {
            $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] },
          },
          pending: {
            $sum: {
              $cond: [{ $in: ['$status', ['received', 'assigned', 'review', 'escalated']] }, 1, 0],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const result = agg.map((item) => {
      const rate = item.total > 0 ? Math.round((item.resolved / item.total) * 100) : 100;
      return {
        department: item._id,
        name: item._id.charAt(0).toUpperCase() + item._id.slice(1),
        total: item.total,
        resolved: item.resolved,
        in_progress: item.in_progress,
        pending: item.pending,
        resolution_rate: rate,
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 4. Monthly & Weekly Trends
router.get('/trends', async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const agg = await Incident.aggregate([
      {
        $match: {
          created_at: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$created_at' },
          },
          reported: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $in: ['$status', ['resolved', 'closed']] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Ensure last 7 days are represented
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      const str = d.toISOString().split('T')[0];
      const match = agg.find((a) => a._id === str);
      days.push({
        date: str,
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        reported: match ? match.reported : 0,
        resolved: match ? match.resolved : 0,
      });
    }

    res.json(days);
  } catch (err) {
    next(err);
  }
});

// 5. Employee Performance Leaderboard
router.get('/employee-performance', async (req, res, next) => {
  try {
    const employees = await User.find({ role: 'field_employee' }).select('-password');

    const leaderboard = await Promise.all(
      employees.map(async (emp) => {
        const [completed, active, total] = await Promise.all([
          Incident.countDocuments({
            assigned_employee_id: emp._id,
            status: { $in: ['resolved', 'closed'] },
          }),
          Incident.countDocuments({
            assigned_employee_id: emp._id,
            status: { $in: ['assigned', 'in_progress'] },
          }),
          Incident.countDocuments({
            assigned_employee_id: emp._id,
          }),
        ]);

        const rate = total > 0 ? Math.round((completed / total) * 100) : 100;

        return {
          id: emp._id,
          name: emp.name,
          department: emp.department,
          completed_tasks: completed,
          active_tasks: active,
          total_assigned: total,
          completion_rate: rate,
          availability: emp.availability,
        };
      })
    );

    leaderboard.sort((a, b) => b.completed_tasks - a.completed_tasks);

    res.json(leaderboard);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

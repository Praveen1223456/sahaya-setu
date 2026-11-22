const express = require('express');
const router = express.Router();
const Department = require('../models/Department');
const User = require('../models/User');
const Incident = require('../models/Incident');
const { authenticateJWT, requireRole } = require('../middleware/jwtAuth');

// 1. Get all departments with live statistics
router.get('/', async (req, res, next) => {
  try {
    const depts = await Department.find({ active: true }).sort({ name: 1 });

    const results = await Promise.all(
      depts.map(async (d) => {
        const [openCount, resolvedCount, employeeCount] = await Promise.all([
          Incident.countDocuments({
            department: d.code,
            status: { $in: ['received', 'assigned', 'in_progress', 'review', 'escalated'] },
          }),
          Incident.countDocuments({
            department: d.code,
            status: { $in: ['resolved', 'closed'] },
          }),
          User.countDocuments({
            department: d.code,
            role: 'field_employee',
          }),
        ]);

        return {
          ...d.toObject(),
          stats: {
            open_complaints: openCount,
            resolved_complaints: resolvedCount,
            total_employees: employeeCount,
          },
        };
      })
    );

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// 2. Get single department by code
router.get('/:code', async (req, res, next) => {
  try {
    const dept = await Department.findOne({ code: req.params.code.toLowerCase() });
    if (!dept) {
      return res.status(404).json({ detail: 'Department not found' });
    }

    const employees = await User.find({
      department: dept.code,
      role: 'field_employee',
    }).select('-password');

    res.json({
      department: dept,
      employees,
    });
  } catch (err) {
    next(err);
  }
});

// 3. Get employees of department (for assignment)
router.get('/:code/employees', authenticateJWT, async (req, res, next) => {
  try {
    const deptCode = req.params.code.toLowerCase();
    const employees = await User.find({
      department: deptCode,
      role: 'field_employee',
    }).select('-password');

    // Count live assigned/in-progress tasks for each employee
    const employeesWithTasks = await Promise.all(
      employees.map(async (emp) => {
        const activeCount = await Incident.countDocuments({
          assigned_employee_id: emp._id,
          status: { $in: ['assigned', 'in_progress'] },
        });
        return {
          ...emp.toObject(),
          activeTasksCount: activeCount,
        };
      })
    );

    res.json(employeesWithTasks);
  } catch (err) {
    next(err);
  }
});

// 4. Create department (Super Admin)
router.post('/', authenticateJWT, requireRole('super_admin'), async (req, res, next) => {
  try {
    const { name, code, description, headEmail, phone, slaHoursDefault, icon, color, categories } =
      req.body || {};

    if (!name || !code) {
      return res.status(400).json({ detail: 'Department name and code are required' });
    }

    const existing = await Department.findOne({ code: code.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ detail: 'Department code already exists' });
    }

    const dept = new Department({
      name: name.trim(),
      code: code.toLowerCase().trim(),
      description: description || '',
      headEmail: headEmail || '',
      phone: phone || '',
      slaHoursDefault: slaHoursDefault || 24,
      icon: icon || 'Building2',
      color: color || '#1b4f9c',
      categories: Array.isArray(categories) ? categories : [],
    });

    await dept.save();
    res.status(201).json(dept);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

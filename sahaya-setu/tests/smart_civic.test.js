const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const sharp = require('sharp');

const app = require('../server/app');
const { connectDB, closeDB } = require('../server/config/db');
const User = require('../server/models/User');
const Department = require('../server/models/Department');
const Incident = require('../server/models/Incident');
const Assignment = require('../server/models/Assignment');
const DisasterEvent = require('../server/models/DisasterEvent');

async function makePhotoBuffer(color = 'red') {
  const svg = `<svg width="400" height="300"><rect width="400" height="300" fill="${color}"/></svg>`;
  return await sharp(Buffer.from(svg)).jpeg().toBuffer();
}

describe('Sahaya Setu Smart Civic Response Test Suite', () => {
  let citizenToken = '';
  let adminToken = '';
  let employeeToken = '';
  let employeeId = '';

  before(async () => {
    const testUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sahaya_setu_test';
    await connectDB(testUri);
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }

    // Seed test department
    await Department.create({
      name: 'Electricity Department',
      code: 'electricity',
      description: 'Power grid and lines',
      slaHoursDefault: 6,
    });

    // Seed Citizen
    const citizenRes = await request(app).post('/api/auth/register').send({
      name: 'Anand Kumar',
      email: 'citizen.test@sahaya.gov.in',
      password: 'password123',
      phone: '9876543210',
      role: 'citizen',
    });
    citizenToken = citizenRes.body.token;

    // Seed Dept Admin
    const adminRes = await request(app).post('/api/auth/register').send({
      name: 'Admin Officer',
      email: 'admin.test@sahaya.gov.in',
      password: 'password123',
      role: 'department_admin',
      department: 'electricity',
    });
    adminToken = adminRes.body.token;

    // Seed Field Employee
    const empRes = await request(app).post('/api/auth/register').send({
      name: 'Ravi Line Specialist',
      email: 'field.test@sahaya.gov.in',
      password: 'password123',
      role: 'field_employee',
      department: 'electricity',
      skills: ['power-lines', 'pole-erection'],
    });
    employeeToken = empRes.body.token;
    employeeId = empRes.body.user._id || empRes.body.user.id;
  });

  after(async () => {
    await closeDB();
  });

  // 1. Auth & Profiles
  it('registers users with hashed passwords and returns valid JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${citizenToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'citizen.test@sahaya.gov.in');
    assert.equal(res.body.user.role, 'citizen');
  });

  // 2. Complaint Submission & Auto-Routing
  it('submits complaint, captures coordinates, auto-routes to Electricity department and sets SLA', async () => {
    const photo = await makePhotoBuffer('yellow');
    const res = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('category', 'ELEC-POLE')
      .field('description', 'High voltage power pole leaning onto road')
      .field('lat', '16.5787')
      .field('lon', '82.0061')
      .field('address', 'Clock Tower Circle, Amalapuram')
      .attach('images', photo, 'pole.jpg');

    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.department, 'electricity');
    assert.equal(res.body.status, 'received');
    assert.ok(res.body.ticket_code.startsWith('SS-'));
    assert.ok(res.body.sla_due_at);
  });

  // 3. Duplicate Detection & Upvoting
  it('detects nearby open complaint in same category and allows citizen upvoting', async () => {
    const photo = await makePhotoBuffer('orange');
    const compRes = await request(app)
      .post('/api/complaints')
      .field('category', 'ELEC-POLE')
      .field('description', 'Fallen pole blocking street')
      .field('lat', '16.5787')
      .field('lon', '82.0061')
      .attach('images', photo, 'p1.jpg');

    const complaintId = compRes.body.id;

    // Check duplicate from 50 meters away
    const dupRes = await request(app)
      .get('/api/complaints/check-duplicates')
      .query({
        lat: 16.5788,
        lon: 82.0062,
        category: 'ELEC-POLE',
        radius_m: 200,
      });

    assert.equal(dupRes.status, 200);
    assert.equal(dupRes.body.has_duplicates, true);
    assert.ok(dupRes.body.matches.length >= 1);
    assert.equal(dupRes.body.matches[0].id, complaintId);

    // Support / Upvote existing complaint
    const upvoteRes = await request(app)
      .post(`/api/complaints/${complaintId}/upvote`)
      .set('Authorization', `Bearer ${citizenToken}`);

    assert.equal(upvoteRes.status, 200);
    assert.equal(upvoteRes.body.upvotes, 1);
  });

  // 4. Workforce Management (Recommend, Assign, Travel, Complete with Proof)
  it('completes the full workforce dispatch, execution, and proof verification lifecycle', async () => {
    // 1. Submit complaint
    const photo = await makePhotoBuffer('blue');
    const compRes = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('category', 'ELEC-POLE')
      .field('description', 'Sparking wires on street')
      .field('lat', '16.5787')
      .field('lon', '82.0061')
      .attach('images', photo, 'initial.jpg');

    const id = compRes.body.id;

    // 2. Admin queries recommended field workers
    const recRes = await request(app)
      .get(`/api/workforce/recommend/${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(recRes.status, 200);
    assert.ok(recRes.body.recommended.length >= 1);
    assert.equal(recRes.body.recommended[0].department, 'electricity');

    // 3. Admin assigns complaint to employee
    const assignRes = await request(app)
      .post('/api/workforce/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        complaint_id: id,
        employee_id: employeeId,
        notes: 'Take 11kV insulated tools and safety gear.',
      });
    assert.equal(assignRes.status, 200);
    assert.equal(assignRes.body.status, 'assigned');

    // 4. Employee views task list
    const myTasks = await request(app)
      .get('/api/workforce/my-tasks')
      .set('Authorization', `Bearer ${employeeToken}`);
    assert.equal(myTasks.status, 200);
    assert.ok(myTasks.body.tasks.some((t) => t.id === id));
    assert.ok(myTasks.body.tasks[0].navigation_url.includes('google.com/maps'));

    // 5. Employee accepts assignment
    const acceptRes = await request(app)
      .post(`/api/workforce/tasks/${id}/respond`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ action: 'accept' });
    assert.equal(acceptRes.status, 200);
    assert.equal(acceptRes.body.assignment_status, 'accepted');

    // 6. Employee updates status to travelling and arrived
    const stepRes = await request(app)
      .post(`/api/workforce/tasks/${id}/step`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ step: 'travelling' });
    assert.equal(stepRes.status, 200);

    // 7. Employee completes repair with after-repair proof photo
    const proofPhoto = await makePhotoBuffer('green');
    const completeRes = await request(app)
      .post(`/api/workforce/tasks/${id}/complete`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .field('notes', 'Pole re-erected, conductors retensioned, power restored.')
      .attach('proof', proofPhoto, 'proof.jpg');

    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.status, 'resolved');
    assert.ok(completeRes.body.after_images.length >= 1);

    // 8. Citizen verifies resolution and gives 5-star rating
    const verifyRes = await request(app)
      .post(`/api/complaints/${id}/verify-resolution`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        is_resolved: true,
        rating: 5,
        comment: 'Great and fast response! Power is back on.',
      });

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.status, 'closed');
    assert.equal(verifyRes.body.verification_status, 'verified');
  });

  // 5. Citizen Reopen Flow
  it('allows citizen to reject incomplete resolution and reopens ticket for review', async () => {
    const photo = await makePhotoBuffer('purple');
    const compRes = await request(app)
      .post('/api/complaints')
      .set('Authorization', `Bearer ${citizenToken}`)
      .field('category', 'ELEC-STREETLIGHT')
      .field('description', 'Dark street')
      .attach('images', photo, 'light.jpg');

    const id = compRes.body.id;

    // Simulate resolved state
    const inc = await Incident.findOne({ id });
    inc.status = 'resolved';
    await inc.save();

    // Citizen rejects
    const rejectRes = await request(app)
      .post(`/api/complaints/${id}/verify-resolution`)
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        is_resolved: false,
        rating: 1,
        comment: 'Only one light was replaced, other three are still out!',
      });

    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.status, 'escalated');
    assert.equal(rejectRes.body.verification_status, 'rejected_reopened');
  });

  // 6. Disaster Management & Emergency Analytics
  it('declares disaster event, activates disaster mode, and tracks emergency restoration', async () => {
    // 1. Declare disaster event
    const eventRes = await request(app)
      .post('/api/disaster/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Cyclone Jal Emergency Response',
        hazardType: 'cyclone',
        severity: 'critical',
        areaName: 'Amalapuram Coastal Belt',
        center_lat: 16.5787,
        center_lon: 82.0061,
        radius_km: 30,
      });

    assert.equal(eventRes.status, 201);
    assert.equal(eventRes.body.status, 'active');

    // 2. Check disaster mode status
    const statusRes = await request(app).get('/api/disaster/status');
    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.is_disaster_mode, true);
    assert.ok(statusRes.body.safety_advisory.includes('SAFETY ADVISORY'));

    // 3. Check restoration stats
    const statsRes = await request(app).get('/api/disaster/restoration-stats');
    assert.equal(statsRes.status, 200);
    assert.ok(statsRes.body.departments);
  });

  // 7. System Analytics KPIs
  it('provides analytics KPIs and category breakdowns for Recharts dashboards', async () => {
    const res = await request(app).get('/api/analytics/overview');
    assert.equal(res.status, 200);
    assert.ok(typeof res.body.total === 'number');
    assert.ok(typeof res.body.resolution_rate === 'number');

    const catRes = await request(app).get('/api/analytics/by-category');
    assert.equal(catRes.status, 200);
    assert.ok(Array.isArray(catRes.body));
  });
});

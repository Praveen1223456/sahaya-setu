const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server/app');
const env = require('../server/config/env');
const OutboxMessage = require('../server/models/OutboxMessage');
const CitizenOtp = require('../server/models/CitizenOtp');
const Report = require('../server/models/Report');
const Incident = require('../server/models/Incident');

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sahaya_setu_test';

describe('Voice Complaints & Status Query Test Suite', () => {
  before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  after(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await OutboxMessage.deleteMany({});
    await CitizenOtp.deleteMany({});
    await Report.deleteMany({});
    await Incident.deleteMany({});
  });

  async function getCitizenToken(phone = '9876543210') {
    await request(app)
      .post('/auth/citizen/request-otp')
      .send({ phone })
      .expect(200);

    const msg = await OutboxMessage.findOne({ to_phone: phone.slice(-10) }).sort({ _id: -1 });
    assert.ok(msg, 'OTP SMS message should be recorded in Outbox');
    const match = /code:\s*(\d{6})/i.exec(msg.body);
    assert.ok(match, `Code should be in SMS body: ${msg.body}`);
    const code = match[1];

    const verifyRes = await request(app)
      .post('/auth/citizen/verify-otp')
      .send({ phone, code })
      .expect(200);

    assert.ok(verifyRes.body.token, 'Should return citizen token');
    assert.equal(verifyRes.body.phone, phone.slice(-10));
    return verifyRes.body.token;
  }

  test('1. Citizen sign-in via OTP: requests code, handles wrong code, and issues token', async () => {
    const phone = '9000000041';

    // Request OTP
    const reqRes = await request(app)
      .post('/auth/citizen/request-otp')
      .send({ phone })
      .expect(200);
    assert.equal(reqRes.body.sent, true);

    // Wrong code fails
    await request(app)
      .post('/auth/citizen/verify-otp')
      .send({ phone, code: '000000' })
      .expect(400);

    // Valid code succeeds
    const msg = await OutboxMessage.findOne({ to_phone: phone }).sort({ _id: -1 });
    const code = /code:\s*(\d{6})/.exec(msg.body)[1];
    const ok = await request(app)
      .post('/auth/citizen/verify-otp')
      .send({ phone, code })
      .expect(200);
    assert.ok(ok.body.token);

    // Code is single use (deleted after verify)
    await request(app)
      .post('/auth/citizen/verify-otp')
      .send({ phone, code })
      .expect(400);
  });

  test('2. Voice capabilities endpoint returns supported languages and engine status', async () => {
    const res = await request(app).get('/voice/capabilities').expect(200);
    assert.ok(Array.isArray(res.body.languages));
    assert.ok(res.body.languages.includes('te-IN'));
    assert.ok(res.body.languages.includes('hi-IN'));
    assert.ok(res.body.languages.includes('en-IN'));
    assert.equal(typeof res.body.serverTranscription, 'boolean');
  });

  test('3. Voice analyze classifies Telugu, Hindi, and English complaints accurately with safety warnings', async () => {
    const token = await getCitizenToken('9876543210');

    // Telugu complaint about electricity pole and wires
    const teluguText = 'మా వీధిలో కరెంటు స్తంభం పడిపోయింది. వైర్లు రోడ్డుపై ఉన్నాయి.';
    const teRes = await request(app)
      .post('/voice/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: teluguText, language: 'te-IN' })
      .expect(200);

    assert.equal(teRes.body.category, 'ELEC');
    assert.equal(teRes.body.department, 'electricity');
    assert.equal(teRes.body.severity, 'CRITICAL');
    assert.ok(teRes.body.safetyWarning.includes('తీగల'));

    // Hindi complaint about water pipe leaking
    const hindiText = 'हमारी गली में पानी की पाइप लीक हो रही है, मंदिर के पास';
    const hiRes = await request(app)
      .post('/voice/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: hindiText, language: 'hi-IN' })
      .expect(200);

    assert.equal(hiRes.body.category, 'WATER_LEAK');
    assert.equal(hiRes.body.department, 'water');
    assert.equal(hiRes.body.locationMentioned, 'मंदिर');

    // English complaint about garbage
    const englishText = 'Garbage has not been collected for a week near the bus stand.';
    const enRes = await request(app)
      .post('/voice/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: englishText, language: 'en-IN' })
      .expect(200);

    assert.equal(enRes.body.category, 'GARBAGE');
    assert.equal(enRes.body.department, 'municipal');
    assert.equal(enRes.body.locationMentioned, 'bus stand');
  });

  test('4. Submits voice complaint through standard pipeline and attaches voiceMetadata', async () => {
    const token = await getCitizenToken('9876543210');

    const meta = {
      clientReportId: 'VOICE-TEST-001',
      language: 'te-IN',
      transcription: 'మా వీధిలో కరెంటు స్తంభం పడిపోయింది',
      title: 'Fallen electricity pole',
      description: 'మా వీధిలో కరెంటు స్తంభం పడిపోయింది',
      category: 'ELEC',
      severity: 'CRITICAL',
      lat: 16.5787,
      lon: 82.0061,
      landmark: 'Near Clock Tower',
      locationAdjusted: true,
      spokenLocation: 'Clock Tower',
    };

    const submitRes = await request(app)
      .post('/complaints/voice')
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify(meta))
      .expect(200);

    assert.ok(submitRes.body.ticketCode.startsWith('SS-'));
    assert.equal(submitRes.body.decision, 'new');

    const report = await Report.findOne({ client_report_id: 'VOICE-TEST-001' });
    assert.ok(report);
    assert.equal(report.input_method, 'VOICE');
    assert.equal(report.voice_metadata.language, 'te-IN');
    assert.equal(report.voice_metadata.title, 'Fallen electricity pole');
    assert.equal(report.voice_metadata.landmark, 'Near Clock Tower');

    const incident = await Incident.findOne({ id: report.incident_id });
    assert.ok(incident);
    assert.equal(incident.title, 'Fallen electricity pole');
    assert.equal(incident.landmark, 'Near Clock Tower');
  });

  test('5. Spoken status query handles tickets, pending complaints, and Telugu numerals', async () => {
    const token = await getCitizenToken('9876543210');

    // Create a complaint for this citizen
    const meta = {
      clientReportId: 'VOICE-STATUS-001',
      language: 'te-IN',
      transcription: 'మంచినీటి పైప్‌లైన్ లీకేజీ',
      title: 'Water pipe leak',
      description: 'మంచినీటి పైప్‌లైన్ లీకేజీ',
      category: 'WATER_LEAK',
      severity: 'MEDIUM',
      lat: 16.5787,
      lon: 82.0061,
    };

    const created = await request(app)
      .post('/complaints/voice')
      .set('Authorization', `Bearer ${token}`)
      .field('meta', JSON.stringify(meta))
      .expect(200);

    const ticketCode = created.body.ticketCode;

    // Ask by text in Telugu: "నా ఫిర్యాదు స్థితి ఏమిటి?"
    const q1 = await request(app)
      .post('/voice/status-query')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'నా ఫిర్యాదు స్థితి ఏమిటి?', language: 'te-IN' })
      .expect(200);

    assert.ok(q1.body.answer.includes(ticketCode));
    assert.equal(q1.body.complaints.length, 1);

    // Ask in English by ticket code with Telugu numerals
    const q2 = await request(app)
      .post('/voice/status-query')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: `Ticket SS-౦౦౦${created.body.incident_id}`, language: 'en-IN' })
      .expect(200);

    assert.ok(q2.body.answer.includes(ticketCode));

    // Stranger cannot see this complaint
    const strangerToken = await getCitizenToken('9111111111');
    const qStranger = await request(app)
      .post('/voice/status-query')
      .set('Authorization', `Bearer ${strangerToken}`)
      .send({ text: 'What is my complaint status?', language: 'en-IN' })
      .expect(200);

    assert.ok(qStranger.body.answer.includes('no complaints registered'));
    assert.equal(qStranger.body.complaints.length, 0);
  });
});

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mongoose = require('mongoose');

const app = require('../server/app');
const env = require('../server/config/env');
const { connectDB, closeDB } = require('../server/config/db');
const imaging = require('../server/services/imaging');
const sms = require('../server/services/sms');

const BASE_LAT = 16.5787;
const BASE_LON = 82.0061;
const P1 = '9000000001';
const P2 = '9000000002';
const P3 = '9000000003';
const STAFF = { 'X-Staff-Token': 'control-demo' };

function offset(lat, lon, northM = 0, eastM = 0) {
  return [
    lat + northM / 111320,
    lon + eastM / (111320 * 0.9585),
  ];
}

async function makePhoto(seed, resized = false) {
  const r = (seed * 83 + 50) % 256;
  const g = (seed * 157 + 80) % 256;
  const b = (seed * 223 + 120) % 256;
  const width = resized ? 400 : 640;
  const height = resized ? 300 : 480;

  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="rgb(${r},${g},${b})" />
      <circle cx="${width * 0.4}" cy="${height * 0.5}" r="${width * 0.25}" fill="rgb(${(r+90)%256},${(g+60)%256},${(b+110)%256})" />
      <rect x="${width * 0.5}" y="${height * 0.2}" width="${width * 0.3}" height="${height * 0.5}" fill="rgb(${(r+140)%256},${(g+160)%256},${(b+40)%256})" />
    </svg>
  `;

  return await sharp(Buffer.from(svg))
    .jpeg({ quality: resized ? 55 : 90 })
    .toBuffer();
}

async function outboxFor(phone) {
  const res = await request(app)
    .get('/outbox')
    .set(STAFF)
    .query({ phone });
  return (res.body || []).map((m) => m.body);
}

async function postReport(photo = null, meta = {}) {
  meta.category = meta.category || 'ELEC';
  const req = request(app).post('/reports').field('meta', JSON.stringify(meta));
  if (photo) {
    req.attach('photo', photo, 'p.jpg');
  }
  const res = await req;
  assert.equal(res.status, 200, res.text);
  return res.body;
}

describe('Sahaya Setu MERN Test Suite', () => {
  before(async () => {
    const testUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sahaya_setu_test';
    await connectDB(testUri);
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  after(async () => {
    await closeDB();
  });

  // 1. Photos and duplicates
  it('test_new_report_gets_ticket_address_and_sms', async () => {
    const photo = await makePhoto(1);
    const res = await postReport(photo, { phone: P1, lat: BASE_LAT, lon: BASE_LON, gps_accuracy_m: 8 });
    assert.equal(res.decision, 'new');
    assert.equal(res.ticket_code, 'SS-0001');
    assert.equal(res.status, 'received');

    const inc = (await request(app).get('/incidents/1').set(STAFF)).body;
    assert.ok(inc.address.includes('Amalapuram'));
    assert.ok(inc.photo_url.startsWith('/uploads/reports/'));

    const msgs = await outboxFor(P1);
    assert.ok(msgs.some((m) => m.includes('SS-0001')));
  });

  it('test_same_photo_nearby_is_merged', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON, gps_accuracy_m: 8 });

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 30, 0);
    const photo1Resized = await makePhoto(1, true);
    const res = await postReport(photo1Resized, { phone: P2, lat, lon, gps_accuracy_m: 10 });
    assert.equal(res.decision, 'merge');
    assert.equal(res.ticket_code, 'SS-0001');
    assert.equal(res.report_count, 2);

    const msgs = await outboxFor(P2);
    assert.ok(msgs.some((m) => m.includes('people reported') || m.includes('మంది తెలిపారు')));
  });

  it('test_different_photo_nearby_goes_to_review', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON, gps_accuracy_m: 8 });

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 0, 40);
    const photo2 = await makePhoto(2);
    const res = await postReport(photo2, { phone: P2, lat, lon, gps_accuracy_m: 8 });
    assert.equal(res.decision, 'review');
    assert.equal(res.ticket_code, 'SS-0002');

    const inc = (await request(app).get('/incidents/2').set(STAFF)).body;
    assert.ok(inc.needs_review);
    assert.equal(inc.possible_duplicate_of, 1);
  });

  it('test_same_photo_far_away_is_flagged_as_forwarded', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON });

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 5000, 0);
    const photo1Resized = await makePhoto(1, true);
    const res = await postReport(photo1Resized, { phone: P2, lat, lon });
    assert.equal(res.decision, 'suspicious');
    assert.equal(res.status, 'review');

    const inc = (await request(app).get('/incidents/2').set(STAFF)).body;
    assert.ok(inc.review_reason.includes('forwarded'));
  });

  it('test_far_apart_same_category_creates_separate_tickets', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON });

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 800, 0);
    const photo2 = await makePhoto(2);
    const res = await postReport(photo2, { phone: P2, lat, lon });
    assert.equal(res.decision, 'new');
  });

  it('test_fake_gps_and_bad_signature_are_suspicious', async () => {
    const photo3 = await makePhoto(3);
    const res1 = await postReport(photo3, { phone: P1, lat: BASE_LAT, lon: BASE_LON, is_mocked: true });
    assert.equal(res1.decision, 'suspicious');

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 2000, 0);
    const photo4 = await makePhoto(4);
    const res2 = await postReport(photo4, {
      phone: P2,
      lat,
      lon,
      captured_at: '2026-11-16T10:00:00+05:30',
      signature: '0'.repeat(64),
    });
    assert.equal(res2.decision, 'suspicious');

    const inc = (await request(app).get(`/incidents/${res2.incident_id}`).set(STAFF)).body;
    assert.equal(inc.reports[0].integrity, 'failed');
  });

  it('test_valid_signature_is_verified', async () => {
    const photo = await makePhoto(5);
    const captured = '2026-11-16T10:00:00+05:30';
    const sha = imaging.sha256Hex(photo);
    const sig = imaging.sign(imaging.signaturePayload(sha, BASE_LAT, BASE_LON, captured));

    const res = await postReport(photo, { phone: P1, lat: BASE_LAT, lon: BASE_LON, captured_at: captured, signature: sig });
    assert.equal(res.decision, 'new');

    const inc = (await request(app).get('/incidents/1').set(STAFF)).body;
    assert.equal(inc.reports[0].integrity, 'verified');
  });

  // 2. SMS, mesh and voice
  it('test_coded_sms_near_photo_ticket_merges', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON, gps_accuracy_m: 8 });

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 20, 0);
    const body = sms.encodeCoded({
      category: 'ELEC-POLE',
      lat,
      lon,
      report_id: 'AB12CD34',
      severity: 4,
      people: 3,
      accuracy_m: 15,
      hhmm: '0930',
    });

    const res = (await request(app).post('/sms/inbound').send({ from: P2, message: body })).body;
    assert.equal(res.type, 'coded_report');
    assert.equal(res.decision, 'merge');
    assert.equal(res.ticket_code, 'SS-0001');
  });

  it('test_sms_first_then_photo_later_counts_once', async () => {
    const body = sms.encodeCoded({ category: 'TREE', lat: BASE_LAT, lon: BASE_LON, report_id: 'ZZ99YY88' });
    const first = (await request(app).post('/sms/inbound').send({ from: P1, message: body })).body;
    assert.equal(first.decision, 'new');

    const photo7 = await makePhoto(7);
    const later = await postReport(photo7, {
      client_report_id: 'zz99yy88',
      phone: P1,
      lat: BASE_LAT,
      lon: BASE_LON,
      category: 'TREE',
    });
    assert.equal(later.decision, 'photo_attached');
    assert.equal(later.report_count, 1);

    const inc = (await request(app).get('/incidents/1').set(STAFF)).body;
    assert.ok(inc.photo_url);

    const again = await postReport(photo7, {
      client_report_id: 'ZZ99YY88',
      phone: P1,
      lat: BASE_LAT,
      lon: BASE_LON,
    });
    assert.equal(again.decision, 'duplicate_submission');
  });

  it('test_mesh_relay_batch', async () => {
    const [lat, lon] = offset(BASE_LAT, BASE_LON, 0, 300);
    const msgs = [
      sms.encodeCoded({ category: 'FLOOD', lat, lon, report_id: 'MESH0001', phone: P2, people: 6 }),
      sms.encodeCoded({ category: 'TRAPPED', lat, lon, report_id: 'MESH0002', phone: P3, sos: true, people: 4, battery_pct: 22 }),
      'hello this is not coded',
    ];

    const res = (await request(app).post('/mesh/relay').send({ relayed_by: P1, messages: msgs })).body;
    assert.equal(res.processed, 3);
    const ok = res.results.filter((r) => r.ok);
    assert.equal(ok.length, 2);
    assert.equal(res.results[2].ok, false);

    const outP3 = await outboxFor(P3);
    assert.ok(outP3.length > 0);
    assert.ok(outP3[0].includes('SOS received'));

    const sos = (await request(app).get(`/incidents/${ok[1].incident_id}`).set(STAFF)).body;
    assert.equal(sos.is_sos, true);
    assert.equal(sos.reports[0].relayed_by, P1);
    assert.equal(sos.reports[0].battery_pct, 22);
  });

  it('test_telugu_voice_report_is_classified_and_located', async () => {
    const res = (await request(app).post('/voice/transcript').send({
      phone: P1,
      text: 'అమలాపురం దగ్గర కరెంటు స్తంభం పడిపోయింది, తీగలు రోడ్డు మీద ఉన్నాయి',
    })).body;
    assert.equal(res.type, 'text_report');
    assert.equal(res.status, 'received');

    const inc = (await request(app).get(`/incidents/${res.incident_id}`).set(STAFF)).body;
    assert.equal(inc.category, 'ELEC');
    assert.equal(inc.department, 'electricity');
    assert.equal(inc.reports[0].location_source, 'text');
  });

  it('test_text_without_location_asks_for_village_then_updates', async () => {
    const res = (await request(app).post('/sms/inbound').send({
      from: P1,
      message: 'Big tree fell on our street, road blocked',
    })).body;
    assert.equal(res.status, 'review');

    const msgs = await outboxFor(P1);
    assert.ok(msgs[0].includes('village name'));

    const res2 = (await request(app).post('/sms/inbound').send({
      from: P1,
      message: 'Kakinada',
    })).body;
    assert.equal(res2.type, 'location_update');
    assert.equal(res2.place, 'Kakinada');

    const inc = (await request(app).get('/incidents/1').set(STAFF)).body;
    assert.equal(inc.status, 'received');
    assert.notEqual(inc.lat, null);
  });

  // 3. SOS Handling
  it('test_sos_is_never_merged_but_grouped_and_on_top', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON, people_count: 50 });

    const a = (await request(app).post('/sos').send({
      phone: P2,
      lat: BASE_LAT,
      lon: BASE_LON,
      sos_type: 'TRAPPED',
      people_count: 3,
    })).body;

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 20, 0);
    const b = (await request(app).post('/sos').send({
      phone: P3,
      lat,
      lon,
      sos_type: 'MEDICAL',
      medical_notes: 'Pregnant, 8 months',
    })).body;

    assert.notEqual(a.incident_id, b.incident_id);
    assert.equal(b.decision, 'sos_area');

    const sosB = (await request(app).get(`/incidents/${b.incident_id}`).set(STAFF)).body;
    assert.equal(sosB.sos_area_id, a.incident_id);
    assert.equal(sosB.department, 'health');
    assert.equal(sosB.vulnerable, true);

    const queue = (await request(app).get('/incidents').set(STAFF)).body.items;
    assert.equal(queue[0].is_sos, true);
    assert.equal(queue[1].is_sos, true);
    assert.equal(queue[2].is_sos, false);
  });

  // 4. Full lifecycle with escalation by SMS
  it('test_full_lifecycle_with_escalation_by_sms', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON });

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 10, 0);
    const photo1Resized = await makePhoto(1, true);
    await postReport(photo1Resized, { phone: P2, lat, lon });

    for (const st of ['assigned', 'in_progress']) {
      const res = await request(app)
        .post('/incidents/1/status')
        .set(STAFF)
        .send({ status: st, actor: 'AE Amalapuram' });
      assert.equal(res.status, 200);
    }

    const proofPhoto = await makePhoto(9);
    const r = await request(app)
      .post('/incidents/1/status')
      .set(STAFF)
      .field('status', 'resolved')
      .field('actor', 'Lineman Ravi')
      .attach('proof', proofPhoto, 'fix.jpg');
    assert.ok(r.body.resolution_photo_url);

    const msgs = await outboxFor(P2);
    assert.ok(msgs.some((m) => m.includes("Reply 'SS-0001 1'")));

    // Citizen replies NO (not fixed) -> escalates
    const escRes = (await request(app).post('/sms/inbound').send({ from: P2, message: 'SS-0001 2' })).body;
    assert.equal(escRes.status, 'escalated');

    const incEsc = (await request(app).get('/incidents/1').set(STAFF)).body;
    assert.equal(incEsc.escalation_level, 1);

    // Lineman resolves again
    await request(app).post('/incidents/1/status').set(STAFF).send({ status: 'resolved' });

    // Citizen replies YES in Telugu ("ss-1 అవును") -> closed
    const closeRes = (await request(app).post('/sms/inbound').send({ from: P1, message: 'ss-1 అవును' })).body;
    assert.equal(closeRes.status, 'closed');

    const incFinal = (await request(app).get('/incidents/1').set(STAFF)).body;
    const timeline = incFinal.timeline;
    assert.equal(timeline[timeline.length - 1].status, 'closed');
  });

  it('test_invalid_transition_and_stranger_confirmation_are_refused', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON });

    // Invalid transition received -> closed directly (must be 409)
    const badTransition = await request(app).post('/incidents/1/status').set(STAFF).send({ status: 'closed' });
    assert.equal(badTransition.status, 409);

    await request(app).post('/incidents/1/status').set(STAFF).send({ status: 'resolved' });

    // Stranger confirmation must be refused with 409
    const stranger = await request(app).post('/incidents/1/confirm').send({ fixed: true, phone: '9999999999' });
    assert.equal(stranger.status, 409);
  });

  it('test_official_merges_a_review_ticket', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON });

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 0, 40);
    const photo2 = await makePhoto(2);
    await postReport(photo2, { phone: P2, lat, lon });

    const merged = (await request(app).post('/incidents/2/merge-into/1').set(STAFF).send({ actor: 'Control room' })).body;
    assert.equal(merged.report_count, 2);
    assert.equal(merged.reports.length, 2);

    const inc2 = (await request(app).get('/incidents/2').set(STAFF)).body;
    assert.equal(inc2.status, 'merged');

    const msgs = await outboxFor(P2);
    assert.ok(msgs.some((m) => m.includes('Combined with ticket SS-0001')));
  });

  it('test_public_endpoints_hide_phones_and_sos', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON });
    await request(app).post('/sos').send({ phone: P2, lat: BASE_LAT, lon: BASE_LON });

    const publicIncidents = (await request(app).get('/public/incidents')).body;
    assert.equal(publicIncidents.length, 1);
    assert.equal(publicIncidents[0].phone, undefined);

    const summary = (await request(app).get('/public/summary')).body;
    assert.equal(summary.open_tickets, 2);
    assert.equal(summary.open_sos, 1);
  });

  it('test_bad_image_is_rejected', async () => {
    const res = await request(app)
      .post('/reports')
      .field('meta', JSON.stringify({ category: 'ELEC' }))
      .attach('photo', Buffer.from('not an image'), 'x.jpg');
    assert.equal(res.status, 400);
  });

  // 5. Auth and Department scoping
  it('test_staff_endpoints_need_login', async () => {
    const incRes = await request(app).get('/incidents');
    assert.equal(incRes.status, 401);

    const outRes = await request(app).get('/outbox');
    assert.equal(outRes.status, 401);

    const pubRes = await request(app).get('/public/summary');
    assert.equal(pubRes.status, 200);
  });

  it('test_departments_only_see_and_change_their_own_tickets', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON, category: 'ELEC' });

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 900, 0);
    const photo2 = await makePhoto(2);
    await postReport(photo2, { phone: P2, lat, lon, category: 'TREE' });

    const elecStaff = { 'X-Staff-Token': 'elec-demo' };
    const me = (await request(app).get('/auth/me').set(elecStaff)).body;
    assert.equal(me.department, 'electricity');

    const items = (await request(app).get('/incidents').set(elecStaff)).body.items;
    assert.deepEqual(items.map((i) => i.category), ['ELEC']);

    const inc2 = await request(app).get('/incidents/2').set(elecStaff);
    assert.equal(inc2.status, 403);

    const r = await request(app).post('/incidents/1/status').set(elecStaff).send({ status: 'in_progress', actor: 'Lineman Ravi' });
    assert.equal(r.status, 200);
    assert.ok(r.body.timeline[r.body.timeline.length - 1].actor.includes('Lineman Ravi'));

    const rej = await request(app).post('/incidents/1/status').set(elecStaff).send({ status: 'rejected' });
    assert.equal(rej.status, 403);
  });

  // 6. Early warnings & CAP
  it('test_cap_import_reads_english_and_telugu', async () => {
    const capPath = path.join(env.BASE_DIR, 'data', 'sample_cap_alert.xml');
    const xml = fs.readFileSync(capPath, 'utf-8');

    const first = (await request(app).post('/alerts/import-cap').set(STAFF).set('Content-Type', 'application/xml').send(xml)).body;
    assert.equal(first.created, true);
    assert.equal(first.level, 'red');
    assert.equal(first.radius_km, 25);
    assert.ok(first.message_te.includes('తుఫాను'));

    const second = (await request(app).post('/alerts/import-cap').set(STAFF).send({ xml })).body;
    assert.equal(second.created, false);
    assert.equal(second.id, first.id);

    const bad = await request(app).post('/alerts/import-cap').set(STAFF).send({ xml: '<not-cap>bad</not-cap>' });
    assert.equal(bad.status, 400);

    const active = (await request(app).get('/alerts/active').query({ lat: BASE_LAT, lon: BASE_LON })).body;
    assert.equal(active.length, 1);
  });

  it('test_vulnerable_people_register_and_show_up_in_alert_area', async () => {
    const r1 = await request(app).post('/citizens/register').send({
      phone: P1,
      name: 'Lakshmi',
      village: 'Amalapuram',
      household_size: 4,
      needs: ['elderly', 'pregnant'],
      family_contacts: [P2],
      consent: true,
    });
    assert.equal(r1.body.located, true);

    const rNoConsent = await request(app).post('/citizens/register').send({ phone: '9000000003', consent: false });
    assert.equal(rNoConsent.status, 400);

    const capPath = path.join(env.BASE_DIR, 'data', 'sample_cap_alert.xml');
    const xml = fs.readFileSync(capPath, 'utf-8');
    const alertId = (await request(app).post('/alerts/import-cap').set(STAFF).send({ xml })).body.id;

    const res = (await request(app).get('/citizens/vulnerable').set(STAFF).query({ alert_id: alertId })).body;
    assert.equal(res.count, 1);
    assert.equal(res.people_in_households, 4);
    assert.equal(res.by_need.pregnant, 1);
  });

  it('test_track_ticket_hides_phone_numbers', async () => {
    const photo1 = await makePhoto(1);
    await postReport(photo1, { phone: P1, lat: BASE_LAT, lon: BASE_LON });
    await request(app).post('/incidents/1/status').set(STAFF).send({ status: 'resolved' });
    await request(app).post('/sms/inbound').send({ from: P1, message: 'SS-0001 2' });

    const t = (await request(app).get('/track/SS-0001')).body;
    assert.equal(t.status, 'escalated');
    assert.ok(t.timeline.every((e) => !e.note || !e.note.includes(P1)));

    const tLower = (await request(app).get('/track/ss1')).body;
    assert.equal(tLower.ticket_code, 'SS-0001');

    const badTrack = await request(app).get('/track/hello');
    assert.equal(badTrack.status, 400);
  });

  it('test_sos_pings_update_location_until_acknowledged', async () => {
    const sos = (await request(app).post('/sos').send({
      client_report_id: 'SOSPING1',
      phone: P1,
      lat: BASE_LAT,
      lon: BASE_LON,
      sos_type: 'TRAPPED',
      people_count: 3,
      battery_pct: 60,
    })).body;

    const [lat, lon] = offset(BASE_LAT, BASE_LON, 60, 0);
    const r = (await request(app).post('/sos/update').send({
      client_report_id: 'sosping1',
      lat,
      lon,
      gps_accuracy_m: 12,
      battery_pct: 41,
    })).body;
    assert.equal(r.acknowledged, false);

    const inc = (await request(app).get(`/incidents/${sos.incident_id}`).set(STAFF)).body;
    assert.ok(Math.abs(inc.lat - lat) < 1e-4);
    assert.equal(inc.battery_pct, 41);
    assert.equal(inc.sos_phone, P1);

    await request(app).post(`/incidents/${sos.incident_id}/status`).set(STAFF).send({ status: 'assigned' });
    const rAck = (await request(app).post('/sos/update').send({ client_report_id: 'SOSPING1' })).body;
    assert.equal(rAck.acknowledged, true);
  });

  it('test_app_config_places_reverse_and_ai_fallback', async () => {
    const cfg = (await request(app).get('/app/config')).body;
    assert.ok(cfg.categories.ELEC);
    assert.equal(cfg.ai_photo_check, false);

    const places = (await request(app).get('/geo/places')).body;
    assert.ok(places.some((p) => p.name === 'Kakinada'));

    const rev = (await request(app).get('/geo/reverse').query({ lat: BASE_LAT, lon: BASE_LON })).body;
    assert.ok(rev.address.includes('Amalapuram'));

    const photo1 = await makePhoto(1);
    const aiRes = (await request(app).post('/ai/classify-photo').attach('photo', photo1, 'p.jpg')).body;
    assert.deepEqual(aiRes, { suggestion: null, ai_enabled: false });
  });

  it('test_web_apps_are_served', async () => {
    for (const p of ['/', '/vendor/leaflet/leaflet.js', '/shared/base.css']) {
      const res = await request(app).get(p);
      assert.equal(res.status, 200);
    }
  });
});

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const env = require('../server/config/env');
const imaging = require('../server/services/imaging');
const sms = require('../server/services/sms');

const STAFF = { 'X-Staff-Token': 'control-demo' };
const CAP_FILE = path.join(env.BASE_DIR, 'data', 'sample_cap_alert.xml');
const AMALAPURAM = [16.5787, 82.0061];
const KAKINADA = [16.9891, 82.2475];

function move(point, northM = 0, eastM = 0) {
  return [
    point[0] + northM / 111320,
    point[1] + eastM / (111320 * 0.96),
  ];
}

async function createPhoto(seed, label, small = false) {
  const width = small ? 480 : 800;
  const height = small ? 360 : 600;

  // Generate deterministic shapes based on seed
  const r = (seed * 67 + 100) % 256;
  const g = (seed * 131 + 50) % 256;
  const b = (seed * 197 + 120) % 256;

  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="rgb(${r},${g},${b})" />
      <circle cx="${width * 0.3}" cy="${height * 0.4}" r="${width * 0.2}" fill="rgb(${(r+80)%256},${(g+50)%256},${(b+100)%256})" />
      <rect x="${width * 0.5}" y="${height * 0.3}" width="${width * 0.35}" height="${height * 0.4}" fill="rgb(${(r+120)%256},${(g+150)%256},${(b+30)%256})" />
      <rect x="0" y="${height - 40}" width="${width}" height="40" fill="#000" />
      <text x="10" y="${height - 14}" fill="#fff" font-family="sans-serif" font-size="18">DEMO PHOTO: ${label}</text>
    </svg>
  `;

  return await sharp(Buffer.from(svg))
    .jpeg({ quality: small ? 60 : 88 })
    .toBuffer();
}

async function postReport(base, phone, point, category, seed, label, small = false, extra = {}) {
  const data = await createPhoto(seed, label, small);
  const captured = '2026-11-16T09:30:00+05:30';
  const sha = imaging.sha256Hex(data);
  const sig = imaging.sign(imaging.signaturePayload(sha, point[0], point[1], captured));

  const meta = {
    phone,
    lat: point[0],
    lon: point[1],
    gps_accuracy_m: 9,
    category,
    captured_at: captured,
    signature: sig,
    ...extra,
  };

  const formData = new FormData();
  formData.append('meta', JSON.stringify(meta));
  formData.append('photo', new Blob([data], { type: 'image/jpeg' }), 'photo.jpg');

  const res = await fetch(`${base}/reports`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Report failed (${res.status}): ${text}`);
  }
  const out = await res.json();
  console.log(`${label.padEnd(38)} -> ${out.ticket_code}  ${out.decision.padEnd(11)} ${out.detail || ''}`);
  return out;
}

async function main(base = 'http://localhost:8000') {
  console.log(`Connecting to server at ${base}...`);
  const healthRes = await fetch(`${base}/health`);
  if (!healthRes.ok) {
    throw new Error(`Server at ${base} is not healthy: ${healthRes.statusText}`);
  }
  console.log('Seeding demo data...\n');

  await postReport(base, '9000000001', AMALAPURAM, 'ELEC-POLE', 1, 'Pole down (citizen 1)', false, {
    severity: 4,
    description: 'Electric pole fell, live wire on road',
  });

  await postReport(base, '9000000002', move(AMALAPURAM, 30), 'ELEC-POLE', 1, 'Same pole, re-sent photo (citizen 2)', true);
  await postReport(base, '9000000003', move(AMALAPURAM, 0, 45), 'ELEC', 2, 'Different photo nearby (citizen 3)');
  await postReport(base, '9000000004', move(AMALAPURAM, 6000), 'ELEC', 1, 'Same photo 6 km away (forwarded)', true);
  await postReport(base, '9000000005', move(KAKINADA, 120), 'TREE', 11, 'Tree blocking road, Kakinada');
  await postReport(base, '9000000006', move(KAKINADA, -400, 250), 'FLOOD', 12, 'Water entering houses', false, {
    people_count: 12,
    description: 'Water inside houses, elderly people here',
  });

  // Coded SMS
  const coded = sms.encodeCoded({
    category: 'ELEC-POLE',
    lat: AMALAPURAM[0] + 0.0001,
    lon: AMALAPURAM[1],
    report_id: 'DEMO0SMS',
    severity: 4,
    people: 2,
    accuracy_m: 20,
    hhmm: '0935',
  });
  let r = await fetch(`${base}/sms/inbound`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from: '9000000007', message: coded }),
  }).then((res) => res.json());
  console.log(`${'Coded SMS (no internet)'.padEnd(38)} -> ${r.ticket_code}  ${r.decision}`);

  // Telugu voice transcript
  r = await fetch(`${base}/voice/transcript`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phone: '9000000008',
      text: 'కాకినాడ లో వరద నీరు ఇళ్ళలోకి వస్తోంది, పిల్లలు ఉన్నారు',
    }),
  }).then((res) => res.json());
  console.log(`${'Telugu voice call'.padEnd(38)} -> ${r.ticket_code}  ${r.decision}`);

  // Mesh relay batch
  const meshMsg = sms.encodeCoded({
    category: 'TRAPPED',
    lat: move(KAKINADA, -380, 260)[0],
    lon: move(KAKINADA, -380, 260)[1],
    report_id: 'DEMOSOS1',
    sos: true,
    people: 4,
    battery_pct: 18,
    phone: '9000000009',
  });
  r = await fetch(`${base}/mesh/relay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ relayed_by: '9000000010', messages: [meshMsg] }),
  }).then((res) => res.json());
  console.log(`${'SOS relayed over Bluetooth mesh'.padEnd(38)} -> ${r.results[0].ticket_code}  ${r.results[0].decision}`);

  // SOS medical
  r = await fetch(`${base}/sos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      phone: '9000000011',
      lat: move(KAKINADA, -390, 255)[0],
      lon: move(KAKINADA, -390, 255)[1],
      sos_type: 'MEDICAL',
      battery_pct: 35,
      medical_notes: 'Pregnant, 8 months',
    }),
  }).then((res) => res.json());
  console.log(`${'SOS medical (same building)'.padEnd(38)} -> ${r.ticket_code}  ${r.decision}`);

  // Status transitions on ticket 1
  const form1 = new FormData();
  form1.append('status', 'assigned');
  form1.append('actor', 'AE Electricity');
  await fetch(`${base}/incidents/1/status`, { method: 'POST', headers: STAFF, body: form1 });

  const form2 = new FormData();
  form2.append('status', 'in_progress');
  form2.append('actor', 'Lineman team');
  await fetch(`${base}/incidents/1/status`, { method: 'POST', headers: STAFF, body: form2 });

  // Resolve ticket 4 with proof photo & confirm
  const proofPhoto = await createPhoto(99, 'CLEARED ROAD');
  const formProof = new FormData();
  formProof.append('status', 'resolved');
  formProof.append('note', 'Tree cut and cleared');
  formProof.append('proof', new Blob([proofPhoto], { type: 'image/jpeg' }), 'fix.jpg');
  await fetch(`${base}/incidents/4/status`, { method: 'POST', headers: STAFF, body: formProof });

  await fetch(`${base}/sms/inbound`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from: '+919000000005', message: 'SS-0004 1' }),
  });
  console.log(`${'Tree ticket fixed and confirmed'.padEnd(38)} -> SS-0004  closed`);

  // CAP alert import
  const xml = fs.readFileSync(CAP_FILE, 'utf-8');
  r = await fetch(`${base}/alerts/import-cap`, {
    method: 'POST',
    headers: { ...STAFF, 'content-type': 'application/json' },
    body: JSON.stringify({ xml }),
  }).then((res) => res.json());
  console.log(`${'CAP warning imported'.padEnd(38)} -> ${r.level} ${r.title.slice(0, 40)}`);

  // Vulnerable households
  const households = [
    { phone: '9000000021', name: 'Lakshmi', needs: ['elderly', 'bedridden'], size: 3 },
    { phone: '9000000022', name: 'Ramya', needs: ['pregnant'], size: 4 },
    { phone: '9000000023', name: 'Suresh', needs: ['dialysis'], size: 2 },
  ];
  for (const h of households) {
    const lat = AMALAPURAM[0] + (Math.random() - 0.5) * 0.04;
    const lon = AMALAPURAM[1] + (Math.random() - 0.5) * 0.04;
    await fetch(`${base}/citizens/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phone: h.phone,
        name: h.name,
        village: 'Amalapuram',
        needs: h.needs,
        household_size: h.size,
        consent: true,
        lat,
        lon,
      }),
    });
  }
  console.log(`${'Vulnerable households registered'.padEnd(38)} -> 3`);

  // Print Queue
  const queueData = await fetch(`${base}/incidents`, { headers: STAFF }).then((res) => res.json());
  console.log('\nQueue (most urgent first):');
  for (const item of queueData.items) {
    const tag = item.is_sos ? 'SOS ' : '';
    console.log(
      `  ${item.ticket_code}  ${tag}${item.category.padEnd(9)} ${item.status.padEnd(12)} priority ${String(item.priority).padStart(6)}  reports ${item.report_count}  ${item.address || ''}`
    );
  }
  console.log(`\nOpen ${base}/ for the MERN apps. Staff tokens: control-demo, elec-demo, health-demo, rescue-demo, roads-demo, transport-demo`);
}

if (require.main === module) {
  const base = process.argv[2] || 'http://localhost:8000';
  main(base).catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { main };

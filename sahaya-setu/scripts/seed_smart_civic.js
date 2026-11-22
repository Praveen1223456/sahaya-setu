const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const env = require('../server/config/env');
const { connectDB } = require('../server/config/db');
const User = require('../server/models/User');
const Department = require('../server/models/Department');
const Incident = require('../server/models/Incident');
const Assignment = require('../server/models/Assignment');
const StatusEvent = require('../server/models/StatusEvent');
const DisasterEvent = require('../server/models/DisasterEvent');
const Feedback = require('../server/models/Feedback');
const { getNextSequence } = require('../server/models/Counter');

// Helper to generate a realistic SVG placeholder image
async function createDemoPhoto(title, colorHex, filename, folder = 'reports') {
  const dir = path.join(env.UPLOAD_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, filename);

  const svg = `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colorHex}" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#111827" stop-opacity="0.95"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="400" cy="240" r="140" fill="#ffffff" fill-opacity="0.08"/>
      <rect x="60" y="440" width="680" height="110" rx="12" fill="#000000" fill-opacity="0.65"/>
      <text x="80" y="480" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="bold">
        ${title.replace(/&/g, '&amp;')}
      </text>
      <text x="80" y="520" fill="#93c5fd" font-family="sans-serif" font-size="16">
        Sahaya Setu Field Verification • Konaseema Command Zone
      </text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(fullPath);
  return `/uploads/${folder}/${filename}`;
}

async function runSeed() {
  console.log('Connecting to MongoDB...');
  await connectDB(env.MONGODB_URI);

  console.log('Cleaning up existing database collections...');
  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    Incident.deleteMany({}),
    Assignment.deleteMany({}),
    StatusEvent.deleteMany({}),
    DisasterEvent.deleteMany({}),
    Feedback.deleteMany({}),
  ]);

  console.log('Generating demo evidence photos...');
  const poleBefore = await createDemoPhoto('Fallen 11kV Electricity Pole & Live Wires', '#dc2626', 'pole_before.jpg', 'reports');
  const pipeBefore = await createDemoPhoto('Main Drinking Water Pipeline Burst', '#0284c7', 'pipe_before.jpg', 'reports');
  const potholeBefore = await createDemoPhoto('Severe Road Crater & Pothole', '#d97706', 'pothole_before.jpg', 'reports');
  const treeBefore = await createDemoPhoto('Uprooted Tree Blocking Arterial Road', '#16a34a', 'tree_before.jpg', 'reports');
  const treeAfter = await createDemoPhoto('Tree Cleared & Road Restored to Traffic', '#059669', 'tree_after.jpg', 'resolutions');
  const lightBefore = await createDemoPhoto('Streetlight Blackout on High School Road', '#6b7280', 'light_before.jpg', 'reports');
  const floodBefore = await createDemoPhoto('Flash Flooding Near Canal Inundating Homes', '#7c3aed', 'flood_before.jpg', 'reports');

  console.log('Seeding Departments...');
  const departments = await Department.create([
    {
      name: 'Electricity Department',
      code: 'electricity',
      description: 'Power grid maintenance, transformer fixes, streetlight repairs, live line safety.',
      headEmail: 'elec.head@sahayasetu.gov.in',
      phone: '+91 8856 220101',
      slaHoursDefault: 6,
      icon: 'Zap',
      color: '#eab308',
      categories: ['ELEC-POLE', 'ELEC-WIRE', 'ELEC-TRANSFORMER', 'ELEC-STREETLIGHT', 'ELEC'],
    },
    {
      name: 'Water Supply & Sewage',
      code: 'water',
      description: 'Drinking water distribution, pipeline leak repairs, booster pumps, valves.',
      headEmail: 'water.head@sahayasetu.gov.in',
      phone: '+91 8856 220102',
      slaHoursDefault: 12,
      icon: 'Droplets',
      color: '#0284c7',
      categories: ['WATER-LEAK', 'WATER-SUPPLY'],
    },
    {
      name: 'Roads & Public Infrastructure',
      code: 'roads',
      description: 'Road damage, pothole repairs, culverts, public bridges, sidewalk upkeep.',
      headEmail: 'roads.head@sahayasetu.gov.in',
      phone: '+91 8856 220103',
      slaHoursDefault: 48,
      icon: 'Construction',
      color: '#f97316',
      categories: ['ROAD-POTHOLE', 'ROAD-BLOCKED', 'ROAD'],
    },
    {
      name: 'Sanitation & Solid Waste',
      code: 'sanitation',
      description: 'Municipal garbage collection, illegal dumping removal, market cleanliness.',
      headEmail: 'sanitation.head@sahayasetu.gov.in',
      phone: '+91 8856 220104',
      slaHoursDefault: 24,
      icon: 'Trash2',
      color: '#84cc16',
      categories: ['GARBAGE-DUMP', 'GARBAGE'],
    },
    {
      name: 'Horticulture & Municipal Parks',
      code: 'horticulture',
      description: 'Tree pruning, clearing fallen trees, public park maintenance.',
      headEmail: 'horticulture.head@sahayasetu.gov.in',
      phone: '+91 8856 220105',
      slaHoursDefault: 8,
      icon: 'Trees',
      color: '#10b981',
      categories: ['TREE-FALLEN', 'TREE'],
    },
    {
      name: 'Drainage Department',
      code: 'drainage',
      description: 'Storm water drain clearing, underground sewage clog removal, desilting.',
      headEmail: 'drainage.head@sahayasetu.gov.in',
      phone: '+91 8856 220106',
      slaHoursDefault: 12,
      icon: 'Waves',
      color: '#06b6d4',
      categories: ['DRAINAGE-OVERFLOW', 'DRAINAGE-BLOCK'],
    },
    {
      name: 'Emergency & Disaster Response',
      code: 'emergency',
      description: 'Cyclone emergency coordination, flood rescues, emergency hazard response.',
      headEmail: 'disaster.head@sahayasetu.gov.in',
      phone: '+91 8856 220100',
      slaHoursDefault: 2,
      icon: 'Flame',
      color: '#ef4444',
      categories: ['DISASTER-FLOOD', 'DISASTER-CYCLONE', 'PUBLIC-SAFETY', 'FLOOD'],
    },
  ]);

  console.log('Seeding Demo Users across all 4 roles...');
  // Super Admin
  const superAdmin = await User.create({
    name: 'District Collector & Super Admin',
    email: 'admin@sahayasetu.gov.in',
    password: 'password123',
    phone: '+91 94901 00001',
    role: 'super_admin',
    department: '*',
  });

  // Citizen
  const citizen = await User.create({
    name: 'Ramesh Varma',
    email: 'citizen@sahayasetu.gov.in',
    password: 'password123',
    phone: '9876543210',
    role: 'citizen',
  });

  // Department Admins
  const elecAdmin = await User.create({
    name: 'K. S. Narayana (EE)',
    email: 'elec.admin@sahayasetu.gov.in',
    password: 'password123',
    phone: '+91 94901 00011',
    role: 'department_admin',
    department: 'electricity',
  });

  const waterAdmin = await User.create({
    name: 'M. Padma (AEE)',
    email: 'water.admin@sahayasetu.gov.in',
    password: 'password123',
    phone: '+91 94901 00012',
    role: 'department_admin',
    department: 'water',
  });

  const roadsAdmin = await User.create({
    name: 'V. Srinivasa Rao (DEE)',
    email: 'roads.admin@sahayasetu.gov.in',
    password: 'password123',
    phone: '+91 94901 00013',
    role: 'department_admin',
    department: 'roads',
  });

  // Field Employees
  const elecField = await User.create({
    name: 'Suresh Kumar (Line Inspector)',
    email: 'elec.field@sahayasetu.gov.in',
    password: 'password123',
    phone: '+91 94901 00021',
    role: 'field_employee',
    department: 'electricity',
    skills: ['power-lines', 'pole-erection', 'transformer-repair', 'high-voltage'],
    availability: 'available',
    activeTasksCount: 1,
    location: { type: 'Point', coordinates: [82.0065, 16.579] },
  });

  const waterField = await User.create({
    name: 'Ch. Venkata Ramana (Chief Plumber)',
    email: 'water.field@sahayasetu.gov.in',
    password: 'password123',
    phone: '+91 94901 00022',
    role: 'field_employee',
    department: 'water',
    skills: ['pipeline-welding', 'valve-replacement', 'heavy-pipe-jointing'],
    availability: 'busy',
    activeTasksCount: 1,
    location: { type: 'Point', coordinates: [82.008, 16.581] },
  });

  const roadsField = await User.create({
    name: 'B. Appa Rao (Road Crew Lead)',
    email: 'roads.field@sahayasetu.gov.in',
    password: 'password123',
    phone: '+91 94901 00023',
    role: 'field_employee',
    department: 'roads',
    skills: ['asphalt-patching', 'debris-clearing', 'heavy-machinery'],
    availability: 'available',
    activeTasksCount: 1,
    location: { type: 'Point', coordinates: [82.004, 16.575] },
  });

  console.log('Seeding Active Disaster Event...');
  const disasterEvent = await DisasterEvent.create({
    title: 'Severe Cyclone Jal - Coastal Infrastructure Response',
    hazardType: 'cyclone',
    severity: 'critical',
    areaName: 'Amalapuram & Godavari Delta Region',
    center_lat: 16.5787,
    center_lon: 82.0061,
    radius_km: 25,
    location: { type: 'Point', coordinates: [82.0061, 16.5787] },
    safetyGuidelines: [
      'Do not touch or approach downed power lines or leaning electricity poles.',
      'Do not attempt to cross flooded roadways, canals, or washed-out bridges.',
      'Report fallen trees and blocked roads with photos from a safe distance.',
      'Dial 112 immediately for stranded persons or medical emergencies.',
    ],
    status: 'active',
    activatedBy: 'District Collector',
    activatedAt: new Date(Date.now() - 6 * 3600 * 1000),
  });

  console.log('Seeding Sample Complaints across all workflow stages...');
  const now = new Date();

  // 1. New Complaint (Electricity Pole Down)
  const inc1 = await Incident.create({
    id: 1001,
    title: 'Fallen 11kV Electricity Pole & Live Wires',
    description: '11kV electric pole snapped during high winds. Live wire sparking across main road near Clock Tower.',
    category: 'ELEC-POLE',
    department: 'electricity',
    status: 'received',
    lat: 16.5787,
    lon: 82.0061,
    gps_accuracy_m: 6.5,
    address: 'Near Clock Tower, Main Road, Amalapuram, Konaseema',
    landmark: 'Opposite State Bank of India Main Branch',
    citizen_id: citizen._id,
    citizen_name: citizen.name,
    citizen_phone: citizen.phone,
    images: [poleBefore],
    best_photo_path: poleBefore,
    severity: 4,
    priority: 95,
    is_disaster_mode: true,
    emergency_severity: 'critical',
    sla_due_at: new Date(now.getTime() + 2 * 3600 * 1000),
    created_at: new Date(now.getTime() - 45 * 60 * 1000),
    upvotes: 8,
    supporters: ['9876543210', '9876543211', '9876543212'],
  });

  await StatusEvent.create({
    id: 1,
    incident_id: 1001,
    status: 'received',
    note: 'Emergency complaint submitted. Auto-routed to Electricity Department with 2h Critical SLA.',
    actor: citizen.name,
    actor_role: 'citizen',
    created_at: inc1.created_at,
  });

  // 2. Assigned Complaint (Water Pipeline Burst)
  const inc2 = await Incident.create({
    id: 1002,
    title: 'Main Drinking Water Pipeline Burst',
    description: '12-inch municipal drinking water transmission line burst. High pressure water inundating surrounding street.',
    category: 'WATER-LEAK',
    department: 'water',
    status: 'assigned',
    lat: 16.5815,
    lon: 82.0085,
    gps_accuracy_m: 8,
    address: 'Brodiepet 3rd Lane, Amalapuram, Konaseema',
    landmark: 'Behind Municipal Water Tank',
    citizen_id: citizen._id,
    citizen_name: citizen.name,
    citizen_phone: citizen.phone,
    images: [pipeBefore],
    best_photo_path: pipeBefore,
    assigned_employee_id: waterField._id,
    assigned_employee_name: waterField.name,
    assignment_status: 'assigned',
    assigned_at: new Date(now.getTime() - 90 * 60 * 1000),
    severity: 3,
    priority: 65,
    is_disaster_mode: false,
    emergency_severity: 'medium',
    sla_due_at: new Date(now.getTime() + 10 * 3600 * 1000),
    created_at: new Date(now.getTime() - 120 * 60 * 1000),
    upvotes: 3,
  });

  await Assignment.create({
    complaint_id: 1002,
    incident_oid: inc2._id,
    employee_id: waterField._id,
    employee_name: waterField.name,
    assigned_by: waterAdmin._id,
    assigned_by_name: waterAdmin.name,
    status: 'assigned',
    repair_notes: 'Priority: Isolate sector 4 valve and weld transmission fracture.',
    assigned_at: inc2.assigned_at,
  });

  await StatusEvent.create({
    id: 2,
    incident_id: 1002,
    status: 'received',
    note: 'Complaint submitted by citizen.',
    actor: citizen.name,
    actor_role: 'citizen',
    created_at: inc2.created_at,
  });

  await StatusEvent.create({
    id: 3,
    incident_id: 1002,
    status: 'assigned',
    note: `Assigned to ${waterField.name} by ${waterAdmin.name}.`,
    actor: waterAdmin.name,
    actor_role: 'department_admin',
    created_at: inc2.assigned_at,
  });

  // 3. In-Progress Complaint (Road Crater on NH Spur)
  const inc3 = await Incident.create({
    id: 1003,
    title: 'Severe Road Crater & Pothole',
    description: 'Deep pothole (2 feet wide) causing two-wheeler skids and traffic jam.',
    category: 'ROAD-POTHOLE',
    department: 'roads',
    status: 'in_progress',
    lat: 16.5745,
    lon: 82.0035,
    gps_accuracy_m: 5,
    address: 'Bypass Road Junction, Amalapuram',
    landmark: 'Near Indian Oil Petrol Station',
    citizen_id: citizen._id,
    citizen_name: citizen.name,
    citizen_phone: citizen.phone,
    images: [potholeBefore],
    best_photo_path: potholeBefore,
    assigned_employee_id: roadsField._id,
    assigned_employee_name: roadsField.name,
    assignment_status: 'in_progress',
    assigned_at: new Date(now.getTime() - 180 * 60 * 1000),
    severity: 2,
    priority: 50,
    is_disaster_mode: false,
    emergency_severity: 'medium',
    sla_due_at: new Date(now.getTime() + 24 * 3600 * 1000),
    created_at: new Date(now.getTime() - 240 * 60 * 1000),
    upvotes: 5,
  });

  await Assignment.create({
    complaint_id: 1003,
    incident_oid: inc3._id,
    employee_id: roadsField._id,
    employee_name: roadsField.name,
    assigned_by: roadsAdmin._id,
    assigned_by_name: roadsAdmin.name,
    status: 'in_progress',
    repair_notes: 'Cold mix asphalt patch crew deployed with compaction roller.',
    assigned_at: inc3.assigned_at,
    accepted_at: new Date(now.getTime() - 150 * 60 * 1000),
    started_at: new Date(now.getTime() - 60 * 60 * 1000),
  });

  await StatusEvent.create({
    id: 4,
    incident_id: 1003,
    status: 'in_progress',
    note: `${roadsField.name} arrived at site. Road repair work in progress.`,
    actor: roadsField.name,
    actor_role: 'field_employee',
    created_at: new Date(now.getTime() - 60 * 60 * 1000),
  });

  // 4. Resolved Complaint with Before & After Photos (Awaiting Citizen Verification)
  const inc4 = await Incident.create({
    id: 1004,
    title: 'Uprooted Banyan Tree Blocking Arterial Road',
    description: 'Heavy storm uprooted mature tree, entirely blocking vehicular transit.',
    category: 'TREE-FALLEN',
    department: 'horticulture',
    status: 'resolved',
    lat: 16.583,
    lon: 82.002,
    gps_accuracy_m: 7,
    address: 'Collectorate Road, Amalapuram',
    landmark: 'Near Revenue Divisional Office',
    citizen_id: citizen._id,
    citizen_name: citizen.name,
    citizen_phone: citizen.phone,
    images: [treeBefore],
    best_photo_path: treeBefore,
    after_images: [treeAfter],
    resolution_photo_path: treeAfter,
    resolution_notes: 'Tree trunk sectioned with chainsaws and loaded onto municipal trucks. Road swept and open for transit.',
    assigned_employee_id: roadsField._id,
    assigned_employee_name: roadsField.name,
    assignment_status: 'completed',
    verification_status: 'pending',
    severity: 3,
    priority: 75,
    is_disaster_mode: true,
    emergency_severity: 'high',
    sla_due_at: new Date(now.getTime() + 4 * 3600 * 1000),
    created_at: new Date(now.getTime() - 360 * 60 * 1000),
    resolved_at: new Date(now.getTime() - 30 * 60 * 1000),
    upvotes: 12,
  });

  await StatusEvent.create({
    id: 5,
    incident_id: 1004,
    status: 'resolved',
    note: `Repair completed by ${roadsField.name}. Proof photo uploaded. Citizen notified for verification.`,
    actor: roadsField.name,
    actor_role: 'field_employee',
    proof_photo: treeAfter,
    created_at: inc4.resolved_at,
  });

  // 5. Overdue Complaint (Streetlight Failure)
  const inc5 = await Incident.create({
    id: 1005,
    title: 'Streetlight Failure on Girls High School Road',
    description: 'Four consecutive streetlights out. Street is pitch black at night.',
    category: 'ELEC-STREETLIGHT',
    department: 'electricity',
    status: 'received',
    lat: 16.576,
    lon: 82.009,
    gps_accuracy_m: 10,
    address: 'Girls High School Road, Ward 7, Amalapuram',
    landmark: 'Adjacent to ZP High School Gate',
    citizen_id: citizen._id,
    citizen_name: citizen.name,
    citizen_phone: citizen.phone,
    images: [lightBefore],
    best_photo_path: lightBefore,
    severity: 1,
    priority: 45,
    is_disaster_mode: false,
    emergency_severity: 'low',
    sla_due_at: new Date(now.getTime() - 12 * 3600 * 1000), // OVERDUE by 12 hours!
    created_at: new Date(now.getTime() - 60 * 3600 * 1000),
    upvotes: 2,
  });

  await StatusEvent.create({
    id: 6,
    incident_id: 1005,
    status: 'received',
    note: 'Complaint submitted. SLA has lapsed.',
    actor: 'System',
    created_at: inc5.created_at,
  });

  // 6. Disaster Hazard (Flash Flood Water Inundation)
  const inc6 = await Incident.create({
    id: 1006,
    title: 'Canal Bank Overflow Inundating 14 Households',
    description: 'Heavy rainfall caused irrigation canal breach. Flood waters entering residential dwellings.',
    category: 'DISASTER-FLOOD',
    department: 'emergency',
    status: 'received',
    lat: 16.589,
    lon: 82.012,
    gps_accuracy_m: 6,
    address: 'Kovvada Canal Bund, Outskirts of Amalapuram',
    landmark: 'Near Sluice Gate No. 3',
    citizen_id: citizen._id,
    citizen_name: citizen.name,
    citizen_phone: citizen.phone,
    images: [floodBefore],
    best_photo_path: floodBefore,
    severity: 4,
    priority: 98,
    is_disaster_mode: true,
    emergency_severity: 'critical',
    is_sos: true,
    people_count: 35,
    vulnerable: true,
    sla_due_at: new Date(now.getTime() + 1 * 3600 * 1000),
    created_at: new Date(now.getTime() - 20 * 60 * 1000),
    upvotes: 18,
  });

  await StatusEvent.create({
    id: 7,
    incident_id: 1006,
    status: 'received',
    note: 'CRITICAL EMERGENCY: Canal breach affecting 35 people. Emergency response mobilized.',
    actor: citizen.name,
    actor_role: 'citizen',
    created_at: inc6.created_at,
  });

  console.log('\n======================================================');
  console.log('SMART CIVIC RESPONSE PLATFORM SEED COMPLETED!');
  console.log('======================================================');
  console.log('Demo Credentials:');
  console.log('  • Super Admin:       admin@sahayasetu.gov.in       / password123');
  console.log('  • Citizen:           citizen@sahayasetu.gov.in     / password123');
  console.log('  • Elec Admin:        elec.admin@sahayasetu.gov.in  / password123');
  console.log('  • Water Admin:       water.admin@sahayasetu.gov.in / password123');
  console.log('  • Roads Admin:       roads.admin@sahayasetu.gov.in / password123');
  console.log('  • Elec Field Worker: elec.field@sahayasetu.gov.in  / password123');
  console.log('  • Water Plumber:     water.field@sahayasetu.gov.in / password123');
  console.log('  • Roads Crew:        roads.field@sahayasetu.gov.in / password123');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { runSeed };

// Master category-to-department configuration and rules

const CATEGORY_MAP = {
  // Electricity Department
  'ELEC-POLE': {
    department: 'electricity',
    label: 'Fallen Electricity Pole',
    label_te: 'కరెంటు స్తంభం కూలింది',
    severity: 4,
    sla_hours: 4,
    emergency: true,
  },
  'ELEC-WIRE': {
    department: 'electricity',
    label: 'Damaged Power Line / Live Wire',
    label_te: 'తెగిన కరెంటు తీగలు',
    severity: 4,
    sla_hours: 2,
    emergency: true,
  },
  'ELEC-TRANSFORMER': {
    department: 'electricity',
    label: 'Transformer Sparking / Failure',
    label_te: 'ట్రాన్స్‌ఫార్మర్ సమస్య',
    severity: 3,
    sla_hours: 8,
    emergency: false,
  },
  'ELEC-STREETLIGHT': {
    department: 'electricity',
    label: 'Streetlight Failure',
    label_te: 'వీధి దీపం వెలగడం లేదు',
    severity: 1,
    sla_hours: 48,
    emergency: false,
  },
  'ELEC': {
    department: 'electricity',
    label: 'General Electricity Issue',
    label_te: 'విద్యుత్ సమస్య',
    severity: 2,
    sla_hours: 12,
    emergency: false,
  },

  // Water Supply Department
  'WATER-LEAK': {
    department: 'water',
    label: 'Water Pipeline Leakage / Burst',
    label_te: 'మంచినీటి పైప్‌లైన్ లీకేజీ',
    severity: 3,
    sla_hours: 12,
    emergency: false,
  },
  'WATER-SUPPLY': {
    department: 'water',
    label: 'Water Supply Interruption',
    label_te: 'నీటి సరఫరా నిలిచిపోయింది',
    severity: 2,
    sla_hours: 24,
    emergency: false,
  },

  // Roads and Infrastructure Department
  'ROAD-POTHOLE': {
    department: 'roads',
    label: 'Damaged Road / Pothole',
    label_te: 'రోడ్డు గుంతలు / పాడైన రోడ్డు',
    severity: 2,
    sla_hours: 72,
    emergency: false,
  },
  'ROAD-BLOCKED': {
    department: 'roads',
    label: 'Blocked Road / Culvert Damage',
    label_te: 'రోడ్డు మూసుకుపోయింది / కల్వర్ట్ సమస్య',
    severity: 3,
    sla_hours: 12,
    emergency: false,
  },
  'ROAD': {
    department: 'roads',
    label: 'General Road Damage',
    label_te: 'రోడ్డు సమస్య',
    severity: 2,
    sla_hours: 48,
    emergency: false,
  },

  // Sanitation & Solid Waste Department
  'GARBAGE-DUMP': {
    department: 'sanitation',
    label: 'Garbage Accumulation',
    label_te: 'చెత్త పేరుకుపోయింది',
    severity: 2,
    sla_hours: 24,
    emergency: false,
  },
  'GARBAGE': {
    department: 'sanitation',
    label: 'Sanitation & Waste Issue',
    label_te: 'పారిశుద్ధ్య సమస్య',
    severity: 2,
    sla_hours: 24,
    emergency: false,
  },

  // Municipal / Horticulture Department
  'TREE-FALLEN': {
    department: 'horticulture',
    label: 'Fallen Tree Blocking Road/Wires',
    label_te: 'కూలిన చెట్టు',
    severity: 3,
    sla_hours: 6,
    emergency: false,
  },
  'TREE': {
    department: 'horticulture',
    label: 'Fallen Tree',
    label_te: 'చెట్టు కూలింది',
    severity: 3,
    sla_hours: 6,
    emergency: false,
  },

  // Drainage & Sewage Department
  'DRAINAGE-OVERFLOW': {
    department: 'drainage',
    label: 'Drainage & Sewage Overflow',
    label_te: 'మురుగు కాలువ పొంగడం',
    severity: 3,
    sla_hours: 12,
    emergency: false,
  },
  'DRAINAGE-BLOCK': {
    department: 'drainage',
    label: 'Clogged Storm Drain',
    label_te: 'పూడిక చేరిన డ్రైనేజీ',
    severity: 2,
    sla_hours: 24,
    emergency: false,
  },

  // Disaster Response & Emergency Infrastructure
  'DISASTER-FLOOD': {
    department: 'emergency',
    label: 'Flooding / Waterlogging',
    label_te: 'వరద నీరు నిల్వ ఉండటం',
    severity: 4,
    sla_hours: 2,
    emergency: true,
  },
  'DISASTER-CYCLONE': {
    department: 'emergency',
    label: 'Cyclone Infrastructure Damage',
    label_te: 'తుఫాను వల్ల ఆస్తి నష్టం',
    severity: 4,
    sla_hours: 2,
    emergency: true,
  },
  'PUBLIC-SAFETY': {
    department: 'emergency',
    label: 'Public Safety Hazard / Collapsing Wall',
    label_te: 'ప్రజా రక్షణ ప్రమాదం / కూలే స్థితిలో ఉన్న గోడ',
    severity: 4,
    sla_hours: 2,
    emergency: true,
  },
  'FLOOD': {
    department: 'emergency',
    label: 'Flood Hazard',
    label_te: 'వరద ప్రమాదం',
    severity: 4,
    sla_hours: 4,
    emergency: true,
  },
  'OTHER': {
    department: 'roads',
    label: 'Other Civic Infrastructure Issue',
    label_te: 'ఇతర పౌర సమస్య',
    severity: 1,
    sla_hours: 48,
    emergency: false,
  },
};

function resolveCategory(cat) {
  if (!cat) return CATEGORY_MAP['OTHER'];
  const key = cat.toUpperCase().trim();
  if (CATEGORY_MAP[key]) return { key, ...CATEGORY_MAP[key] };

  // Fallback prefix search
  if (key.startsWith('ELEC')) return { key, ...CATEGORY_MAP['ELEC'] };
  if (key.startsWith('WATER')) return { key, ...CATEGORY_MAP['WATER-LEAK'] };
  if (key.startsWith('ROAD')) return { key, ...CATEGORY_MAP['ROAD'] };
  if (key.startsWith('GARBAGE')) return { key, ...CATEGORY_MAP['GARBAGE-DUMP'] };
  if (key.startsWith('TREE')) return { key, ...CATEGORY_MAP['TREE'] };
  if (key.startsWith('DRAIN')) return { key, ...CATEGORY_MAP['DRAINAGE-OVERFLOW'] };
  if (key.startsWith('FLOOD')) return { key, ...CATEGORY_MAP['DISASTER-FLOOD'] };

  return { key: 'OTHER', ...CATEGORY_MAP['OTHER'] };
}

module.exports = {
  CATEGORY_MAP,
  resolveCategory,
};

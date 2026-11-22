const DEPARTMENTS = {
  electricity: 'Electricity',
  water: 'Water supply',
  roads: 'Roads & bridges',
  municipal: 'Municipal maintenance',
  health: 'Health (108 / PHC)',
  transport: 'Transport (RTC buses)',
  rescue: 'Rescue (SDRF / Fire)',
};

// code: [department, base severity 1-5, hours allowed before escalation]
const CATEGORIES = {
  ELEC: ['electricity', 3, 12],
  STREETLIGHT: ['municipal', 1, 48],
  WATER_LEAK: ['water', 2, 24],
  NO_WATER: ['water', 2, 24],
  DRAINAGE: ['municipal', 2, 48],
  GARBAGE: ['municipal', 1, 48],
  TREE: ['roads', 2, 24],
  ROAD: ['roads', 2, 24],
  FLOOD: ['rescue', 4, 3],
  HOUSE: ['rescue', 3, 6],
  HEALTH: ['health', 4, 2],
  TRANSPORT: ['transport', 3, 4],
  OTHER: ['rescue', 1, 24],
};

const SOS_TYPES = {
  TRAPPED: 'rescue',
  MEDICAL: 'health',
  FLOODING: 'rescue',
  FIRE: 'rescue',
  OTHER: 'rescue',
};

const SOS_SLA_HOURS = 1;

const KEYWORDS = {
  HEALTH: ['घायल', 'खून', 'बुखार', 'एम्बुलेंस', 'अस्पताल', 'डॉक्टर', 'सांप', 'बेहोश', 'injur', 'bleeding', 'fever', 'ambulance', 'hospital', 'doctor', 'snake', 'unconscious', 'గాయ', 'జ్వరం', 'అంబులెన్స్', 'ఆసుపత్రి', 'డాక్టర్', 'పాము', 'స్పృహ'],
  FLOOD: ['बाढ़', 'घर में पानी', 'डूब', 'flood', 'water entering', 'water inside', 'inundat', 'submerged', 'వరద', 'నీరు', 'నీళ్ళు', 'మునిగ', 'ఇంట్లోకి నీరు'],
  ELEC: ['వైర్లు', 'వైరు', 'बिजली', 'खंभा', 'खम्भा', 'तार', 'ट्रांसफार्मर', 'करंट', 'current', 'electric', 'power', 'pole', 'wire', 'transformer', 'shock', 'కరెంటు', 'కరెంట్', 'విద్యుత్', 'స్తంభం', 'తీగ', 'వైరు', 'ట్రాన్స్‌ఫార్మర్'],
  HOUSE: ['घर गिर', 'दीवार गिर', 'छत', 'झोपड़ी', 'house collapsed', 'wall collapsed', 'roof', 'hut', 'ఇల్లు', 'గోడ', 'పైకప్పు', 'గుడిసె'],
  TRANSPORT: ['फंसे', 'निकाल', 'बस चाहिए', 'need a bus', 'evacuation bus', 'stranded', 'evacuat', 'బస్సు కావాలి', 'చిక్కుకుపోయాం', 'తరలింపు'],
  WATER_LEAK: ['लीक', 'रिसाव', 'पाइप फट', 'पाइपलाइन', 'leak', 'pipe burst', 'pipeline', 'water wast', 'లీక్', 'పైపు', 'పైప్‌లైన్'],
  NO_WATER: ['पानी नहीं आ', 'पानी की सप्लाई', 'पीने का पानी', 'no water', 'water not coming', 'water supply', 'నీళ్ళు రావడం లేదు', 'నీటి సరఫరా', 'మంచినీరు'],
  DRAINAGE: ['नाली', 'सीवर', 'गंदा पानी', 'drain', 'sewage', 'overflow', 'మురుగు', 'కాలువ', 'డ్రైనేజీ'],
  STREETLIGHT: ['स्ट्रीट लाइट', 'स्ट्रीटलाइट', 'बत्ती', 'खंभे की लाइट', 'streetlight', 'street light', 'lamp', 'వీధి దీపం', 'లైటు'],
  GARBAGE: ['कचरा', 'कूड़ा', 'garbage', 'waste', 'dump', 'చెత్త'],
  TREE: ['पेड़', 'डाल', 'टहनी', 'tree', 'branch', 'చెట్టు', 'చెట్లు', 'కొమ్మ'],
  ROAD: ['सड़क', 'गड्ढा', 'पुल', 'पुलिया', 'road', 'bridge', 'culvert', 'pothole', 'రోడ్డు', 'రహదారి', 'వంతెన', 'గుంత'],
};

const VULNERABLE_WORDS = [
  'गर्भवती', 'बुजुर्ग', 'बूढ़', 'बच्च', 'विकलांग', 'फंस',
  'pregnant', 'elderly', 'old man', 'old woman', 'old age', 'child', 'baby', 'infant',
  'disabled', 'wheelchair', 'dialysis', 'bedridden', 'injur', 'trapped',
  'గర్భిణి', 'వృద్ధ', 'ముసలి', 'పిల్ల', 'పసి', 'వికలాంగ', 'గాయ', 'చిక్కుకు'
];

const DANGER_WORDS = [
  'करंट', 'आग', 'डूब', 'बेहोश', 'तार सड़क',
  'live wire', 'shock', 'fire', 'collapsed', 'drowning', 'trapped', 'unconscious', 'bleeding',
  'షాక్', 'మంటలు', 'కూలి', 'మునిగి', 'చిక్కుకు'
];

function categoryInfo(code) {
  const cat = CATEGORIES[code] || CATEGORIES.OTHER;
  const isLife = ['FLOOD', 'HOUSE', 'HEALTH', 'TRANSPORT'].includes(code);
  const isDeferrable = ['STREETLIGHT', 'GARBAGE', 'OTHER'].includes(code);
  return {
    department: cat[0],
    severity: cat[1],
    slaNormal: cat[2],
    slaDisaster: isLife ? Math.max(1, Math.round(cat[2] / 2)) : cat[2],
    kind: isLife ? 'life' : isDeferrable ? 'deferrable' : 'essential',
  };
}

function classifyText(text) {
  const t = (text || '').toLowerCase();
  const catEntries = Object.entries(KEYWORDS);
  const scores = {};
  for (const [cat, words] of catEntries) {
    let count = 0;
    for (const w of words) {
      if (t.includes(w)) count++;
    }
    scores[cat] = count;
  }
  let best = 'OTHER';
  let maxScore = 0;
  for (const [cat] of catEntries) {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      best = cat;
    }
  }

  const vulnerable = VULNERABLE_WORDS.some((w) => t.includes(w));
  const danger = DANGER_WORDS.some((w) => t.includes(w));

  return {
    category: maxScore > 0 ? best : 'OTHER',
    vulnerable,
    severity_boost: danger ? 1 : 0,
  };
}

function slaHours(category, isSos) {
  if (isSos) return SOS_SLA_HOURS;
  return (CATEGORIES[category] || CATEGORIES.OTHER)[2];
}

function slaDue(category, isSos, start) {
  const d = new Date(start);
  d.setHours(d.getHours() + slaHours(category, isSos));
  return d;
}

const ACTIVE_STATUSES = ['received', 'review', 'assigned', 'in_progress', 'escalated'];
const TERMINAL_STATUSES = ['closed', 'rejected', 'merged'];

function isOverdue(incident, now) {
  const n = now ? new Date(now) : new Date();
  return Boolean(
    incident.sla_due_at &&
    ACTIVE_STATUSES.includes(incident.status) &&
    n > new Date(incident.sla_due_at)
  );
}

function priorityScore(incident, now) {
  const n = now ? new Date(now) : new Date();
  let score = (incident.severity || 1) * 10;
  if (incident.is_sos) score += 60;
  if (incident.vulnerable) score += 15;
  score += Math.min(incident.people_count || 0, 20) * 2;
  score += 8 * Math.log2(Math.max(incident.report_count || 1, 1));
  const createdAt = incident.created_at ? new Date(incident.created_at) : n;
  const waitedH = Math.max((n.getTime() - createdAt.getTime()) / 3600000, 0);
  score += Math.min(waitedH, 24);
  if (isOverdue(incident, n)) score += 20;
  score += 10 * (incident.escalation_level || 0);
  return Math.round(score * 10) / 10;
}

module.exports = {
  DEPARTMENTS,
  CATEGORIES,
  SOS_TYPES,
  SOS_SLA_HOURS,
  KEYWORDS,
  VULNERABLE_WORDS,
  DANGER_WORDS,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  classifyText,
  categoryInfo,
  slaHours,
  slaDue,
  isOverdue,
  priorityScore,
};

/* Telugu, Hindi and English text the server speaks back: categories, statuses, safety warnings, status answers. */
const LANGS = ['te-IN', 'hi-IN', 'en-IN'];
const short = (lang) => ({ 'te-IN': 'te', 'hi-IN': 'hi' }[lang] || 'en');

const CATEGORY = {
  en: {
    ELEC: 'Power pole or wires',
    STREETLIGHT: 'Streetlight',
    WATER_LEAK: 'Water pipe leak',
    NO_WATER: 'No water supply',
    DRAINAGE: 'Blocked drain',
    GARBAGE: 'Garbage not collected',
    ROAD: 'Road damage',
    TREE: 'Fallen tree',
    FLOOD: 'Flooding',
    HOUSE: 'House damage',
    HEALTH: 'Medical help',
    TRANSPORT: 'Evacuation needed',
    OTHER: 'Other problem',
    TRAPPED: 'Trapped',
    MEDICAL: 'Medical emergency',
    FLOODING: 'Water in home',
    FIRE: 'Fire',
  },
  te: {
    ELEC: 'కరెంటు స్తంభం / తీగలు',
    STREETLIGHT: 'వీధి దీపం',
    WATER_LEAK: 'నీటి పైపు లీక్',
    NO_WATER: 'నీళ్ళు రావడం లేదు',
    DRAINAGE: 'మురుగు కాలువ',
    GARBAGE: 'చెత్త తీయలేదు',
    ROAD: 'రోడ్డు దెబ్బతింది',
    TREE: 'చెట్టు కూలింది',
    FLOOD: 'వరద నీరు',
    HOUSE: 'ఇల్లు దెబ్బతింది',
    HEALTH: 'వైద్య సహాయం',
    TRANSPORT: 'తరలింపు కావాలి',
    OTHER: 'ఇతర సమస్య',
    TRAPPED: 'చిక్కుకుపోయారు',
    MEDICAL: 'వైద్య అత్యవసరం',
    FLOODING: 'ఇంట్లోకి నీరు',
    FIRE: 'మంటలు',
  },
  hi: {
    ELEC: 'बिजली का खंभा / तार',
    STREETLIGHT: 'स्ट्रीट लाइट',
    WATER_LEAK: 'पानी की पाइप लीक',
    NO_WATER: 'पानी नहीं आ रहा',
    DRAINAGE: 'नाली जाम',
    GARBAGE: 'कचरा नहीं उठा',
    ROAD: 'सड़क खराब',
    TREE: 'पेड़ गिरा',
    FLOOD: 'बाढ़ का पानी',
    HOUSE: 'घर को नुकसान',
    HEALTH: 'चिकित्सा सहायता',
    TRANSPORT: 'निकासी चाहिए',
    OTHER: 'अन्य समस्या',
    TRAPPED: 'फंसे हुए',
    MEDICAL: 'चिकित्सा आपात',
    FLOODING: 'घर में पानी',
    FIRE: 'आग',
  },
};

const STATUS = {
  en: {
    received: 'received',
    review: 'being checked',
    assigned: 'assigned to a worker',
    accepted: 'accepted by the worker',
    in_progress: 'the worker is on the way',
    resolved: 'repaired, waiting for your confirmation',
    closed: 'repaired and verified',
    escalated: 'reopened and sent to a senior officer',
    rejected: 'closed after verification',
    merged: 'combined with another complaint',
  },
  te: {
    received: 'అందింది',
    review: 'పరిశీలనలో ఉంది',
    assigned: 'సిబ్బందికి అప్పగించారు',
    accepted: 'సిబ్బంది స్వీకరించారు',
    in_progress: 'సిబ్బంది దారిలో ఉన్నారు',
    resolved: 'మరమ్మతు పూర్తయిందన్నారు, మీ నిర్ధారణ కోసం వేచి ఉంది',
    closed: 'మరమ్మతు ధృవీకరించి మూసివేశారు',
    escalated: 'మళ్ళీ తెరిచి ఉన్నతాధికారికి పంపారు',
    rejected: 'పరిశీలన తర్వాత మూసివేశారు',
    merged: 'మరో ఫిర్యాదుతో కలిపారు',
  },
  hi: {
    received: 'प्राप्त हुई',
    review: 'जांच हो रही है',
    assigned: 'कर्मचारी को सौंपी गई',
    accepted: 'कर्मचारी ने स्वीकार की',
    in_progress: 'कर्मचारी रास्ते में हैं',
    resolved: 'मरम्मत हो गई, आपकी पुष्टि का इंतज़ार है',
    closed: 'मरम्मत सत्यापित, शिकायत बंद',
    escalated: 'दोबारा खोली गई और वरिष्ठ अधिकारी को भेजी गई',
    rejected: 'जांच के बाद बंद',
    merged: 'दूसरी शिकायत के साथ जोड़ी गई',
  },
};

const SAFETY = {
  ELEC: {
    en: 'Do not go near the fallen wires. Stay at a safe distance and call 112 if anyone is in danger.',
    te: 'పడిపోయిన తీగల దగ్గరికి వెళ్ళవద్దు. దూరంగా ఉండండి. ఎవరికైనా ప్రమాదం ఉంటే 112 కి కాల్ చేయండి.',
    hi: 'गिरे हुए तारों के पास न जाएं। सुरक्षित दूरी पर रहें। किसी को खतरा हो तो 112 पर कॉल करें。',
  },
  STREETLIGHT: {
    en: 'If the pole has exposed wires, do not touch it.',
    te: 'స్తంభానికి తీగలు బయటకు ఉంటే తాకవద్దు.',
    hi: 'अगर खंभे के तार खुले हैं तो उसे न छुएं।',
  },
  TREE: {
    en: 'Keep away from the fallen tree, especially if it is touching power lines.',
    te: 'కూలిన చెట్టుకు దూరంగా ఉండండి, ముఖ్యంగా అది కరెంటు తీగలను తాకుతుంటే.',
    hi: 'गिरे हुए पेड़ से दूर रहें, खासकर अगर वह बिजली के तारों को छू रहा हो।',
  },
  FLOOD: {
    en: 'Move to higher ground. If water is entering, switch off the main power. Call 112 if anyone is trapped.',
    te: 'ఎత్తైన చోటికి వెళ్ళండి. నీరు ఇంట్లోకి వస్తుంటే మెయిన్ స్విచ్ ఆపండి. ఎవరైనా చిక్కుకుంటే 112 కి కాల్ చేయండి.',
    hi: 'ऊंची जगह पर जाएं। पानी घर में आ रहा हो तो मेन स्विच बंद करें। कोई फंसा हो तो 112 पर कॉल करें।',
  },
  HOUSE: {
    en: 'Keep everyone away from the damaged building.',
    te: 'దెబ్బతిన్న ఇంటి దగ్గర ఎవరినీ ఉండనివ్వకండి.',
    hi: 'क्षतिग्रस्त इमारत से सबको दूर रखें।',
  },
  HEALTH: {
    en: 'If someone is seriously hurt, call 108 or 112 now.',
    te: 'ఎవరికైనా తీవ్ర గాయమైతే వెంటనే 108 లేదా 112 కి కాల్ చేయండి.',
    hi: 'अगर कोई गंभीर रूप से घायल है, तो अभी 108 या 112 पर कॉल करें।',
  },
  DRAINAGE: {
    en: 'Avoid contact with the dirty water.',
    te: 'మురుగు నీటిని తాకవద్దు.',
    hi: 'गंदे पानी के संपर्क से बचें।',
  },
  ROAD: {
    en: 'Warn others and avoid the damaged section, especially at night.',
    te: 'దెబ్బతిన్న చోటు గురించి ఇతరులను హెచ్చరించండి, ముఖ్యంగా రాత్రి.',
    hi: 'दूसरों को सावधान करें और खराब हिस्से से बचें, खासकर रात में।',
  },
};

const ANSWERS = {
  en: {
    none: 'You have no complaints registered with this phone number.',
    one: 'Complaint {code}, {cat}: {status}.',
    worker: ' {name} is handling it.',
    many: 'You have {n} complaints. Which one do you mean? Say or tap the ticket number.',
    notFound: 'I could not find complaint {code} among your complaints.',
    pendingNone: 'You have no pending complaints.',
    pendingMany: 'You have {n} pending complaints: {list}. Which one do you mean?',
  },
  te: {
    none: 'ఈ ఫోన్ నంబర్‌తో మీ ఫిర్యాదులు ఏవీ లేవు.',
    one: 'ఫిర్యాదు {code}, {cat}: {status}.',
    worker: ' {name} పని చేస్తున్నారు.',
    many: 'మీకు {n} ఫిర్యాదులు ఉన్నాయి. ఏది? టికెట్ నంబర్ చెప్పండి లేదా నొక్కండి.',
    notFound: 'మీ ఫిర్యాదులలో {code} దొరకలేదు.',
    pendingNone: 'మీ ఫిర్యాదులు ఏవీ పెండింగ్‌లో లేవు.',
    pendingMany: 'మీకు {n} పెండింగ్ ఫిర్యాదులు ఉన్నాయి: {list}. ఏది?',
  },
  hi: {
    none: 'इस फ़ोन नंबर से आपकी कोई शिकायत दर्ज नहीं है।',
    one: 'शिकायत {code}, {cat}: {status}।',
    worker: ' {name} इस पर काम कर रहे हैं।',
    many: 'आपकी {n} शिकायतें हैं। कौन सी? टिकट नंबर बोलें या चुनें।',
    notFound: 'आपकी शिकायतों में {code} नहीं मिली।',
    pendingNone: 'आपकी कोई लंबित शिकायत नहीं है।',
    pendingMany: 'आपकी {n} लंबित शिकायतें हैं: {list}। कौन सी?',
  },
};

const fill = (tpl, vars) => (tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? vars[k] : ''));

module.exports = { LANGS, short, CATEGORY, STATUS, SAFETY, ANSWERS, fill };

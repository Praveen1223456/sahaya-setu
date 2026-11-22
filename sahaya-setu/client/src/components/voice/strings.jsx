import React from 'react';

/* Text for the voice screens in Telugu, Hindi and English. Shown in the chosen language, with English underneath. */
export const LANGS = [
  { code: 'te-IN', short: 'te', name: 'తెలుగు', en: 'Telugu' },
  { code: 'hi-IN', short: 'hi', name: 'हिन्दी', en: 'Hindi' },
  { code: 'en-IN', short: 'en', name: 'English', en: 'English' },
];

export const VS = {
  title_report: { te: 'గొంతుతో సమస్య తెలపండి', hi: 'आवाज़ से समस्या बताएं', en: 'Report an issue using voice' },
  title_status: { te: 'నా ఫిర్యాదు స్థితి', hi: 'मेरी शिकायत की स्थिति', en: 'Check my complaint status' },
  choose_lang: { te: 'మీ భాషను ఎంచుకోండి.', hi: 'अपनी भाषा चुनें।', en: 'Please select your preferred language.' },
  describe: { te: 'ఇప్పుడు మీ సమస్యను చెప్పండి.', hi: 'अब अपनी समस्या बताइए।', en: 'You can now describe your problem.' },
  recognized: { te: 'మీ ఫిర్యాదు గుర్తించబడింది.', hi: 'आपकी शिकायत पहचान ली गई है।', en: 'Your complaint has been recognized.' },
  confirm: { te: 'దయచేసి మీ ఫిర్యాదు వివరాలను నిర్ధారించండి.', hi: 'कृपया अपनी शिकायत का विवरण जांचें और पुष्टि करें।', en: 'Please confirm your complaint details.' },
  submitted: { te: 'మీ ఫిర్యాదు విజయవంతంగా పంపబడింది.', hi: 'आपकी शिकायत सफलतापूर्वक दर्ज हो गई है।', en: 'Your complaint has been submitted successfully.' },
  tap_mic: { te: 'మైక్ నొక్కి మాట్లాడండి', hi: 'माइक दबाकर बोलें', en: 'Tap the microphone and speak' },
  listening: { te: 'వింటున్నాం', hi: 'सुन रहे हैं', en: 'Listening' },
  asking_permission: { te: 'మైక్రోఫోన్ అనుమతి అడుగుతోంది…', hi: 'माइक्रोफ़ोन की अनुमति मांग रहे हैं…', en: 'Asking for microphone permission…' },
  stop: { te: 'ఆపండి', hi: 'रोकें', en: 'Stop' },
  retry: { te: 'మళ్ళీ చెప్పండి', hi: 'फिर से बोलें', en: 'Record again' },
  clear: { te: 'తొలగించండి', hi: 'मिटाएं', en: 'Clear' },
  heard: { te: 'మీరు చెప్పింది', hi: 'आपने कहा', en: 'What we heard' },
  edit_hint: { te: 'తప్పులు ఉంటే ఇక్కడ సరిచేయండి లేదా టైప్ చేయండి', hi: 'गलती हो तो यहां सुधारें या टाइप करें', en: 'Correct any mistakes here, or type' },
  analyze: { te: 'తనిఖీ చేయండి', hi: 'जांचें', en: 'Check my complaint' },
  analyzing: { te: 'తనిఖీ చేస్తోంది…', hi: 'जांच हो रही है…', en: 'Checking…' },
  err_denied: { te: 'మైక్రోఫోన్ అనుమతి ఇవ్వలేదు. బ్రౌజర్ సెట్టింగ్‌లలో అనుమతి ఇవ్వండి లేదా టైప్ చేయండి.', hi: 'माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग में अनुमति दें या टाइप करें।', en: 'Microphone permission was denied. Allow it in your browser settings, or type your complaint.' },
  err_nospeech: { te: 'మాట వినిపించలేదు. మళ్ళీ ప్రయత్నించండి.', hi: 'कोई आवाज़ सुनाई नहीं दी। फिर से कोशिश करें।', en: 'No speech was detected. Please try again.' },
  err_unsupported: { te: 'ఈ బ్రౌజర్‌లో మాట గుర్తింపు లేదు.', hi: 'इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है।', en: 'Speech recognition is not available in this browser.' },
  err_network: { te: 'నెట్‌వర్క్ సమస్య. మాట గుర్తింపుకు ఇంటర్నెట్ కావాలి. మళ్ళీ ప్రయత్నించండి లేదా టైప్ చేయండి.', hi: 'नेटवर्क समस्या। आवाज़ पहचान के लिए इंटरनेट चाहिए। फिर से कोशिश करें या टाइप करें।', en: 'Network problem. Speech recognition needs internet. Try again, or type.' },
  err_nomic: { te: 'మైక్రోఫోన్ కనబడలేదు.', hi: 'माइक्रोफ़ोन नहीं मिला।', en: 'No microphone was found.' },
  err_lang: { te: 'ఈ బ్రౌజర్ ఈ భాషను గుర్తించలేదు. వేరే భాష ఎంచుకోండి లేదా టైప్ చేయండి.', hi: 'यह ब्राउज़र इस भाषा को नहीं पहचानता। दूसरी भाषा चुनें या टाइप करें।', en: "This browser can't recognise this language. Choose another, or type." },
  err_failed: { te: 'మాట గుర్తింపు విఫలమైంది. మళ్ళీ ప్రయత్నించండి లేదా టైప్ చేయండి.', hi: 'आवाज़ पहचान विफल रही। फिर से कोशिश करें या टाइप करें।', en: 'Speech recognition failed. Try again, or type.' },
  type_instead: { te: 'క్రింద టైప్ చేయవచ్చు.', hi: 'आप नीचे टाइप कर सकते हैं।', en: 'You can type below instead.' },
  server_record: { te: 'రికార్డ్ చేసి సర్వర్‌తో టెక్స్ట్‌గా మార్చండి', hi: 'रिकॉर्ड करके सर्वर से टेक्स्ट बनवाएं', en: 'Record and convert on our server' },
  consent_audio: { te: 'నా రికార్డింగ్‌ను టెక్స్ట్‌గా మార్చడానికి సర్వర్‌కు పంపడానికి అంగీకరిస్తున్నాను. అది నిల్వ చేయబడదు.', hi: 'मैं अपनी रिकॉर्डिंग को टेक्स्ट में बदलने के लिए सर्वर पर भेजने की अनुमति देता/देती हूं। इसे सेव नहीं किया जाएगा।', en: 'I agree to send my recording to the server to turn it into text. It is not stored.' },
  recording: { te: 'రికార్డ్ అవుతోంది', hi: 'रिकॉर्डिंग हो रही है', en: 'Recording' },
  transcribing: { te: 'టెక్స్ట్‌గా మారుస్తోంది…', hi: 'टेक्स्ट में बदल रहे हैं…', en: 'Converting to text…' },
  category: { te: 'వర్గం', hi: 'श्रेणी', en: 'Category' },
  choose_category: { te: 'మేము ఖచ్చితంగా గుర్తించలేకపోయాం. దయచేసి వర్గాన్ని ఎంచుకోండి.', hi: 'हम पक्का पहचान नहीं पाए। कृपया श्रेणी चुनें।', en: 'We are not sure. Please choose the category.' },
  department: { te: 'శాఖ', hi: 'विभाग', en: 'Department' },
  severity: { te: 'తీవ్రత', hi: 'गंभीरता', en: 'Severity' },
  priority: { te: 'ప్రాధాన్యత', hi: 'प्राथमिकता', en: 'Priority' },
  title_f: { te: 'శీర్షిక', hi: 'शीर्षक', en: 'Title' },
  description_f: { te: 'వివరణ', hi: 'विवरण', en: 'Description' },
  safety: { te: 'భద్రత', hi: 'सुरक्षा', en: 'Safety' },
  suggested_by: { te: 'సూచించినది: {s}', hi: 'सुझाव: {s}', en: 'Suggested by {s}' },
  you_mentioned: { te: 'మీరు చెప్పిన ప్రదేశం: {p}. ఇది మీ GPS స్థానం కాదు; సమస్య అక్కడ ఉంటే మ్యాప్‌పై ఆ చోట నొక్కండి.', hi: 'आपने बताई जगह: {p}। यह आपकी GPS जगह नहीं है; समस्या वहां है तो नक्शे पर उस जगह टैप करें।', en: 'You mentioned: {p}. This is not your GPS location; if the problem is there, tap that spot on the map.' },
  location: { te: 'స్థానం', hi: 'स्थान', en: 'Location' },
  get_location: { te: 'నా స్థానం తీసుకోండి', hi: 'मेरा स्थान लें', en: 'Use my location' },
  getting_location: { te: 'స్థానం కనుగొంటోంది…', hi: 'स्थान खोज रहे हैं…', en: 'Finding your location…' },
  gps_denied: { te: 'స్థాన అనుమతి లేదు. మ్యాప్‌పై నొక్కి స్థలాన్ని ఎంచుకోండి, లేదా ల్యాండ్‌మార్క్ రాయండి.', hi: 'स्थान की अनुमति नहीं मिली। नक्शे पर टैप करके जगह चुनें, या लैंडमार्क लिखें।', en: 'Location permission was denied. Tap the map to choose the place, or write a landmark.' },
  move_pin: { te: 'సమస్య వేరే చోట ఉంటే మ్యాప్‌పై నొక్కండి.', hi: 'समस्या कहीं और हो तो नक्शे पर टैप करें।', en: 'If the problem is somewhere else, tap the map.' },
  pin_moved: { te: 'మీరు పిన్ జరిపారు', hi: 'आपने पिन खिसकाया', en: 'You moved the pin' },
  landmark: { te: 'ల్యాండ్‌మార్క్ / ఇంటి నంబర్', hi: 'लैंडमार्क / मकान नंबर', en: 'Landmark or house number' },
  photo_optional: { te: 'ఫోటో (ఐచ్ఛికం)', hi: 'फ़ोटो (वैकल्पिक)', en: 'Photo (optional)' },
  submit: { te: 'ఫిర్యాదు పంపండి', hi: 'शिकायत भेजें', en: 'Submit complaint' },
  submitting: { te: 'పంపుతోంది…', hi: 'भेज रहे हैं…', en: 'Submitting…' },
  need_location: { te: 'స్థానం లేదా ల్యాండ్‌మార్క్ ఇవ్వండి.', hi: 'स्थान या लैंडमार्क दें।', en: 'Give a location or a landmark.' },
  duplicate: { te: 'ఈ సమస్యను ఇప్పటికే ఇతరులు తెలిపారు. మీ ఫిర్యాదు అదే టికెట్‌కు జోడించబడింది.', hi: 'यह समस्या पहले ही दर्ज है। आपकी शिकायत उसी टिकट में जोड़ी गई है।', en: 'This problem was already reported. Your complaint was added to the same ticket.' },
  err_submit: { te: 'పంపలేకపోయాం: {e}. మీ వివరాలు అలాగే ఉన్నాయి.', hi: 'भेज नहीं पाए: {e}। आपका विवरण सुरक्षित है।', en: 'Could not submit: {e}. Your details are kept.' },
  err_analyze: { te: 'తనిఖీ కాలేదు. మీ మాటలు అలాగే ఉన్నాయి. మళ్ళీ ప్రయత్నించండి లేదా వర్గాన్ని మీరే ఎంచుకోండి.', hi: 'जांच नहीं हो पाई। आपकी बात सुरक्षित है। फिर से कोशिश करें या श्रेणी खुद चुनें।', en: 'The check failed. Your words are kept. Try again, or choose the category yourself.' },
  mute: { te: 'శబ్దం ఆపు', hi: 'आवाज़ बंद', en: 'Mute' },
  unmute: { te: 'శబ్దం ఆన్', hi: 'आवाज़ चालू', en: 'Unmute' },
  no_voice: { te: 'ఈ పరికరంలో ఈ భాష గొంతు లేదు; సూచనలను ఇక్కడ చదవండి.', hi: 'इस डिवाइस में इस भाषा की आवाज़ नहीं है; निर्देश यहां पढ़ें।', en: 'No voice for this language on this device; read the instructions here.' },
  sign_in: { te: 'ఫోన్ నంబర్‌తో సైన్ ఇన్ చేయండి', hi: 'फ़ोन नंबर से साइन इन करें', en: 'Sign in with your phone number' },
  signin_why: { te: 'మీ ఫిర్యాదులు మీకు మాత్రమే కనిపించేలా సైన్ ఇన్ అవసరం.', hi: 'आपकी शिकायतें सिर्फ़ आपको दिखें, इसलिए साइन इन ज़रूरी है।', en: 'Signing in makes sure only you can see your complaints.' },
  phone: { te: 'ఫోన్ నంబర్', hi: 'फ़ोन नंबर', en: 'Phone number' },
  send_code: { te: 'కోడ్ పంపండి', hi: 'कोड भेजें', en: 'Send code' },
  enter_code: { te: 'SMS లో వచ్చిన 6 అంకెల కోడ్', hi: 'SMS में आया 6 अंकों का कोड', en: '6-digit code from the SMS' },
  verify: { te: 'సైన్ ఇన్', hi: 'साइन इन', en: 'Sign in' },
  signed_in_as: { te: '{p} తో సైన్ ఇన్ అయ్యారు', hi: '{p} से साइन इन', en: 'Signed in as {p}' },
  sign_out: { te: 'సైన్ అవుట్', hi: 'साइन आउट', en: 'Sign out' },
  ask_status: { te: 'మీ ప్రశ్న అడగండి, ఉదా. “నా ఫిర్యాదు స్థితి ఏమిటి?”', hi: 'अपना सवाल पूछें, जैसे “मेरी शिकायत की स्थिति क्या है?”', en: 'Ask your question, e.g. “What is the status of my complaint?”' },
  ask: { te: 'అడగండి', hi: 'पूछें', en: 'Ask' },
  pick_one: { te: 'ఏ ఫిర్యాదు?', hi: 'कौन सी शिकायत?', en: 'Which complaint?' },
  new_complaint: { te: 'కొత్త ఫిర్యాదు', hi: 'नई शिकायत', en: 'New complaint' },
  view_ticket: { te: 'ఫిర్యాదు చూడండి', hi: 'शिकायत देखें', en: 'View complaint' },
  offline_needed: { te: 'గొంతు ఫిర్యాదుకు ఇంటర్నెట్ కావాలి. నెట్ లేకపోతే ఫోటో ఫిర్యాదు లేదా SMS వాడండి.', hi: 'आवाज़ शिकायत के लिए इंटरनेट चाहिए। नेट न हो तो फ़ोटो शिकायत या SMS का उपयोग करें।', en: 'Voice complaints need internet. Without network, use the photo report or SMS.' },
  back: { te: 'వెనక్కి', hi: 'वापस', en: 'Back' },
  LOW: { te: 'తక్కువ', hi: 'कम', en: 'Low' },
  MEDIUM: { te: 'మధ్యస్థం', hi: 'मध्यम', en: 'Medium' },
  HIGH: { te: 'ఎక్కువ', hi: 'अधिक', en: 'High' },
  CRITICAL: { te: 'అత్యవసరం', hi: 'गंभीर', en: 'Critical' },
};

export const CAT = {
  ELEC: { te: 'కరెంటు స్తంభం / తీగలు', hi: 'बिजली का खंभा / तार', en: 'Power pole or wires' },
  STREETLIGHT: { te: 'వీధి దీపం', hi: 'स्ट्रीट लाइट', en: 'Streetlight' },
  WATER_LEAK: { te: 'నీటి పైపు లీక్', hi: 'पानी की पाइप लीक', en: 'Water pipe leak' },
  NO_WATER: { te: 'నీళ్ళు రావడం లేదు', hi: 'पानी नहीं आ रहा', en: 'No water supply' },
  DRAINAGE: { te: 'మురుగు కాలువ', hi: 'नाली जाम', en: 'Blocked drain' },
  GARBAGE: { te: 'చెత్త తీయలేదు', hi: 'कचरा नहीं उठा', en: 'Garbage not collected' },
  ROAD: { te: 'రోడ్డు దెబ్బతింది', hi: 'सड़क खराब', en: 'Road damage' },
  TREE: { te: 'చెట్టు కూలింది', hi: 'पेड़ गिरा', en: 'Fallen tree' },
  FLOOD: { te: 'వరద నీరు', hi: 'बाढ़ का पानी', en: 'Flooding' },
  HOUSE: { te: 'ఇల్లు దెబ్బతింది', hi: 'घर को नुकसान', en: 'House damage' },
  HEALTH: { te: 'వైద్య సహాయం', hi: 'चिकित्सा सहायता', en: 'Medical help' },
  TRANSPORT: { te: 'తరలింపు కావాలి', hi: 'निकासी चाहिए', en: 'Evacuation needed' },
  OTHER: { te: 'ఇతర', hi: 'अन्य', en: 'Other' },
};

export function makeVT(lang) {
  const s = LANGS.find((l) => l.code === lang)?.short || 'en';
  const vt = (key, vars = {}, l = s) => {
    let text = (VS[key] || CAT[key] || {})[l] || (VS[key] || CAT[key] || {}).en || key;
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, v);
    }
    return text;
  };
  function VBi({ k, vars }) {
    if (s === 'en') return <span className="bi"><span>{vt(k, vars)}</span></span>;
    return (
      <span className="bi">
        <span>{vt(k, vars)}</span>
        <span lang="en" style={{ display: 'block', fontSize: '0.85em', opacity: 0.8 }}>
          {vt(k, vars, 'en')}
        </span>
      </span>
    );
  }
  return { vt, VBi, short: s };
}

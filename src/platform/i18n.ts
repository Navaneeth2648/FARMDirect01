import type { Language } from '../types';

/**
 * Platform UI strings. Navigation and common actions are translated; longer
 * advisory content is authored per language in the CMS and safety-critical
 * text goes through expert review (machine translation is not used).
 * Missing keys fall back to English.
 */
const en = {
  home: 'Home', myFarm: 'My Farm', weather: 'Weather', cropDoctor: 'Crop Doctor', advisory: 'Crop Advisory', assistant: 'Medha AI',
  mandi: 'Mandi Prices', calendar: 'Crop Calendar', operations: 'Farm Operations', soilWater: 'Soil & Water', satellite: 'Satellite',
  alerts: 'Pest & Weather Alerts', products: 'Agri Products', verify: 'Verify Product', schemes: 'Govt Schemes', knowledge: 'Knowledge Centre',
  news: 'News & Events', experts: 'Experts & Services', community: 'Community', notifications: 'Notifications', saved: 'Saved',
  settings: 'Profile & Settings', admin: 'Admin Console', expertDesk: 'Expert Desk', marketplace: 'Marketplace', logout: 'Sign out',
  signIn: 'Sign in', register: 'Create account', save: 'Save', cancel: 'Cancel', delete: 'Delete', add: 'Add', edit: 'Edit', search: 'Search',
  loading: 'Loading…', retry: 'Try again', back: 'Back', next: 'Next', skip: 'Skip for now', submit: 'Submit', close: 'Close',
  quickActions: 'Quick actions', addCrop: 'Add crop', checkWeather: 'Check weather', uploadPhoto: 'Diagnose crop', comparePrices: 'Compare prices', askQuestion: 'Ask a question',
  listen: 'Listen', stop: 'Stop', speak: 'Speak', textSize: 'Text size', highContrast: 'High contrast', language: 'Language',
  lastUpdated: 'Last updated', source: 'Source', notConfigured: 'Not configured yet', offline: 'You are offline. Saved pages are shown where available.',
  more: 'More', menu: 'Menu',
  sell: 'Sell Produce', storage: 'Storage', market: 'Market', trade: 'Orders & Payments', account: 'Account', help: 'Help',
  buyerHome: 'Buyer Home', myRequirements: 'My Requirements', verification: 'Verification', providerDesk: 'Storage Provider',
  transportDesk: 'Transport Provider', sellMyCrop: 'Sell my crop', findBuyer: 'Find a buyer', bookStorage: 'Book nearby storage',
  trackProduce: 'Track my produce', paymentStatus: 'Payment status', getHelp: 'Get help', iAmFarmer: 'I am a Farmer',
  iAmBuyer: 'I am a Buyer', administrator: 'Administrator', sendCode: 'Send code', resendIn: 'Resend code in', resend: 'Resend code',
  mobileNumber: 'Mobile number', enterCode: 'Enter the 6-digit code',
  fieldGuide: 'Crop & Pest Guide', cropStats: 'Crop Statistics', businesses: 'Buyers & Businesses', inputs: 'Buy Farm Inputs',
  grading: 'Quality Grading', learningCentre: 'Learning Centre',
};
type Dict = typeof en;

const hi: Partial<Dict> = {
  home: 'होम', myFarm: 'मेरा खेत', weather: 'मौसम', cropDoctor: 'फसल डॉक्टर', advisory: 'फसल सलाह', assistant: 'मेधा AI (Medha AI)', fieldGuide: 'फसल व कीट गाइड', cropStats: 'फसल आँकड़े', businesses: 'खरीदार व व्यवसाय', inputs: 'कृषि सामग्री खरीदें', grading: 'गुणवत्ता ग्रेडिंग', learningCentre: 'सीखने का केंद्र',
  mandi: 'मंडी भाव', calendar: 'फसल कैलेंडर', operations: 'खेती कार्य', soilWater: 'मिट्टी और पानी', satellite: 'उपग्रह',
  alerts: 'कीट व मौसम चेतावनी', products: 'कृषि उत्पाद', verify: 'उत्पाद सत्यापन', schemes: 'सरकारी योजनाएं', knowledge: 'ज्ञान केंद्र',
  news: 'समाचार और कार्यक्रम', experts: 'विशेषज्ञ और सेवाएं', community: 'समुदाय', notifications: 'सूचनाएं', saved: 'सहेजे गए',
  settings: 'प्रोफ़ाइल और सेटिंग्स', admin: 'एडमिन कंसोल', expertDesk: 'विशेषज्ञ डेस्क', marketplace: 'बाज़ार', logout: 'साइन आउट',
  signIn: 'साइन इन', register: 'खाता बनाएं', save: 'सहेजें', cancel: 'रद्द करें', delete: 'हटाएं', add: 'जोड़ें', edit: 'बदलें', search: 'खोजें',
  loading: 'लोड हो रहा है…', retry: 'फिर से कोशिश करें', back: 'वापस', next: 'आगे', skip: 'अभी छोड़ें', submit: 'जमा करें', close: 'बंद करें',
  quickActions: 'त्वरित कार्य', addCrop: 'फसल जोड़ें', checkWeather: 'मौसम देखें', uploadPhoto: 'फसल जांचें', comparePrices: 'भाव तुलना', askQuestion: 'सवाल पूछें',
  listen: 'सुनें', stop: 'रोकें', speak: 'बोलें', textSize: 'अक्षर आकार', highContrast: 'हाई कंट्रास्ट', language: 'भाषा',
  lastUpdated: 'अंतिम अपडेट', source: 'स्रोत', notConfigured: 'अभी सेट नहीं है', offline: 'आप ऑफ़लाइन हैं।', more: 'और', menu: 'मेनू',
  sell: 'उपज बेचें', storage: 'भंडारण', market: 'बाज़ार', trade: 'ऑर्डर और भुगतान', account: 'खाता', help: 'मदद',
  buyerHome: 'खरीदार होम', myRequirements: 'मेरी ज़रूरतें', verification: 'सत्यापन', providerDesk: 'भंडारण प्रदाता',
  transportDesk: 'परिवहन प्रदाता', sellMyCrop: 'मेरी फसल बेचें', findBuyer: 'खरीदार खोजें', bookStorage: 'पास का भंडारण बुक करें',
  trackProduce: 'मेरी उपज ट्रैक करें', paymentStatus: 'भुगतान की स्थिति', getHelp: 'मदद लें', iAmFarmer: 'मैं किसान हूँ',
  iAmBuyer: 'मैं खरीदार हूँ', administrator: 'प्रशासक', sendCode: 'कोड भेजें', resendIn: 'कोड दोबारा भेजें', resend: 'कोड दोबारा भेजें',
  mobileNumber: 'मोबाइल नंबर', enterCode: '6 अंकों का कोड दर्ज करें',
};
const te: Partial<Dict> = {
  home: 'హోమ్', myFarm: 'నా పొలం', weather: 'వాతావరణం', cropDoctor: 'పంట డాక్టర్', advisory: 'పంట సలహా', assistant: 'మేధ AI (Medha AI)', fieldGuide: 'పంట  పురుగుల గైడ్', cropStats: 'పంట గణాంకాలు', businesses: 'కొనుగోలుదారులు  వ్యాపారాలు', inputs: 'వ్యవసాయ సామగ్రి కొనండి', grading: 'నాణ్యత గ్రేడింగ్', learningCentre: 'నేర్చుకునే కేంద్రం',
  mandi: 'మార్కెట్ ధరలు', calendar: 'పంట క్యాలెండర్', operations: 'వ్యవసాయ పనులు', soilWater: 'నేల & నీరు', satellite: 'ఉపగ్రహం',
  alerts: 'తెగులు & వాతావరణ హెచ్చరికలు', products: 'వ్యవసాయ ఉత్పత్తులు', verify: 'ఉత్పత్తి ధృవీకరణ', schemes: 'ప్రభుత్వ పథకాలు', knowledge: 'జ్ఞాన కేంద్రం',
  news: 'వార్తలు & కార్యక్రమాలు', experts: 'నిపుణులు & సేవలు', community: 'సమాజం', notifications: 'నోటిఫికేషన్లు', saved: 'సేవ్ చేసినవి',
  settings: 'ప్రొఫైల్ & సెట్టింగ్‌లు', admin: 'అడ్మిన్ కన్సోల్', expertDesk: 'నిపుణుల డెస్క్', marketplace: 'మార్కెట్‌ప్లేస్', logout: 'సైన్ అవుట్',
  signIn: 'సైన్ ఇన్', register: 'ఖాతా సృష్టించండి', save: 'సేవ్', cancel: 'రద్దు', delete: 'తొలగించు', add: 'జోడించు', edit: 'మార్చు', search: 'వెతకండి',
  loading: 'లోడ్ అవుతోంది…', retry: 'మళ్ళీ ప్రయత్నించండి', back: 'వెనుకకు', next: 'తదుపరి', skip: 'ఇప్పుడు వదిలేయండి', submit: 'సమర్పించు', close: 'మూసివేయి',
  quickActions: 'త్వరిత చర్యలు', addCrop: 'పంట జోడించు', checkWeather: 'వాతావరణం చూడండి', uploadPhoto: 'పంట పరీక్ష', comparePrices: 'ధరల పోలిక', askQuestion: 'ప్రశ్న అడగండి',
  listen: 'వినండి', stop: 'ఆపు', speak: 'మాట్లాడండి', textSize: 'అక్షర పరిమాణం', highContrast: 'హై కాంట్రాస్ట్', language: 'భాష',
  lastUpdated: 'చివరి నవీకరణ', source: 'మూలం', notConfigured: 'ఇంకా సెట్ చేయలేదు', offline: 'మీరు ఆఫ్‌లైన్‌లో ఉన్నారు.', more: 'మరిన్ని', menu: 'మెనూ',
  sell: 'పంట అమ్మండి', storage: 'నిల్వ', market: 'మార్కెట్', trade: 'ఆర్డర్లు & చెల్లింపులు', account: 'ఖాతా', help: 'సహాయం',
  buyerHome: 'కొనుగోలుదారు హోమ్', myRequirements: 'నా అవసరాలు', verification: 'ధృవీకరణ', providerDesk: 'నిల్వ ప్రదాత',
  transportDesk: 'రవాణా ప్రదాత', sellMyCrop: 'నా పంట అమ్మండి', findBuyer: 'కొనుగోలుదారుని కనుగొనండి', bookStorage: 'దగ్గరి నిల్వ బుక్ చేయండి',
  trackProduce: 'నా పంటను ట్రాక్ చేయండి', paymentStatus: 'చెల్లింపు స్థితి', getHelp: 'సహాయం పొందండి', iAmFarmer: 'నేను రైతును',
  iAmBuyer: 'నేను కొనుగోలుదారుని', administrator: 'నిర్వాహకుడు', sendCode: 'కోడ్ పంపండి', resendIn: 'కోడ్ మళ్ళీ పంపడానికి', resend: 'కోడ్ మళ్ళీ పంపండి',
  mobileNumber: 'మొబైల్ నంబర్', enterCode: '6 అంకెల కోడ్ నమోదు చేయండి',
};
const ml: Partial<Dict> = {
  home: 'ഹോം', myFarm: 'എന്റെ കൃഷിയിടം', weather: 'കാലാവസ്ഥ', cropDoctor: 'വിള ഡോക്ടർ', advisory: 'വിള ഉപദേശം', assistant: 'മേധ AI (Medha AI)', fieldGuide: 'വിള  കീട ഗൈഡ്', cropStats: 'വിള സ്ഥിതിവിവരം', businesses: 'വാങ്ങുന്നവർ  ബിസിനസുകൾ', inputs: 'കൃഷി സാമഗ്രികൾ വാങ്ങുക', grading: 'ഗുണനിലവാര ഗ്രേഡിംഗ്', learningCentre: 'പഠന കേന്ദ്രം',
  mandi: 'ചന്ത വില', calendar: 'വിള കലണ്ടർ', operations: 'കൃഷിപ്പണികൾ', soilWater: 'മണ്ണും വെള്ളവും', satellite: 'ഉപഗ്രഹം',
  alerts: 'കീട, കാലാവസ്ഥ മുന്നറിയിപ്പ്', products: 'കാർഷിക ഉൽപ്പന്നങ്ങൾ', verify: 'ഉൽപ്പന്ന പരിശോധന', schemes: 'സർക്കാർ പദ്ധതികൾ', knowledge: 'വിജ്ഞാന കേന്ദ്രം',
  news: 'വാർത്തകളും പരിപാടികളും', experts: 'വിദഗ്ധരും സേവനങ്ങളും', community: 'കൂട്ടായ്മ', notifications: 'അറിയിപ്പുകൾ', saved: 'സേവ് ചെയ്തവ',
  settings: 'പ്രൊഫൈലും ക്രമീകരണങ്ങളും', admin: 'അഡ്മിൻ', expertDesk: 'വിദഗ്ധ ഡെസ്ക്', marketplace: 'മാർക്കറ്റ്പ്ലേസ്', logout: 'സൈൻ ഔട്ട്',
  signIn: 'സൈൻ ഇൻ', register: 'അക്കൗണ്ട് സൃഷ്ടിക്കുക', save: 'സേവ്', cancel: 'റദ്ദാക്കുക', delete: 'ഇല്ലാതാക്കുക', add: 'ചേർക്കുക', edit: 'തിരുത്തുക', search: 'തിരയുക',
  loading: 'ലോഡ് ചെയ്യുന്നു…', retry: 'വീണ്ടും ശ്രമിക്കുക', back: 'തിരികെ', next: 'അടുത്തത്', skip: 'ഇപ്പോൾ ഒഴിവാക്കുക', submit: 'സമർപ്പിക്കുക', close: 'അടയ്ക്കുക',
  quickActions: 'പെട്ടെന്നുള്ള പ്രവർത്തനങ്ങൾ', addCrop: 'വിള ചേർക്കുക', checkWeather: 'കാലാവസ്ഥ നോക്കുക', uploadPhoto: 'വിള പരിശോധന', comparePrices: 'വില താരതമ്യം', askQuestion: 'ചോദ്യം ചോദിക്കുക',
  listen: 'കേൾക്കുക', stop: 'നിർത്തുക', speak: 'സംസാരിക്കുക', textSize: 'അക്ഷര വലുപ്പം', highContrast: 'ഹൈ കോൺട്രാസ്റ്റ്', language: 'ഭാഷ',
  lastUpdated: 'അവസാന അപ്ഡേറ്റ്', source: 'ഉറവിടം', notConfigured: 'ഇതുവരെ സജ്ജമാക്കിയിട്ടില്ല', offline: 'നിങ്ങൾ ഓഫ്‌ലൈനാണ്.', more: 'കൂടുതൽ', menu: 'മെനു',
  sell: 'വിള വിൽക്കുക', storage: 'സംഭരണം', market: 'മാർക്കറ്റ്', trade: 'ഓർഡറുകളും പേയ്മെന്റുകളും', account: 'അക്കൗണ്ട്', help: 'സഹായം',
  buyerHome: 'വാങ്ങുന്നയാൾ ഹോം', myRequirements: 'എന്റെ ആവശ്യങ്ങൾ', verification: 'പരിശോധന', providerDesk: 'സംഭരണ ദാതാവ്',
  transportDesk: 'ഗതാഗത ദാതാവ്', sellMyCrop: 'എന്റെ വിള വിൽക്കുക', findBuyer: 'വാങ്ങുന്നയാളെ കണ്ടെത്തുക', bookStorage: 'അടുത്തുള്ള സംഭരണം ബുക്ക് ചെയ്യുക',
  trackProduce: 'എന്റെ വിള ട്രാക്ക് ചെയ്യുക', paymentStatus: 'പേയ്മെന്റ് നില', getHelp: 'സഹായം നേടുക', iAmFarmer: 'ഞാൻ കർഷകനാണ്',
  iAmBuyer: 'ഞാൻ വാങ്ങുന്നയാളാണ്', administrator: 'അഡ്മിനിസ്ട്രേറ്റർ', sendCode: 'കോഡ് അയയ്ക്കുക', resendIn: 'കോഡ് വീണ്ടും അയയ്ക്കാൻ', resend: 'കോഡ് വീണ്ടും അയയ്ക്കുക',
  mobileNumber: 'മൊബൈൽ നമ്പർ', enterCode: '6 അക്ക കോഡ് നൽകുക',
};

const dicts: Record<Language, Partial<Dict>> = { en, hi, te, ml };
export type TKey = keyof Dict;
export const translate = (lang: Language, key: TKey) => dicts[lang]?.[key] ?? en[key];

export const LANGUAGES: { code: Language; label: string; speech: string }[] = [
  { code: 'en', label: 'English', speech: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', speech: 'hi-IN' },
  { code: 'te', label: 'తెలుగు', speech: 'te-IN' },
  { code: 'ml', label: 'മലയാളം', speech: 'ml-IN' },
];

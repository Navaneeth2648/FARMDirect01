import { q, type Row } from '../db/index.ts';
import { notify, type Kind } from './notify.ts';

/**
 * Short, plain-language notification templates in each supported language.
 * Messages avoid sensitive details (no amounts owed to named people, no phone
 * numbers) so they are safe on lock screens and SMS.
 */
type Lang = 'en' | 'hi' | 'te' | 'ml';
type Tpl = Record<Lang, [title: string, body: string]>;

const T: Record<string, Tpl> = {
  offer_received: {
    en: ['New offer for your crop', 'A buyer sent an offer for {commodity}. Open to accept, reject or counter.'],
    hi: ['आपकी फसल के लिए नया प्रस्ताव', '{commodity} के लिए खरीदार ने प्रस्ताव भेजा है। स्वीकार, अस्वीकार या जवाबी प्रस्ताव दें।'],
    te: ['మీ పంటకు కొత్త ఆఫర్', '{commodity} కోసం కొనుగోలుదారు ఆఫర్ పంపారు. అంగీకరించండి, తిరస్కరించండి లేదా ప్రతి ఆఫర్ ఇవ్వండి.'],
    ml: ['നിങ്ങളുടെ വിളയ്ക്ക് പുതിയ ഓഫർ', '{commodity} നായി വാങ്ങുന്നയാൾ ഓഫർ അയച്ചു. സ്വീകരിക്കുക, നിരസിക്കുക അല്ലെങ്കിൽ മറുഓഫർ നൽകുക.'],
  },
  offer_countered: {
    en: ['Counter-offer received', 'There is a new counter-offer for {commodity}.'],
    hi: ['जवाबी प्रस्ताव मिला', '{commodity} के लिए नया जवाबी प्रस्ताव है।'],
    te: ['ప్రతి ఆఫర్ వచ్చింది', '{commodity} కోసం కొత్త ప్రతి ఆఫర్ ఉంది.'],
    ml: ['മറുഓഫർ ലഭിച്ചു', '{commodity} നായി പുതിയ മറുഓഫർ ഉണ്ട്.'],
  },
  offer_accepted: {
    en: ['Offer accepted', 'Your offer for {commodity} was accepted. Please review and confirm the order.'],
    hi: ['प्रस्ताव स्वीकार', '{commodity} का आपका प्रस्ताव स्वीकार हुआ। कृपया ऑर्डर देखें और पुष्टि करें।'],
    te: ['ఆఫర్ అంగీకరించబడింది', '{commodity} కోసం మీ ఆఫర్ అంగీకరించబడింది. దయచేసి ఆర్డర్ చూసి నిర్ధారించండి.'],
    ml: ['ഓഫർ സ്വീകരിച്ചു', '{commodity} നുള്ള നിങ്ങളുടെ ഓഫർ സ്വീകരിച്ചു. ഓർഡർ പരിശോധിച്ച് സ്ഥിരീകരിക്കുക.'],
  },
  offer_rejected: {
    en: ['Offer declined', 'Your offer for {commodity} was declined.'],
    hi: ['प्रस्ताव अस्वीकार', '{commodity} का आपका प्रस्ताव अस्वीकार हुआ।'],
    te: ['ఆఫర్ తిరస్కరించబడింది', '{commodity} కోసం మీ ఆఫర్ తిరస్కరించబడింది.'],
    ml: ['ഓഫർ നിരസിച്ചു', '{commodity} നുള്ള നിങ്ങളുടെ ഓഫർ നിരസിച്ചു.'],
  },
  order_confirmed: {
    en: ['Order confirmed', 'Order {ref} is confirmed by both sides. Arrange pickup or delivery.'],
    hi: ['ऑर्डर पक्का', 'ऑर्डर {ref} की दोनों पक्षों ने पुष्टि की। पिकअप या डिलीवरी तय करें।'],
    te: ['ఆర్డర్ నిర్ధారించబడింది', 'ఆర్డర్ {ref} ఇరువురూ నిర్ధారించారు. పికప్ లేదా డెలివరీ ఏర్పాటు చేయండి.'],
    ml: ['ഓർഡർ സ്ഥിരീകരിച്ചു', 'ഓർഡർ {ref} ഇരു കക്ഷികളും സ്ഥിരീകരിച്ചു. പിക്കപ്പ് അല്ലെങ്കിൽ ഡെലിവറി ക്രമീകരിക്കുക.'],
  },
  order_update: {
    en: ['Order update', 'Order {ref}: {status}.'],
    hi: ['ऑर्डर अपडेट', 'ऑर्डर {ref}: {status}।'],
    te: ['ఆర్డర్ అప్‌డేట్', 'ఆర్డర్ {ref}: {status}.'],
    ml: ['ഓർഡർ അപ്ഡേറ്റ്', 'ഓർഡർ {ref}: {status}.'],
  },
  listing_expired: {
    en: ['Listing expired', 'Your {commodity} listing has expired. You can publish it again.'],
    hi: ['लिस्टिंग समाप्त', 'आपकी {commodity} लिस्टिंग समाप्त हो गई। आप इसे फिर से प्रकाशित कर सकते हैं।'],
    te: ['జాబితా గడువు ముగిసింది', 'మీ {commodity} జాబితా గడువు ముగిసింది. మళ్ళీ ప్రచురించవచ్చు.'],
    ml: ['ലിസ്റ്റിംഗ് കാലഹരണപ്പെട്ടു', 'നിങ്ങളുടെ {commodity} ലിസ്റ്റിംഗ് കാലഹരണപ്പെട്ടു. വീണ്ടും പ്രസിദ്ധീകരിക്കാം.'],
  },
  booking_update: {
    en: ['Storage booking update', 'Booking {ref}: {status}.'],
    hi: ['भंडारण बुकिंग अपडेट', 'बुकिंग {ref}: {status}।'],
    te: ['నిల్వ బుకింగ్ అప్‌డేట్', 'బుకింగ్ {ref}: {status}.'],
    ml: ['സംഭരണ ബുക്കിംഗ് അപ്ഡേറ്റ്', 'ബുക്കിംഗ് {ref}: {status}.'],
  },
  storage_expiry: {
    en: ['Storage period ending soon', 'Booking {ref} ends on {date}. Request release or extend in time.'],
    hi: ['भंडारण अवधि जल्द खत्म', 'बुकिंग {ref} {date} को खत्म होगी। समय पर रिलीज़ या बढ़ाने का अनुरोध करें।'],
    te: ['నిల్వ గడువు త్వరలో ముగుస్తుంది', 'బుకింగ్ {ref} {date}న ముగుస్తుంది. సమయానికి విడుదల లేదా పొడిగింపు కోరండి.'],
    ml: ['സംഭരണ കാലാവധി ഉടൻ അവസാനിക്കും', 'ബുക്കിംഗ് {ref} {date} ന് അവസാനിക്കും. സമയത്ത് റിലീസ് അല്ലെങ്കിൽ നീട്ടൽ അഭ്യർത്ഥിക്കുക.'],
  },
  payment_update: {
    en: ['Payment update', 'Payment {ref}: {status}.'],
    hi: ['भुगतान अपडेट', 'भुगतान {ref}: {status}।'],
    te: ['చెల్లింపు అప్‌డేట్', 'చెల్లింపు {ref}: {status}.'],
    ml: ['പേയ്മെന്റ് അപ്ഡേറ്റ്', 'പേയ്മെന്റ് {ref}: {status}.'],
  },
  transport_update: {
    en: ['Transport update', 'Your transport request: {status}.'],
    hi: ['परिवहन अपडेट', 'आपका परिवहन अनुरोध: {status}।'],
    te: ['రవాణా అప్‌డేట్', 'మీ రవాణా అభ్యర్థన: {status}.'],
    ml: ['ഗതാഗത അപ്ഡേറ്റ്', 'നിങ്ങളുടെ ഗതാഗത അഭ്യർത്ഥന: {status}.'],
  },
  dispute_update: {
    en: ['Dispute update', 'Case {ref}: {status}.'],
    hi: ['विवाद अपडेट', 'मामला {ref}: {status}।'],
    te: ['వివాదం అప్‌డేట్', 'కేసు {ref}: {status}.'],
    ml: ['തർക്ക അപ്ഡേറ്റ്', 'കേസ് {ref}: {status}.'],
  },
  verification_update: {
    en: ['Verification update', 'Your verification: {status}. Open your account for next steps.'],
    hi: ['सत्यापन अपडेट', 'आपका सत्यापन: {status}। अगले कदम के लिए खाता खोलें।'],
    te: ['ధృవీకరణ అప్‌డేట్', 'మీ ధృవీకరణ: {status}. తదుపరి దశల కోసం ఖాతా తెరవండి.'],
    ml: ['പരിശോധന അപ്ഡേറ്റ്', 'നിങ്ങളുടെ പരിശോധന: {status}. അടുത്ത ഘട്ടങ്ങൾക്ക് അക്കൗണ്ട് തുറക്കുക.'],
  },
  security_warning: {
    en: ['Account security notice', '{status}. If this was not you, change your password now.'],
    hi: ['खाता सुरक्षा सूचना', '{status}। अगर यह आप नहीं थे, तो अभी पासवर्ड बदलें।'],
    te: ['ఖాతా భద్రతా సూచన', '{status}. ఇది మీరు కాకపోతే, ఇప్పుడే పాస్‌వర్డ్ మార్చండి.'],
    ml: ['അക്കൗണ്ട് സുരക്ഷാ അറിയിപ്പ്', '{status}. ഇത് നിങ്ങളല്ലെങ്കിൽ ഉടൻ പാസ്‌വേഡ് മാറ്റുക.'],
  },
};

const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ''));

export function notifyT(userId: string | null | undefined, kind: Kind, key: keyof typeof T, params: Record<string, string | number>, dedupeKey: string, link?: string) {
  if (!userId) return null;
  const lang = (q.get<Row>('SELECT language FROM users WHERE id = ?', userId)?.language || 'en') as Lang;
  const tpl = T[key][lang] || T[key].en;
  return notify(userId, kind, fill(tpl[0], params), fill(tpl[1], params), dedupeKey, link);
}

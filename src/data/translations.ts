import { Language } from '../types';

// Translations for English, Malayalam, Hindi, and Telugu
export const welcomeTranslations: Record<Language, {
  appTitle: string;
  subtitle: string;
  farmerLogin: string;
  buyerLogin: string;
  aadharNumber: string;
  verifyAadhar: string;
  aadharVerified: string;
  aadharPlaceholder: string;
  enterOTP: string;
  otpSentToAadhar: string;
  login: string;
  or: string;
  back: string;
  verifying: string;
  invalidAadhar: string;
  switchLang: string;
}> = {
  en: {
    appTitle: "FARMDirect",
    subtitle: "Connect Farmers & Buyers",
    farmerLogin: "Farmer Login",
    buyerLogin: "Buyer Login",
    aadharNumber: "Aadhar Number",
    verifyAadhar: "Verify Aadhar",
    aadharVerified: "Aadhar Verified ✓",
    aadharPlaceholder: "Enter your 12-digit Aadhar number",
    enterOTP: "Enter OTP",
    otpSentToAadhar: "OTP sent to registered mobile number",
    login: "Login",
    or: "OR",
    back: "Back",
    verifying: "Verifying...",
    invalidAadhar: "Invalid Aadhar number",
    switchLang: "English",
  },
  ml: {
    appTitle: "FARMDirect",
    subtitle: "കർഷകരും വാങ്ങുന്നവരും തമ്മിൽ ബന്ധിപ്പിക്കുക",
    farmerLogin: "കർഷക ലോഗിൻ",
    buyerLogin: "വാങ്ങുന്നവരുടെ ലോഗിൻ",
    aadharNumber: "ആധാർ നമ്പർ",
    verifyAadhar: "ആധാർ പരിശോധിക്കുക",
    aadharVerified: "ആധാർ പരിശോധിച്ചു ✓",
    aadharPlaceholder: "നിങ്ങളുടെ 12-അക്ക ആധാർ നമ്പർ നൽകുക",
    enterOTP: "OTP നൽകുക",
    otpSentToAadhar: "രജിസ്റ്റർ ചെയ്ത മൊബൈൽ നമ്പറിലേക്ക് OTP അയച്ചു",
    login: "ലോഗിൻ",
    or: "അല്ലെങ്കിൽ",
    back: "തിരിച്ചുപോകുക",
    verifying: "പരിശോധിക്കുന്നു...",
    invalidAadhar: "അസാധുവായ ആധാർ നമ്പർ",
    switchLang: "മലയാളം",
  },
  hi: {
    appTitle: "FARMDirect",
    subtitle: "किसानों और खरीदारों को सीधे जोड़ें",
    farmerLogin: "किसान लॉगिन",
    buyerLogin: "खरीदार लॉगिन",
    aadharNumber: "आधार नंबर",
    verifyAadhar: "आधार सत्यापित करें",
    aadharVerified: "आधार सत्यापित ✓",
    aadharPlaceholder: "अपना 12 अंकों का आधार नंबर दर्ज करें",
    enterOTP: "ओटीपी (OTP) दर्ज करें",
    otpSentToAadhar: "पंजीकृत मोबाइल नंबर पर ओटीपी भेजा गया",
    login: "लॉगिन करें",
    or: "या",
    back: "पीछे",
    verifying: "सत्यापित किया जा रहा है...",
    invalidAadhar: "अमान्य आधार नंबर",
    switchLang: "हिन्दी",
  },
  te: {
    appTitle: "FARMDirect",
    subtitle: "రైతులు & కొనుగోలుదారులను నేరుగా కలపండి",
    farmerLogin: "రైతు లాగిన్",
    buyerLogin: "కొనుగోలుదారు లాగిన్",
    aadharNumber: "ఆధార్ సంఖ్య",
    verifyAadhar: "ఆధార్ ధృవీకరించండి",
    aadharVerified: "ఆధార్ ధృవీకరించబడింది ✓",
    aadharPlaceholder: "మీ 12 అంకెల ఆధార్ సంఖ్యను నమోదు చేయండి",
    enterOTP: "OTP నమోదు చేయండి",
    otpSentToAadhar: "నమోదిత మొబైల్ నంబరుకు OTP పంపబడింది",
    login: "లాగిన్",
    or: "లేదా",
    back: "వెనుకకు",
    verifying: "ధృవీకరిస్తోంది...",
    invalidAadhar: "చెల్లని ఆధార్ సంఖ్య",
    switchLang: "తెలుగు",
  },
};

export interface TutorialStep {
  title: string;
  description: string;
  icon: string;
  tips: string[];
}

export interface FeatureItem {
  icon: string;
  title: string;
  desc: string;
}

export const onboardingTranslations: Record<Language, {
  welcome: string;
  subtitle: string;
  skip: string;
  next: string;
  previous: string;
  getStarted: string;
  complete: string;
  steps: {
    farmer: TutorialStep[];
    buyer: TutorialStep[];
  };
  features: {
    title: string;
    items: FeatureItem[];
  };
}> = {
  en: {
    welcome: "Welcome to Direct Market Access",
    subtitle: "Your gateway to transparent farming trade",
    skip: "Skip Tutorial",
    next: "Next",
    previous: "Previous",
    getStarted: "Get Started",
    complete: "Complete Tutorial",
    steps: {
      farmer: [
        {
          title: "Welcome, Farmer!",
          description: "Connect directly with buyers and eliminate middlemen to get fair prices for your produce.",
          icon: "Users",
          tips: [
            "No commission fees",
            "Direct buyer contact",
            "Fair pricing guaranteed",
          ],
        },
        {
          title: "Add Your Produce",
          description: "List your crops with photos, quantities, and prices. Our system helps you set competitive rates.",
          icon: "Store",
          tips: [
            "Easy photo upload",
            "Government price comparison",
            "Negotiable pricing options",
          ],
        },
        {
          title: "Chat with Buyers",
          description: "Communicate directly with interested buyers, negotiate prices, and finalize deals.",
          icon: "MessageCircle",
          tips: [
            "Real-time messaging",
            "Voice messages",
            "Offer negotiations",
          ],
        },
        {
          title: "Secure Payments",
          description: "All payments are processed securely through our escrow system for your protection.",
          icon: "Shield",
          tips: [
            "Escrow protection",
            "Aadhar verification",
            "Payment guarantee",
          ],
        },
        {
          title: "Track Delivery",
          description: "Monitor your shipments and get paid once delivery is confirmed by the buyer.",
          icon: "Truck",
          tips: [
            "Delivery tracking",
            "Instant payments",
            "Buyer ratings",
          ],
        },
      ],
      buyer: [
        {
          title: "Welcome, Buyer!",
          description: "Access fresh produce directly from farmers with transparent pricing and quality assurance.",
          icon: "Store",
          tips: [
            "Fresh from farm",
            "Transparent pricing",
            "Quality guaranteed",
          ],
        },
        {
          title: "Browse Marketplace",
          description: "Search and filter through available produce, compare prices with government rates.",
          icon: "TrendingUp",
          tips: [
            "Search & filter",
            "Price comparison",
            "Quality ratings",
          ],
        },
        {
          title: "Connect with Farmers",
          description: "Chat directly with farmers, ask questions, and negotiate the best deals.",
          icon: "MessageCircle",
          tips: [
            "Direct communication",
            "Photo sharing",
            "Price negotiation",
          ],
        },
        {
          title: "Secure Transactions",
          description: "Make payments safely through our escrow system with Aadhar verification.",
          icon: "Shield",
          tips: [
            "Secure payments",
            "Buyer protection",
            "Verified farmers",
          ],
        },
        {
          title: "Rate & Review",
          description: "Share your experience and help build a trusted farming community.",
          icon: "Star",
          tips: [
            "Rate farmers",
            "Write reviews",
            "Build trust",
          ],
        },
      ],
    },
    features: {
      title: "Key Features",
      items: [
        {
          icon: "Smartphone",
          title: "Easy to Use",
          desc: "Simple interface designed for everyone",
        },
        {
          icon: "IndianRupee",
          title: "Fair Pricing",
          desc: "No middleman commissions",
        },
        {
          icon: "MessageCircle",
          title: "Direct Chat",
          desc: "WhatsApp-like messaging",
        },
        {
          icon: "Shield",
          title: "Secure",
          desc: "Protected transactions",
        },
      ],
    },
  },
  ml: {
    welcome: "ഡയറക്ട് മാർക്കറ്റ് ആക്സസിലേക്ക് സ്വാഗതം",
    subtitle: "സുതാര്യമായ കാർഷിക വ്യാപാരത്തിലേക്കുള്ള നിങ്ങളുടെ കവാടം",
    skip: "ട്യൂട്ടോറിയൽ ഒഴിവാക്കുക",
    next: "അടുത്തത്",
    previous: "മുമ്പത്തേത്",
    getStarted: "ആരംഭിക്കുക",
    complete: "ട്യൂട്ടോറിയൽ പൂർത്തിയാക്കുക",
    steps: {
      farmer: [
        {
          title: "സ്വാഗതം, കർഷകരേ!",
          description: "വാങ്ങുന്നവരുമായി നേരിട്ട് ബന്ധപ്പെടുകയും ഇടനിലക്കാരെ ഒഴിവാക്കി നിങ്ങളുടെ ഉൽപ്പന്നങ്ങൾക്ക് ന്യായമായ വില ലഭിക്കുകയും ചെയ്യുക.",
          icon: "Users",
          tips: [
            "കമ്മീഷൻ ഫീസ് ഇല്ല",
            "നേരിട്ടുള്ള ബയർ കോൺടാക്റ്റ്",
            "ന്യായമായ വില ഉറപ്പ്",
          ],
        },
        {
          title: "നിങ്ങളുടെ ഉൽപ്പന്നങ്ങൾ ചേർക്കുക",
          description: "ഫോട്ടോകൾ, അളവുകൾ, വിലകൾ എന്നിവയുമായി നിങ്ങളുടെ വിളകൾ ലിസ്റ്റ് ചെയ്യുക. മത്സരാധിഷ്ഠിത നിരക്കുകൾ സജ്ജീകരിക്കാൻ ഞങ്ങളുടെ സിസ്റ്റം സഹായിക്കുന്നു.",
          icon: "Store",
          tips: [
            "എളുപ്പമുള്ള ഫോട്ടോ അപ്‌ലോഡ്",
            "സർക്കാർ വില താരതമ്യം",
            "ചർച്ചയ്ക്കുള്ള വില ഓപ്ഷനുകൾ",
          ],
        },
        {
          title: "വാങ്ങുന്നവരുമായി ചാറ്റ് ചെയ്യുക",
          description: "താൽപ്പര്യമുള്ള വാങ്ങുന്നവരുമായി നേരിട്ട് ആശയവിനിമയം നടത്തുക, വിലകൾ ചർച്ച ചെയ്യുക, കരാറുകൾ അന്തിമമാക്കുക.",
          icon: "MessageCircle",
          tips: [
            "തത്സമയ സന്ദേശം",
            "വോയ്സ് സന്ദേശങ്ങൾ",
            "ഓഫർ ചർച്ചകൾ",
          ],
        },
        {
          title: "സുരക്ഷിത പേയ്മെന്റുകൾ",
          description: "നിങ്ങളുടെ സംരക്ഷണത്തിനായി എല്ലാ പേയ്മെന്റുകളും ഞങ്ങളുടെ എസ്ക്രോ സിസ്റ്റത്തിലൂടെ സുരക്ഷിതമായി പ്രോസസ്സ് ചെയ്യുന്നു.",
          icon: "Shield",
          tips: [
            "എസ്ക്രോ സംരക്ഷണം",
            "ആധാർ പരിശോധന",
            "പേയ്മെന്റ് ഗ്യാരന്റി",
          ],
        },
        {
          title: "ഡെലിവറി ട്രാക്ക് ചെയ്യുക",
          description: "നിങ്ങളുടെ ഷിപ്പ്മെന്റുകൾ നിരീക്ഷിക്കുകയും വാങ്ങുന്നയാൾ ഡെലിവറി സ്ഥിരീകരിച്ചാൽ പണം ലഭിക്കുകയും ചെയ്യുക.",
          icon: "Truck",
          tips: [
            "ഡെലിവറി ട്രാക്കിംഗ്",
            "തൽക്ഷണ പേയ്മെന്റുകൾ",
            "വാങ്ങുന്നയാളുടെ റേറ്റിംഗുകൾ",
          ],
        },
      ],
      buyer: [
        {
          title: "സ്വാഗതം, വാങ്ങുന്നവരേ!",
          description: "സുതാര്യമായ വിലനിർണ്ണയവും ഗുണനിലവാര ഉറപ്പും സഹിതം കർഷകരിൽ നിന്ന് നേരിട്ട് പുതിയ ഉൽപ്പന്നങ്ങൾ ആക്സസ് ചെയ്യുക.",
          icon: "Store",
          tips: [
            "കൃഷിയിടത്തിൽ നിന്ന് പുതിയത്",
            "സുതാര്യമായ വിലനിർണ്ണയം",
            "ഗുണനിലവാരം ഉറപ്പുനൽകുന്നു",
          ],
        },
        {
          title: "മാർക്കറ്റ്പ്ലേസ് ബ്രൗസ് ചെയ്യുക",
          description: "ലഭ്യമായ ഉൽപ്പന്നങ്ങൾ തിരയുകയും ഫിൽട്ടർ ചെയ്യുകയും ചെയ്യുക, സർക്കാർ നിരക്കുകളുമായി വില താരതമ്യം ചെയ്യുക.",
          icon: "TrendingUp",
          tips: [
            "തിരയലും ഫിൽട്ടറും",
            "വില താരതമ്യം",
            "ഗുണനിലവാര റേറ്റിംഗുകൾ",
          ],
        },
        {
          title: "കർഷകരുമായി ബന്ധപ്പെടുക",
          description: "കർഷകരുമായി നേരിട്ട് ചാറ്റ് ചെയ്യുക, ചോദ്യങ്ങൾ ചോദിക്കുക, മികച്ച ഇടപാടുകൾ ചർച്ച ചെയ്യുക.",
          icon: "MessageCircle",
          tips: [
            "നേരിട്ടുള്ള ആശയവിനിമയം",
            "ഫോട്ടോ പങ്കിടൽ",
            "വില ചർച്ച",
          ],
        },
        {
          title: "സുരക്ഷിത ഇടപാടുകൾ",
          description: "ആധാർ പരിശോധനയോടെ ഞങ്ങളുടെ എസ്ക്രോ സിസ്റ്റം വഴി സുരക്ഷിതമായി പേയ്മെന്റുകൾ നടത്തുക.",
          icon: "Shield",
          tips: [
            "സുരക്ഷിത പേയ്മെന്റുകൾ",
            "വാങ്ങുന്നയാളുടെ സംരക്ഷണം",
            "പരിശോധിച്ച കർഷകർ",
          ],
        },
        {
          title: "റേറ്റുചെയ്യുകയും അവലോകനം ചെയ്യുകയും ചെയ്യുക",
          description: "നിങ്ങളുടെ അനുഭവം പങ്കിടുകയും വിശ്വസനീയമായ ഒരു കാർഷിക സമൂഹം കെട്ടിപ്പടുക്കാൻ സഹായിക്കുകയും ചെയ്യുക.",
          icon: "Star",
          tips: [
            "കർഷകരെ റേറ്റ് ചെയ്യുക",
            "അവലോകനങ്ങൾ എഴുതുക",
            "വിശ്വാസം കെട്ടിപ്പടുക്കുക",
          ],
        },
      ],
    },
    features: {
      title: "പ്രധാന സവിശേഷതകൾ",
      items: [
        {
          icon: "Smartphone",
          title: "ഉപയോഗിക്കാൻ എളുപ്പം",
          desc: "എല്ലാവർക്കുമായി രൂപകൽപ്പന ചെയ്ത ലളിതമായ ഇന്റർഫേസ്",
        },
        {
          icon: "IndianRupee",
          title: "ന്യായമായ വിലനിർണ്ണയം",
          desc: "ഇടനിലക്കാരുടെ കമ്മീഷൻ ഇല്ല",
        },
        {
          icon: "MessageCircle",
          title: "നേരിട്ടുള്ള ചാറ്റ്",
          desc: "വാട്ട്സ്ആപ്പ് പോലുള്ള സന്ദേശം",
        },
        {
          icon: "Shield",
          title: "സുരക്ഷിതം",
          desc: "സംരക്ഷിത ഇടപാടുകൾ",
        },
      ],
    },
  },
  hi: {
    welcome: "डायरेक्ट मार्केट एक्सेस में आपका स्वागत है",
    subtitle: "पारदर्शी कृषि व्यापार के लिए आपका विश्वसनीय मंच",
    skip: "ट्यूटोरियल छोड़ें",
    next: "आगे बढ़ें",
    previous: "पिछला",
    getStarted: "शुरू करें",
    complete: "ट्यूटोरियल पूरा करें",
    steps: {
      farmer: [
        {
          title: "स्वागत है, किसान साथी!",
          description: "बिचौलियों को हटाकर सीधे खरीदारों से जुड़ें और अपनी उपज का सही व उचित दाम पाएं।",
          icon: "Users",
          tips: [
            "कोई कमीशन शुल्क नहीं",
            "सीधा खरीदार संपर्क",
            "उचित मूल्य की गारंटी",
          ],
        },
        {
          title: "अपनी उपज जोड़ें",
          description: "तस्वीरों, मात्रा और मूल्य के साथ अपनी फसलें सूचीबद्ध करें। हमारा सिस्टम आपको सही दर तय करने में मदद करता है।",
          icon: "Store",
          tips: [
            "आसान फोटो अपलोड",
            "सरकारी मंडी मूल्य तुलना",
            "मोलभाव के विकल्प",
          ],
        },
        {
          title: "खरीदारों से सीधे चैट करें",
          description: "इच्छुक खरीदारों से सीधे बातचीत करें, कीमतों पर चर्चा करें और सौदे पक्के करें।",
          icon: "MessageCircle",
          tips: [
            "रियल-टाइम मैसेजिंग",
            "वॉयस मैसेज की सुविधा",
            "ऑफ़र मोलभाव",
          ],
        },
        {
          title: "सुरक्षित भुगतान (एस्क्रो)",
          description: "आपकी पूरी सुरक्षा के लिए सभी भुगतान हमारे एस्क्रो सिस्टम के माध्यम से सुरक्षित रखे जाते हैं।",
          icon: "Shield",
          tips: [
            "एस्क्रो सुरक्षा",
            "आधार सत्यापन",
            "भुगतान गारंटी",
          ],
        },
        {
          title: "डिलीवरी ट्रैक करें",
          description: "अपने माल के प्रेषण की निगरानी करें और खरीदार द्वारा पुष्टि करते ही तुरंत भुगतान प्राप्त करें।",
          icon: "Truck",
          tips: [
            "डिलीवरी ट्रैकिंग",
            "तुरंत भुगतान निकासी",
            "खरीदार रेटिंग्स",
          ],
        },
      ],
      buyer: [
        {
          title: "स्वागत है, खरीदार साथी!",
          description: "पारदर्शी मूल्य निर्धारण और उच्च गुणवत्ता के साथ सीधे किसानों से ताज़ा उपज प्राप्त करें।",
          icon: "Store",
          tips: [
            "सीधे खेत से ताज़ा",
            "पारदर्शी मूल्य",
            "गुणवत्ता की गारंटी",
          ],
        },
        {
          title: "मार्केटप्लेस देखें",
          description: "उपलब्ध फसलों को खोजें और फ़िल्टर करें, सरकारी मंडी दरों के साथ मूल्यों की तुलना करें।",
          icon: "TrendingUp",
          tips: [
            "खोज और फ़िल्टर",
            "मूल्य तुलना",
            "गुणवत्ता रेटिंग्स",
          ],
        },
        {
          title: "किसानों से जुड़ें",
          description: "किसानों से सीधे चैट करें, गुणवत्ता की जांच करें और सर्वोत्तम दर पर सौदा तय करें।",
          icon: "MessageCircle",
          tips: [
            "सीधा संवाद",
            "फोटो साझा करना",
            "मूल्य वार्ता",
          ],
        },
        {
          title: "सुरक्षित लेनदेन",
          description: "आधार सत्यापित किसानों के साथ सुरक्षित एस्क्रो प्रणाली के माध्यम से सुरक्षित भुगतान करें।",
          icon: "Shield",
          tips: [
            "सुरक्षित भुगतान",
            "खरीदार सुरक्षा",
            "सत्यापित किसान",
          ],
        },
        {
          title: "रेटिंग और समीक्षा दें",
          description: "अपना अनुभव साझा करें और एक विश्वसनीय कृषि समुदाय के निर्माण में सहायता करें।",
          icon: "Star",
          tips: [
            "किसानों को रेटिंग दें",
            "समीक्षा लिखें",
            "विश्वास बनाएं",
          ],
        },
      ],
    },
    features: {
      title: "प्रमुख विशेषताएँ",
      items: [
        {
          icon: "Smartphone",
          title: "उपयोग में आसान",
          desc: "सभी के लिए तैयार सरल और सहज इंटरफ़ेस",
        },
        {
          icon: "IndianRupee",
          title: "उचित मूल्य",
          desc: "बिचौलियों का कोई कमीशन नहीं",
        },
        {
          icon: "MessageCircle",
          title: "सीधी चैट",
          desc: "व्हाट्सएप जैसी आसान मैसेजिंग",
        },
        {
          icon: "Shield",
          title: "पूर्णतः सुरक्षित",
          desc: "एस्क्रो संरक्षित सुरक्षित लेनदेन",
        },
      ],
    },
  },
  te: {
    welcome: "డైరెక్ట్ మార్కెట్ యాక్సెస్‌కు స్వాగతం",
    subtitle: "పారదర్శక వ్యవసాయ వాణిజ్యానికి మీ విశ్వసనీయ వేదిక",
    skip: "ట్యుటోరియల్ దాటవేయి",
    next: "తరువాత",
    previous: "మునుపటిది",
    getStarted: "ప్రారంభించండి",
    complete: "ట్యుటోరియల్ పూర్తి చేయండి",
    steps: {
      farmer: [
        {
          title: "స్వాగతం, రైతు మిత్రమా!",
          description: "దళారులను తొలగించి నేరుగా కొనుగోలుదారులతో కనెక్ట్ అవ్వండి మరియు మీ పంటకు సరైన ధర పొందండి.",
          icon: "Users",
          tips: [
            "కమిషన్ ఫీజులు లేవు",
            "కొనుగోలుదారుడితో ప్రత్యక్ష సంబంధం",
            "సరసమైన ధర హామీ",
          ],
        },
        {
          title: "మీ పంటను జాబితా చేయండి",
          description: "ఫోటోలు, పరిమాణం మరియు ధరలతో మీ పంట వివరాలను నమోదు చేయండి. సరైన ధర నిర్ణయించడానికి సహాయం అందుతుంది.",
          icon: "Store",
          tips: [
            "సులభమైన ఫోటో అప్‌లోడ్",
            "ప్రభుత్వ మార్కెట్ ధరల పోలిక",
            "చర్చించదగిన ధర ఎంపికలు",
          ],
        },
        {
          title: "కొనుగోలుదారులతో చాట్ చేయండి",
          description: "ఆసక్తి ఉన్న కొనుగోలుదారులతో నేరుగా సంభాషించండి, ధరలపై చర్చించండి మరియు ఒప్పందాలు పూర్తి చేయండి.",
          icon: "MessageCircle",
          tips: [
            "రియల్-టైమ్ మెసేజింగ్",
            "వాయిస్ మెసేజ్‌లు",
            "ఆఫర్ బేరసారాలు",
          ],
        },
        {
          title: "సురక్షిత చెల్లింపులు",
          description: "మీ రక్షణ కోసం అన్ని చెల్లింపులు మా ఎస్క్రో వ్యవస్థ ద్వారా సురక్షితంగా నిర్వహించబడతాయి.",
          icon: "Shield",
          tips: [
            "ఎస్క్రో భద్రత",
            "ఆధార్ ధృవీకరణ",
            "చెల్లింపు హామీ",
          ],
        },
        {
          title: "డెలివరీ ట్రాక్ చేయండి",
          description: "మీ షిప్‌మెంట్లను పర్యవేక్షించండి మరియు కొనుగోలుదారు డెలివరీని ధృవీకరించిన వెంటనే డబ్బులు పొందండి.",
          icon: "Truck",
          tips: [
            "డెలివరీ ట్రాకింగ్",
            "తక్షణ చెల్లింపులు",
            "కొనుగోలుదారు రేటింగ్‌లు",
          ],
        },
      ],
      buyer: [
        {
          title: "స్వాగతం, కొనుగోలుదారు మిత్రమా!",
          description: "పారదర్శక ధరలు మరియు నాణ్యత హామీతో నేరుగా రైతుల నుండి తాజా పంట ఉత్పత్తులను పొందండి.",
          icon: "Store",
          tips: [
            "పొలం నుండి నేరుగా తాజా పంట",
            "పారదర్శక ధరలు",
            "నాణ్యత హామీ",
          ],
        },
        {
          title: "మార్కెట్ ప్లేస్ శోధించండి",
          description: "అందుబాటులో ఉన్న పంటలను వెతకండి, ఫిల్టర్ చేయండి మరియు ప్రభుత్వ ధరలతో పోల్చండి.",
          icon: "TrendingUp",
          tips: [
            "శోధన & ఫిల్టర్",
            "ధరల పోలిక",
            "నాణ్యత రేటింగ్‌లు",
          ],
        },
        {
          title: "రైతులతో కనెక్ట్ అవ్వండి",
          description: "రైతులతో నేరుగా చాట్ చేయండి, ప్రశ్నలు అడగండి మరియు ఉత్తమ డీల్స్ కుదుర్చుకోండి.",
          icon: "MessageCircle",
          tips: [
            "ప్రత్యక్ష సంభాషణ",
            "ఫోటో షేరింగ్",
            "ధర చర్చలు",
          ],
        },
        {
          title: "సురక్షిత లావాదేవీలు",
          description: "ఆధార్ ధృవీకరణతో మా ఎస్క్రో వ్యవస్థ ద్వారా సురక్షితంగా చెల్లింపులు పూర్తి చేయండి.",
          icon: "Shield",
          tips: [
            "సురక్షిత చెల్లింపులు",
            "కొనుగోలుదారు రక్షణ",
            "ధృవీకరించబడిన రైతులు",
          ],
        },
        {
          title: "రేటింగ్ & సమీక్ష ఇవ్వండి",
          description: "మీ అనుభవాన్ని పంచుకోండి మరియు నమ్మకమైన వ్యవసాయ సమాజాన్ని నిర్మించడంలో సహాయపడండి.",
          icon: "Star",
          tips: [
            "రైతులకు రేటింగ్ ఇవ్వండి",
            "సమీక్షలు రాయండి",
            "నమ్మకాన్ని పెంచండి",
          ],
        },
      ],
    },
    features: {
      title: "కీలక ఫీచర్లు",
      items: [
        {
          icon: "Smartphone",
          title: "వాడకంలో చాలా సులభం",
          desc: "ప్రతి ఒక్కరికీ అనుకూలమైన సులభమైన ఇంటర్‌ఫేస్",
        },
        {
          icon: "IndianRupee",
          title: "సరసమైన ధర",
          desc: "దళారుల కమీషన్లు ఏమీ లేవు",
        },
        {
          icon: "MessageCircle",
          title: "ప్రత్యక్ష చాట్",
          desc: "వాట్సాప్ లాంటి సులభమైన మెసేజింగ్",
        },
        {
          icon: "Shield",
          title: "పూర్తి భద్రత",
          desc: "ఎస్క్రో ద్వారా రక్షించబడిన లావాదేవీలు",
        },
      ],
    },
  },
};

export const farmerDashTranslations: Record<Language, {
  dashboard: string;
  welcome: string;
  addProduce: string;
  myListings: string;
  earnings: string;
  totalEarnings: string;
  available: string;
  sold: string;
  pending: string;
  kg: string;
  perKg: string;
  noListings: string;
  startSelling: string;
  logout: string;
}> = {
  en: {
    dashboard: "Farmer Dashboard",
    welcome: "Welcome",
    addProduce: "Add New Produce",
    myListings: "My Produce Listings",
    earnings: "This Week Earnings",
    totalEarnings: "Total Earnings",
    available: "Available",
    sold: "Sold",
    pending: "Pending",
    kg: "kg",
    perKg: "per kg",
    noListings: "No produce listed yet",
    startSelling: "Start by adding your first produce",
    logout: "Logout",
  },
  ml: {
    dashboard: "കർഷക ഡാഷ്ബോർഡ്",
    welcome: "സ്വാഗതം",
    addProduce: "പുതിയ ഉൽപ്പന്നം ചേർക്കുക",
    myListings: "എന്റെ ഉൽപ്പന്ന ലിസ്റ്റിംഗുകൾ",
    earnings: "ഈ ആഴ്ചയുടെ വരുമാനം",
    totalEarnings: "മൊത്തം വരുമാനം",
    available: "ലഭ്യമാണ്",
    sold: "വിറ്റു",
    pending: "കാത്തിരിക്കുന്നു",
    kg: "കിലോ",
    perKg: "കിലോയ്ക്ക്",
    noListings: "ഇതുവരെ ഒരു ഉൽപ്പന്നവും ലിസ്റ്റ് ചെയ്തിട്ടില്ല",
    startSelling: "നിങ്ങളുടെ ആദ്യത്തെ ഉൽപ്പന്നം ചേർത്ത് ആരംഭിക്കുക",
    logout: "ലോഗ് ഔട്ട്",
  },
  hi: {
    dashboard: "किसान डैशबोर्ड",
    welcome: "स्वागत है",
    addProduce: "नई उपज जोड़ें",
    myListings: "मेरी उपज सूचियाँ",
    earnings: "इस सप्ताह की कमाई",
    totalEarnings: "कुल कमाई",
    available: "उपलब्ध",
    sold: "बिक गया",
    pending: "लंबित",
    kg: "किग्रा",
    perKg: "प्रति किग्रा",
    noListings: "अभी तक कोई उपज सूचीबद्ध नहीं है",
    startSelling: "अपनी पहली उपज जोड़कर शुरुआत करें",
    logout: "लॉगआउट",
  },
  te: {
    dashboard: "రైతు డ్యాష్‌బోర్డ్",
    welcome: "స్వాగతం",
    addProduce: "కొత్త పంటను జోడించండి",
    myListings: "నా పంట జాబితాలు",
    earnings: "ఈ వారం ఆదాయం",
    totalEarnings: "మొత్తం సంపాదన",
    available: "అందుబాటులో ఉంది",
    sold: "విక్రయించబడింది",
    pending: "పెండింగ్‌లో ఉంది",
    kg: "కేజీ",
    perKg: "కిలోకు",
    noListings: "ఇంకా ఏ పంట జాబితా చేయబడలేదు",
    startSelling: "మీ మొదటి పంటను జోడించడం ద్వారా ప్రారంభించండి",
    logout: "లాగ్ అవుట్",
  },
};

export const buyerMarketTranslations: Record<Language, {
  marketplace: string;
  welcome: string;
  search: string;
  filter: string;
  freshProduce: string;
  kg: string;
  perKg: string;
  negotiable: string;
  contact: string;
  viewDetails: string;
  chat: string;
  quickChat: string;
  noResults: string;
  tryDifferent: string;
  from: string;
  logout: string;
  available: string;
}> = {
  en: {
    marketplace: "Marketplace",
    welcome: "Welcome",
    search: "Search crops, location...",
    filter: "Filter",
    freshProduce: "Fresh Produce Available",
    kg: "kg",
    perKg: "per kg",
    negotiable: "Negotiable",
    contact: "Contact Farmer",
    viewDetails: "View Details",
    chat: "Chat",
    quickChat: "Quick Chat",
    noResults: "No produce found",
    tryDifferent: "Try different search terms",
    from: "from",
    logout: "Logout",
    available: "Available",
  },
  ml: {
    marketplace: "മാർക്കറ്റ്പ്ലേസ്",
    welcome: "സ്വാഗതം",
    search: "വിളകൾ, സ്ഥലം തിരയുക...",
    filter: "ഫിൽറ്റർ",
    freshProduce: "പുതിയ ഉൽപ്പന്നങ്ങൾ ലഭ്യമാണ്",
    kg: "കിലോ",
    perKg: "കിലോയ്ക്ക്",
    negotiable: "ചർച്ചയ്ക്ക് വിധേയം",
    contact: "കർഷകനെ ബന്ധപ്പെടുക",
    viewDetails: "വിശദാംശങ്ങൾ കാണുക",
    chat: "ചാറ്റ്",
    quickChat: "ക്വിക്ക് ചാറ്റ്",
    noResults: "ഒരു ഉൽപ്പന്നവും കണ്ടെത്തിയില്ല",
    tryDifferent: "വ്യത്യസ്ത സെർച്ച് ടേമുകൾ പരിശോധിക്കുക",
    from: "നിന്ന്",
    logout: "ലോഗ് ഔട്ട്",
    available: "ലഭ്യമാണ്",
  },
  hi: {
    marketplace: "मार्केटप्लेस",
    welcome: "स्वागत है",
    search: "फसलें, स्थान खोजें...",
    filter: "फ़िल्टर",
    freshProduce: "ताज़ा उपज उपलब्ध है",
    kg: "किग्रा",
    perKg: "प्रति किग्रा",
    negotiable: "मोलभाव संभव",
    contact: "किसान से संपर्क करें",
    viewDetails: "विवरण देखें",
    chat: "चैट",
    quickChat: "त्वरित चैट",
    noResults: "कोई उपज नहीं मिली",
    tryDifferent: "अलग खोज शब्द आज़माएँ",
    from: "से",
    logout: "लॉगआउट",
    available: "उपलब्ध",
  },
  te: {
    marketplace: "మార్కెట్ ప్లేస్",
    welcome: "స్వాగతం",
    search: "పంటలు, ప్రాంతం వెతకండి...",
    filter: "ఫిల్టర్",
    freshProduce: "తాజా పంట ఉత్పత్తులు అందుబాటులో ఉన్నాయి",
    kg: "కేజీ",
    perKg: "కిలోకు",
    negotiable: "ధర బేరసారాలు కలదు",
    contact: "రైతును సంప్రదించండి",
    viewDetails: "వివరాలు చూడండి",
    chat: "చాట్",
    quickChat: "త్వరిత చాట్",
    noResults: "ఏ పంట దొరకలేదు",
    tryDifferent: "వేరే పదాలతో వెతకండి",
    from: "నుండి",
    logout: "లాగ్ అవుట్",
    available: "అందుబాటులో ఉంది",
  },
};

export const addProduceTranslations: Record<Language, {
  addProduce: string;
  cropPhoto: string;
  takePhoto: string;
  cropName: string;
  selectCrop: string;
  customCrop: string;
  quantity: string;
  pricePerKg: string;
  location: string;
  negotiablePrice: string;
  yes: string;
  no: string;
  postListing: string;
  cropNamePlaceholder: string;
  quantityPlaceholder: string;
  pricePlaceholder: string;
  locationPlaceholder: string;
  success: string;
  priceGuidance: string;
  govtPrice: string;
  fairPrice: string;
  aboveAvg: string;
  belowAvg: string;
  priceRecommendation: string;
  back: string;
}> = {
  en: {
    addProduce: "Add New Produce",
    cropPhoto: "Crop Photo",
    takePhoto: "Take Photo",
    cropName: "Crop Name",
    selectCrop: "Select a crop",
    customCrop: "Other (Enter custom)",
    quantity: "Quantity (kg)",
    pricePerKg: "Price per kg (₹)",
    location: "Location/Village",
    negotiablePrice: "Price Negotiable",
    yes: "Yes",
    no: "No",
    postListing: "Post Listing",
    cropNamePlaceholder: "Enter crop name",
    quantityPlaceholder: "Enter quantity in kg",
    pricePlaceholder: "Enter price per kg",
    locationPlaceholder: "Enter your village name",
    success: "Listing Posted Successfully!",
    priceGuidance: "Price Guidance",
    govtPrice: "Govt. Price Range",
    fairPrice: "Fair Price",
    aboveAvg: "Above Average",
    belowAvg: "Below Average",
    priceRecommendation: "Price Recommendation",
    back: "Back",
  },
  ml: {
    addProduce: "പുതിയ ഉൽപ്പന്നം ചേർക്കുക",
    cropPhoto: "വിള ഫോട്ടോ",
    takePhoto: "ഫോട്ടോ എടുക്കുക",
    cropName: "വിളയുടെ പേര്",
    selectCrop: "ഒരു വിള തിരഞ്ഞെടുക്കുക",
    customCrop: "മറ്റുള്ളവ (കസ്റ്റം നൽകുക)",
    quantity: "അളവ് (കിലോ)",
    pricePerKg: "കിലോയ്ക്കുള്ള വില (₹)",
    location: "സ്ഥലം/ഗ്രാമം",
    negotiablePrice: "വില ചർച്ചയ്ക്ക് വിധേയം",
    yes: "അതെ",
    no: "ഇല്ല",
    postListing: "ലിസ്റ്റിംഗ് പോസ്റ്റ് ചെയ്യുക",
    cropNamePlaceholder: "വിളയുടെ പേര് നൽകുക",
    quantityPlaceholder: "കിലോയിൽ അളവ് നൽകുക",
    pricePlaceholder: "കിലോയ്ക്കുള്ള വില നൽകുക",
    locationPlaceholder: "നിങ്ങളുടെ ഗ്രാമത്തിന്റെ പേര് നൽകുക",
    success: "ലിസ്റ്റിംഗ് വിജയകരമായി പോസ്റ്റ് ചെയ്തു!",
    priceGuidance: "വില ഗൈഡൻസ്",
    govtPrice: "സർക്കാർ വില പരിധി",
    fairPrice: "ന്യായമായ വില",
    aboveAvg: "ശരാശരിയിൽ കൂടുതൽ",
    belowAvg: "ശരാശരിയിൽ കുറവ്",
    priceRecommendation: "വില ശുപാർശ",
    back: "തിരിച്ചുപോകുക",
  },
  hi: {
    addProduce: "नई उपज जोड़ें",
    cropPhoto: "फसल की तस्वीर",
    takePhoto: "फोटो खींचें",
    cropName: "फसल का नाम",
    selectCrop: "एक फसल चुनें",
    customCrop: "अन्य (कस्टम दर्ज करें)",
    quantity: "मात्रा (किग्रा)",
    pricePerKg: "प्रति किग्रा मूल्य (₹)",
    location: "स्थान / गाँव",
    negotiablePrice: "मोलभाव संभव है",
    yes: "हाँ",
    no: "नहीं",
    postListing: "लिस्टिंग पोस्ट करें",
    cropNamePlaceholder: "फसल का नाम दर्ज करें",
    quantityPlaceholder: "किग्रा में मात्रा दर्ज करें",
    pricePlaceholder: "प्रति किग्रा मूल्य दर्ज करें",
    locationPlaceholder: "अपने गाँव/स्थान का नाम दर्ज करें",
    success: "लिस्टिंग सफलतापूर्वक पोस्ट की गई!",
    priceGuidance: "मूल्य मार्गदर्शन",
    govtPrice: "सरकारी मंडी मूल्य सीमा",
    fairPrice: "उचित मूल्य",
    aboveAvg: "औसत से अधिक",
    belowAvg: "औसत से कम",
    priceRecommendation: "मूल्य सिफ़ारिश",
    back: "पीछे",
  },
  te: {
    addProduce: "కొత్త పంటను జోడించండి",
    cropPhoto: "పంట ఫోటో",
    takePhoto: "ఫోటో తీయండి",
    cropName: "పంట పేరు",
    selectCrop: "పంటను ఎంచుకోండి",
    customCrop: "ఇతర (స్వంత పేరు నమోదు చేయండి)",
    quantity: "పరిమాణం (కేజీలు)",
    pricePerKg: "కిలో ధర (₹)",
    location: "ప్రాంతం / గ్రామం",
    negotiablePrice: "ధర బేరసారాలు సాధ్యమేనా",
    yes: "అవును",
    no: "కాదు",
    postListing: "లిస్టింగ్ పోస్ట్ చేయండి",
    cropNamePlaceholder: "పంట పేరు నమోదు చేయండి",
    quantityPlaceholder: "పరిమాణాన్ని కేజీలలో నమోదు చేయండి",
    pricePlaceholder: "కిలో ధర నమోదు చేయండి",
    locationPlaceholder: "మీ గ్రామం పేరు నమోదు చేయండి",
    success: "లిస్టింగ్ విజయవంతంగా పోస్ట్ చేయబడింది!",
    priceGuidance: "ధర మార్గదర్శకత్వం",
    govtPrice: "ప్రభుత్వ మార్కెట్ ధర శ్రేణి",
    fairPrice: "సమంజసమైన ధర",
    aboveAvg: "సగటు కంటే ఎక్కువ",
    belowAvg: "సగటు కంటే తక్కువ",
    priceRecommendation: "ధర సిఫార్సు",
    back: "వెనుకకు",
  },
};

export const listingDetailTranslations: Record<Language, {
  cropDetails: string;
  quantity: string;
  price: string;
  farmer: string;
  location: string;
  postedOn: string;
  negotiable: string;
  yes: string;
  no: string;
  totalValue: string;
  kg: string;
  priceComparison: string;
  govtPrice: string;
  aboveAvg: string;
  belowAvg: string;
  atAvg: string;
  fairPricing: string;
  chatWithFarmer: string;
  makeOffer: string;
  buyNow: string;
  rating: string;
  reviews: string;
  back: string;
}> = {
  en: {
    cropDetails: "Crop Details",
    quantity: "Available Quantity",
    price: "Price per kg",
    farmer: "Farmer",
    location: "Location",
    postedOn: "Posted on",
    negotiable: "Price Negotiable",
    yes: "Yes",
    no: "No",
    totalValue: "Total Value",
    kg: "kg",
    priceComparison: "Price Comparison",
    govtPrice: "Govt. Price Range",
    aboveAvg: "Above Average",
    belowAvg: "Below Average",
    atAvg: "Fair Price",
    fairPricing: "Fair Pricing",
    chatWithFarmer: "Chat with Farmer",
    makeOffer: "Make Offer",
    buyNow: "Buy Now",
    rating: "Rating",
    reviews: "reviews",
    back: "Back",
  },
  ml: {
    cropDetails: "വിള വിശദാംശങ്ങൾ",
    quantity: "ലഭ്യമായ അളവ്",
    price: "കിലോയ്ക്കുള്ള വില",
    farmer: "കർഷകൻ",
    location: "സ്ഥലം",
    postedOn: "പോസ്റ്റ് ചെയ്ത തീയതി",
    negotiable: "വില ചർച്ചയ്ക്ക് വിധേയം",
    yes: "അതെ",
    no: "ഇല്ല",
    totalValue: "മൊത്തം മൂല്യം",
    kg: "കിലോ",
    priceComparison: "വില താരതമ്യം",
    govtPrice: "സർക്കാർ വില പരിധി",
    aboveAvg: "ശരാശരിയിൽ കൂടുതൽ",
    belowAvg: "ശരാശരിയിൽ കുറവ്",
    atAvg: "ന്യായമായ വില",
    fairPricing: "ന്യായമായ വിലനിർണ്ണയം",
    chatWithFarmer: "കർഷകനുമായി ചാറ്റ് ചെയ്യുക",
    makeOffer: "ഓഫർ നൽകുക",
    buyNow: "ഇപ്പോൾ വാങ്ങുക",
    rating: "റേറ്റിംഗ്",
    reviews: "അവലോകനങ്ങൾ",
    back: "തിരിച്ചുപോകുക",
  },
  hi: {
    cropDetails: "फसल विवरण",
    quantity: "उपलब्ध मात्रा",
    price: "प्रति किग्रा मूल्य",
    farmer: "किसान",
    location: "स्थान",
    postedOn: "पोस्ट करने की तिथि",
    negotiable: "मोलभाव संभव है",
    yes: "हाँ",
    no: "नहीं",
    totalValue: "कुल मूल्य",
    kg: "किग्रा",
    priceComparison: "मूल्य तुलना",
    govtPrice: "सरकारी मंडी मूल्य सीमा",
    aboveAvg: "औसत से अधिक",
    belowAvg: "औसत से कम",
    atAvg: "उचित मूल्य",
    fairPricing: "उचित मूल्य निर्धारण",
    chatWithFarmer: "किसान से चैट करें",
    makeOffer: "ऑफ़र दें",
    buyNow: "अभी खरीदें",
    rating: "रेटिंग",
    reviews: "समीक्षाएं",
    back: "पीछे",
  },
  te: {
    cropDetails: "పంట వివరాలు",
    quantity: "అందుబాటులో ఉన్న పరిమాణం",
    price: "కిలో ధర",
    farmer: "రైతు",
    location: "ప్రాంతం",
    postedOn: "పోస్ట్ చేసిన తేదీ",
    negotiable: "ధర బేరసారాలు కలదు",
    yes: "అవును",
    no: "కాదు",
    totalValue: "మొత్తం విలువ",
    kg: "కేజీ",
    priceComparison: "ధరల పోలిక",
    govtPrice: "ప్రభుత్వ మార్కెట్ ధర శ్రేణి",
    aboveAvg: "సగటు కంటే ఎక్కువ",
    belowAvg: "సగటు కంటే తక్కువ",
    atAvg: "సమంజసమైన ధర",
    fairPricing: "సమంజసమైన ధరల నిర్ణయం",
    chatWithFarmer: "రైతుతో చాట్ చేయండి",
    makeOffer: "ఆఫర్ ఇవ్వండి",
    buyNow: "ఇప్పుడే కొనండి",
    rating: "రేటింగ్",
    reviews: "సమీక్షలు",
    back: "వెనుకకు",
  },
};

export const chatTranslations: Record<Language, {
  chatWith: string;
  typeMessage: string;
  send: string;
  makeOffer: string;
  acceptOffer: string;
  rejectOffer: string;
  offerMade: string;
  offerAccepted: string;
  offerRejected: string;
  currentPrice: string;
  yourOffer: string;
  negotiable: string;
  notNegotiable: string;
  location: string;
  quantity: string;
  back: string;
  online: string;
  offline: string;
  typing: string;
  kg: string;
  perKg: string;
  contactInfo: string;
  phoneNumber: string;
  village: string;
  rating: string;
  reviews: string;
  delivered: string;
  sent: string;
  read: string;
  today: string;
  yesterday: string;
  attachments: string;
  camera: string;
  gallery: string;
  document: string;
  voiceMessage: string;
  recording: string;
  tapToStop: string;
  emoji: string;
  imageUploaded: string;
  documentUploaded: string;
  callNow: string;
  aiPowered: string;
  smartSuggestions: string;
}> = {
  en: {
    chatWith: "Chat with",
    typeMessage: "Type your message...",
    send: "Send",
    makeOffer: "Make Offer",
    acceptOffer: "Accept Offer",
    rejectOffer: "Reject Offer",
    offerMade: "Offer Made",
    offerAccepted: "Offer Accepted!",
    offerRejected: "Offer Rejected",
    currentPrice: "Current Price",
    yourOffer: "Your Offer",
    negotiable: "Negotiable",
    notNegotiable: "Fixed Price",
    location: "Location",
    quantity: "Quantity",
    back: "Back",
    online: "Online",
    offline: "Last seen recently",
    typing: "typing...",
    kg: "kg",
    perKg: "/kg",
    contactInfo: "Contact Info",
    phoneNumber: "Phone Number",
    village: "Village",
    rating: "Rating",
    reviews: "Reviews",
    delivered: "Delivered",
    sent: "Sent",
    read: "Read",
    today: "Today",
    yesterday: "Yesterday",
    attachments: "Attachments",
    camera: "Camera",
    gallery: "Gallery",
    document: "Document",
    voiceMessage: "Voice Message",
    recording: "Recording...",
    tapToStop: "Tap to stop",
    emoji: "Emoji",
    imageUploaded: "Image uploaded",
    documentUploaded: "Document uploaded",
    callNow: "Call Now",
    aiPowered: "AI-Enhanced Chat",
    smartSuggestions: "Smart suggestions available",
  },
  ml: {
    chatWith: "ചാറ്റ് ചെയ്യുക",
    typeMessage: "നിങ്ങളുടെ സന്ദേശം ടൈപ്പ് ചെയ്യുക...",
    send: "അയയ്ക്കുക",
    makeOffer: "ഓഫർ നൽകുക",
    acceptOffer: "ഓഫർ സ്വീകരിക്കുക",
    rejectOffer: "ഓഫർ നിരസിക്കുക",
    offerMade: "ഓഫർ നൽകി",
    offerAccepted: "ഓഫർ സ്വീകരിച്ചു!",
    offerRejected: "ഓഫർ നിരസിച്ചു",
    currentPrice: "നിലവിലെ വില",
    yourOffer: "നിങ്ങളുടെ ഓഫർ",
    negotiable: "ചർച്ചയ്ക്ക് വിധേയം",
    notNegotiable: "നിശ്ചിത വില",
    location: "സ്ഥലം",
    quantity: "അളവ്",
    back: "തിരിച്ചുപോകുക",
    online: "ഓൺലൈൻ",
    offline: "അടുത്തിടെ കണ്ടത്",
    typing: "ടൈപ്പ് ചെയ്യുന്നു...",
    kg: "കിലോ",
    perKg: "/കിലോ",
    contactInfo: "കോൺടാക്റ്റ് വിവരം",
    phoneNumber: "ഫോൺ നമ്പർ",
    village: "ഗ്രാമം",
    rating: "റേറ്റിംഗ്",
    reviews: "അവലോകനങ്ങൾ",
    delivered: "എത്തിച്ചു",
    sent: "അയച്ചു",
    read: "വായിച്ചു",
    today: "ഇന്ന്",
    yesterday: "ഇന്നലെ",
    attachments: "അറ്റാച്ച്മെന്റുകൾ",
    camera: "ക്യാമറ",
    gallery: "ഗാലറി",
    document: "ഡോക്യുമെന്റ്",
    voiceMessage: "വോയ്സ് സന്ദേശം",
    recording: "റെക്കോർഡിംഗ്...",
    tapToStop: "നിർത്താൻ ടാപ്പ് ചെയ്യുക",
    emoji: "ഇമോജി",
    imageUploaded: "ചിത്രം അപ്‌ലോഡ് ചെയ്തു",
    documentUploaded: "ഡോക്യുമെന്റ് അപ്‌ലോഡ് ചെയ്തു",
    callNow: "ഇപ്പോൾ വിളിക്കുക",
    aiPowered: "AI-എൻഹാൻസ്ഡ് ചാറ്റ്",
    smartSuggestions: "സ്മാർട്ട് നിർദ്ദേശങ്ങൾ ലഭ്യമാണ്",
  },
  hi: {
    chatWith: "के साथ चैट करें",
    typeMessage: "अपना संदेश लिखें...",
    send: "भेजें",
    makeOffer: "ऑफ़र दें",
    acceptOffer: "ऑफ़र स्वीकार करें",
    rejectOffer: "ऑफ़र अस्वीकार करें",
    offerMade: "ऑफ़र दिया गया",
    offerAccepted: "ऑफ़र स्वीकार किया गया!",
    offerRejected: "ऑफ़र अस्वीकार किया गया",
    currentPrice: "वर्तमान मूल्य",
    yourOffer: "आपका ऑफ़र",
    negotiable: "मोलभाव संभव",
    notNegotiable: "निश्चित मूल्य",
    location: "स्थान",
    quantity: "मात्रा",
    back: "पीछे",
    online: "ऑनलाइन",
    offline: "हाल ही में देखा गया",
    typing: "टाइप कर रहे हैं...",
    kg: "किग्रा",
    perKg: "/किग्रा",
    contactInfo: "संपर्क जानकारी",
    phoneNumber: "फ़ोन नंबर",
    village: "गाँव",
    rating: "रेटिंग",
    reviews: "समीक्षाएं",
    delivered: "डिलीवर हुआ",
    sent: "भेजा गया",
    read: "पढ़ा गया",
    today: "आज",
    yesterday: "कल",
    attachments: "संलग्नक",
    camera: "कैमरा",
    gallery: "गैलरी",
    document: "दस्तावेज़",
    voiceMessage: "ध्वनि संदेश",
    recording: "रिकॉर्डिंग हो रही है...",
    tapToStop: "रोकने के लिए टैप करें",
    emoji: "इमोजी",
    imageUploaded: "छवि अपलोड की गई",
    documentUploaded: "दस्तावेज़ अपलोड किया गया",
    callNow: "अभी कॉल करें",
    aiPowered: "एआई-सक्षम चैट",
    smartSuggestions: "स्मार्ट सुझाव उपलब्ध",
  },
  te: {
    chatWith: "తో చాట్ చేయండి",
    typeMessage: "మీ సందేశాన్ని టైప్ చేయండి...",
    send: "పంపండి",
    makeOffer: "ఆఫర్ ఇవ్వండి",
    acceptOffer: "ఆఫర్ అంగీకరించండి",
    rejectOffer: "ఆఫర్ తిరస్కరించండి",
    offerMade: "ఆఫర్ ఇవ్వబడింది",
    offerAccepted: "ఆఫర్ ఆమోదించబడింది!",
    offerRejected: "ఆఫర్ తిరస్కరించబడింది",
    currentPrice: "ప్రస్తుత ధర",
    yourOffer: "మీ ఆఫర్",
    negotiable: "ధర బేరసారాలు కలదు",
    notNegotiable: "స్థిర ధర",
    location: "ప్రాంతం",
    quantity: "పరిమాణం",
    back: "వెనుకకు",
    online: "ఆన్‌లైన్",
    offline: "ఇటీవల చూశారు",
    typing: "టైప్ చేస్తున్నారు...",
    kg: "కేజీ",
    perKg: "/కిలో",
    contactInfo: "సంప్రదింపు సమాచారం",
    phoneNumber: "ఫోన్ నంబర్",
    village: "గ్రామం",
    rating: "రేటింగ్",
    reviews: "సమీక్షలు",
    delivered: "డెలివరీ అయింది",
    sent: "పంపబడింది",
    read: "చదివారు",
    today: "ఈరోజు",
    yesterday: "నిన్న",
    attachments: "అటాచ్‌మెంట్‌లు",
    camera: "కెమెరా",
    gallery: "గ్యాలరీ",
    document: "పత్రం",
    voiceMessage: "వాయిస్ మెసేజ్",
    recording: "రికార్డింగ్ అవుతోంది...",
    tapToStop: "ఆపడానికి నొక్కండి",
    emoji: "ఎమోజి",
    imageUploaded: "చిత్రం అప్‌లోడ్ చేయబడింది",
    documentUploaded: "పత్రం అప్‌లోడ్ చేయబడింది",
    callNow: "ఇప్పుడే కాల్ చేయండి",
    aiPowered: "AI-ఆధారిత చాట్",
    smartSuggestions: "స్మార్ట్ సూచనలు అందుబాటులో ఉన్నాయి",
  },
};

export const paymentTranslations: Record<Language, {
  payment: string;
  escrowTitle: string;
  escrowDesc: string;
  orderSummary: string;
  crop: string;
  quantity: string;
  pricePerKg: string;
  totalAmount: string;
  kg: string;
  aadharVerification: string;
  aadharNumber: string;
  aadharPlaceholder: string;
  verifyAadhar: string;
  aadharVerified: string;
  aadharInvalid: string;
  paymentMethod: string;
  upi: string;
  card: string;
  paymentDetails: string;
  upiId: string;
  payNow: string;
  processing: string;
  verifyingAadhar: string;
  success: string;
  escrowMsg: string;
  nextStep: string;
  viewDelivery: string;
  back: string;
}> = {
  en: {
    payment: "Secure Payment",
    escrowTitle: "Escrow Payment",
    escrowDesc: "Your payment is held safely until delivery is confirmed",
    orderSummary: "Order Summary",
    crop: "Crop",
    quantity: "Quantity",
    pricePerKg: "Price per kg",
    totalAmount: "Total Amount",
    kg: "kg",
    aadharVerification: "Aadhar Verification",
    aadharNumber: "Aadhar Number",
    aadharPlaceholder: "Enter your 12-digit Aadhar number",
    verifyAadhar: "Verify Aadhar",
    aadharVerified: "Aadhar Verified ✓",
    aadharInvalid: "Invalid Aadhar number",
    paymentMethod: "Payment Method",
    upi: "UPI Payment",
    card: "Credit/Debit Card",
    paymentDetails: "Payment Details",
    upiId: "UPI ID",
    payNow: "Pay Now",
    processing: "Processing Payment...",
    verifyingAadhar: "Verifying Aadhar...",
    success: "Payment Successful!",
    escrowMsg: "Payment is now held in escrow",
    nextStep: "Next: Coordinate delivery with farmer",
    viewDelivery: "View Delivery Status",
    back: "Back",
  },
  ml: {
    payment: "സുരക്ഷിത പേയ്മെന്റ്",
    escrowTitle: "എസ്ക്രോ പേയ്മെന്റ്",
    escrowDesc: "ഡെലിവറി സ്ഥിരീകരിക്കുന്നതുവരെ നിങ്ങളുടെ പേയ്മെന്റ് സുരക്ഷിതമായി സൂക്ഷിക്കുന്നു",
    orderSummary: "ഓർഡർ സംഗ്രഹം",
    crop: "വിള",
    quantity: "അളവ്",
    pricePerKg: "കിലോയ്ക്കുള്ള വില",
    totalAmount: "മൊത്തം തുക",
    kg: "കിലോ",
    aadharVerification: "ആധാർ പരിശോധന",
    aadharNumber: "ആധാർ നമ്പർ",
    aadharPlaceholder: "നിങ്ങളുടെ 12-അക്ക ആധാർ നമ്പർ നൽകുക",
    verifyAadhar: "ആധാർ പരിശോധിക്കുക",
    aadharVerified: "ആധാർ പരിശോധിച്ചു ✓",
    aadharInvalid: "അസാധുവായ ആധാർ നമ്പർ",
    paymentMethod: "പേയ്മെന്റ് രീതി",
    upi: "UPI പേയ്മെന്റ്",
    card: "ക്രെഡിറ്റ്/ഡെബിറ്റ് കാർഡ്",
    paymentDetails: "പേയ്മെന്റ് വിശദാംശങ്ങൾ",
    upiId: "UPI ID",
    payNow: "ഇപ്പോൾ പേയ് ചെയ്യുക",
    processing: "പേയ്മെന്റ് പ്രോസസ്സ് ചെയ്യുന്നു...",
    verifyingAadhar: "ആധാർ പരിശോധിക്കുന്നു...",
    success: "പേയ്മെന്റ് വിജയകരം!",
    escrowMsg: "പേയ്മെന്റ് ഇപ്പോൾ എസ്ക്രോയിൽ സൂക്ഷിച്ചു",
    nextStep: "അടുത്തത്: കർഷകനുമായി ഡെലിവറി ഏകോപിപ്പിക്കുക",
    viewDelivery: "ഡെലിവറി സ്റ്റാറ്റസ് കാണുക",
    back: "തിരിച്ചുപോകുക",
  },
  hi: {
    payment: "सुरक्षित भुगतान",
    escrowTitle: "एस्क्रो सुरक्षित भुगतान",
    escrowDesc: "डिलीवरी की पुष्टि होने तक आपका भुगतान सुरक्षित रूप से सुरक्षित रखा जाता है",
    orderSummary: "ऑर्डर सारांश",
    crop: "फसल",
    quantity: "मात्रा",
    pricePerKg: "प्रति किग्रा मूल्य",
    totalAmount: "कुल राशि",
    kg: "किग्रा",
    aadharVerification: "आधार सत्यापन",
    aadharNumber: "आधार नंबर",
    aadharPlaceholder: "अपना 12 अंकों का आधार नंबर दर्ज करें",
    verifyAadhar: "आधार सत्यापित करें",
    aadharVerified: "आधार सत्यापित ✓",
    aadharInvalid: "अमान्य आधार नंबर",
    paymentMethod: "भुगतान विधि",
    upi: "यूपीआई (UPI) भुगतान",
    card: "क्रेडिट / डेबिट कार्ड",
    paymentDetails: "भुगतान विवरण",
    upiId: "UPI ID",
    payNow: "अभी भुगतान करें",
    processing: "भुगतान संसाधित हो रहा है...",
    verifyingAadhar: "आधार सत्यापित किया जा रहा है...",
    success: "भुगतान सफल रहा!",
    escrowMsg: "भुगतान अब एस्क्रो में सुरक्षित है",
    nextStep: "आगे: किसान के साथ डिलीवरी का समन्वय करें",
    viewDelivery: "डिलीवरी स्थिति देखें",
    back: "पीछे",
  },
  te: {
    payment: "సురక్షిత చెల్లింపు",
    escrowTitle: "ఎస్క్రో చెల్లింపు",
    escrowDesc: "డెలివరీ ధృవీకరించబడే వరకు మీ చెల్లింపు సురక్షితంగా ఉంచబడుతుంది",
    orderSummary: "ఆర్డర్ సారాంశం",
    crop: "పంట",
    quantity: "పరిమాణం",
    pricePerKg: "కిలో ధర",
    totalAmount: "మొత్తం సొమ్ము",
    kg: "కేజీ",
    aadharVerification: "ఆధార్ ధృవీకరణ",
    aadharNumber: "ఆధార్ సంఖ్య",
    aadharPlaceholder: "మీ 12 అంకెల ఆధార్ సంఖ్యను నమోదు చేయండి",
    verifyAadhar: "ఆధార్ ధృవీకరించండి",
    aadharVerified: "ఆధార్ ధృవీకరించబడింది ✓",
    aadharInvalid: "చెల్లని ఆధార్ సంఖ్య",
    paymentMethod: "చెల్లింపు పద్ధతి",
    upi: "UPI చెల్లింపు",
    card: "క్రెడిట్ / డెబిట్ కార్డు",
    paymentDetails: "చెల్లింపు వివరాలు",
    upiId: "UPI ID",
    payNow: "ఇప్పుడే చెల్లించండి",
    processing: "చెల్లింపు ప్రాసెస్ అవుతోంది...",
    verifyingAadhar: "ఆధార్ ధృవీకరిస్తోంది...",
    success: "చెల్లింపు విజయవంతమైంది!",
    escrowMsg: "చెల్లింపు ఇప్పుడు ఎస్క్రోలో భద్రపరచబడింది",
    nextStep: "తరువాత: రైతుతో డెలివరీ సమన్వయం చేసుకోండి",
    viewDelivery: "డెలివరీ స్థితిని చూడండి",
    back: "వెనుకకు",
  },
};

export const deliveryTranslations: Record<Language, {
  delivery: string;
  orderStatus: string;
  paymentHeld: string;
  awaitingDelivery: string;
  deliveryComplete: string;
  farmerDetails: string;
  deliveryInstructions: string;
  confirmDelivery: string;
  confirmationText: string;
  confirmButton: string;
  paymentReleased: string;
  thankYou: string;
  rateExperience: string;
  writeReview: string;
  reviewPlaceholder: string;
  rate: string;
  submitReview: string;
  done: string;
  crop: string;
  quantity: string;
  amount: string;
  kg: string;
  call: string;
  coordinating: string;
}> = {
  en: {
    delivery: "Delivery Status",
    orderStatus: "Order Status",
    paymentHeld: "Payment Held in Escrow",
    awaitingDelivery: "Awaiting Delivery Confirmation",
    deliveryComplete: "Delivery Completed",
    farmerDetails: "Farmer Contact",
    deliveryInstructions: "Delivery Instructions",
    confirmDelivery: "Confirm Delivery Received",
    confirmationText: "Please confirm once you have received the produce and are satisfied with the quality.",
    confirmButton: "Yes, Confirm Delivery",
    paymentReleased: "Payment Released!",
    thankYou: "Thank you for your purchase",
    rateExperience: "Rate Your Experience",
    writeReview: "Write a Review (Optional)",
    reviewPlaceholder: "Share your experience with this farmer...",
    rate: "Rate",
    submitReview: "Submit Review",
    done: "Done",
    crop: "Crop",
    quantity: "Quantity",
    amount: "Amount Paid",
    kg: "kg",
    call: "Call",
    coordinating: "Coordinating delivery with farmer...",
  },
  ml: {
    delivery: "ഡെലിവറി സ്റ്റാറ്റസ്",
    orderStatus: "ഓർഡർ സ്റ്റാറ്റസ്",
    paymentHeld: "പേയ്മെന്റ് എസ്ക്രോയിൽ സൂക്ഷിച്ചു",
    awaitingDelivery: "ഡെലിവറി സ്ഥിരീകരണത്തിനായി കാത്തിരിക്കുന്നു",
    deliveryComplete: "ഡെലിവറി പൂർത്തിയായി",
    farmerDetails: "കർഷക ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ",
    deliveryInstructions: "ഡെലിവറി നിർദ്ദേശങ്ങൾ",
    confirmDelivery: "ഡെലിവറി ലഭിച്ചത് സ്ഥിരീകരിക്കുക",
    confirmationText: "നിങ്ങൾക്ക് ഉൽപ്പന്നം ലഭിച്ചുകഴിഞ്ഞാലും ഗുണനിലവാരത്തിൽ സംതൃപ്തരായതിന് ശേഷം ദയവായി സ്ഥിരീകരിക്കുക.",
    confirmButton: "അതെ, ഡെലിവറി സ്ഥിരീകരിക്കുക",
    paymentReleased: "പേയ്മെന്റ് റിലീസ് ചെയ്തു!",
    thankYou: "നിങ്ങളുടെ വാങ്ങലിന് നന്ദി",
    rateExperience: "നിങ്ങളുടെ അനുഭവം റേറ്റ് ചെയ്യുക",
    writeReview: "ഒരു അവലോകനം എഴുതുക (ഓപ്ഷണൽ)",
    reviewPlaceholder: "ഈ കർഷകനുമായുള്ള നിങ്ങളുടെ അനുഭവം പങ്കിടുക...",
    rate: "റേറ്റ് ചെയ്യുക",
    submitReview: "അവലോകനം സമർപ്പിക്കുക",
    done: "പൂർത്തിയായി",
    crop: "വിള",
    quantity: "അളവ്",
    amount: "നൽകിയ തുക",
    kg: "കിലോ",
    call: "വിളിക്കുക",
    coordinating: "കർഷകനുമായി ഡെലിവറി ഏകോപിപ്പിക്കുന്നു...",
  },
  hi: {
    delivery: "डिलीवरी स्थिति",
    orderStatus: "ऑर्डर की स्थिति",
    paymentHeld: "भुगतान एस्क्रो में सुरक्षित है",
    awaitingDelivery: "डिलीवरी पुष्टि की प्रतीक्षा है",
    deliveryComplete: "डिलीवरी पूरी हो चुकी है",
    farmerDetails: "किसान संपर्क विवरण",
    deliveryInstructions: "डिलीवरी निर्देश",
    confirmDelivery: "डिलीवरी प्राप्ति की पुष्टि करें",
    confirmationText: "कृपया उपज प्राप्त होने और गुणवत्ता से संतुष्ट होने के बाद ही पुष्टि करें।",
    confirmButton: "हाँ, डिलीवरी प्राप्त हो गई",
    paymentReleased: "भुगतान किसान को जारी किया गया!",
    thankYou: "आपकी खरीदारी के लिए धन्यवाद",
    rateExperience: "अपने अनुभव को रेटिंग दें",
    writeReview: "समीक्षा लिखें (वैकल्पिक)",
    reviewPlaceholder: "इस किसान के साथ अपने अनुभव को साझा करें...",
    rate: "रेटिंग",
    submitReview: "समीक्षा सबमिट करें",
    done: "पूर्ण हुआ",
    crop: "फसल",
    quantity: "मात्रा",
    amount: "भुगतान की गई राशि",
    kg: "किग्रा",
    call: "कॉल करें",
    coordinating: "किसान के साथ डिलीवरी का समन्वय किया जा रहा है...",
  },
  te: {
    delivery: "డెలివరీ స్థితి",
    orderStatus: "ఆర్డర్ స్థితి",
    paymentHeld: "చెల్లింపు ఎస్క్రోలో సురక్షితంగా ఉంది",
    awaitingDelivery: "డెలివరీ నిర్ధారణ కోసం వేచి చూస్తున్నారు",
    deliveryComplete: "డెలివరీ పూర్తయింది",
    farmerDetails: "రైతు సంప్రదింపు వివరాలు",
    deliveryInstructions: "డెలివరీ సూచనలు",
    confirmDelivery: "డెలివరీ అందినట్లు నిర్ధారించండి",
    confirmationText: "దయచేసి మీరు ఉత్పత్తులను పొందిన తర్వాత మరియు నాణ్యతతో సంతృప్తి చెందిన తర్వాత నిర్ధారించండి.",
    confirmButton: "అవును, డెలివరీ అందింది",
    paymentReleased: "చెల్లింపు రైతుకు విడుదల చేయబడింది!",
    thankYou: "మీ కొనుగోలుకు ధన్యవాదాలు",
    rateExperience: "మీ అనుభవాన్ని రేట్ చేయండి",
    writeReview: "సమీక్ష రాయండి (ఐచ్ఛికం)",
    reviewPlaceholder: "ఈ రైతుతో మీ అనుభవాన్ని పంచుకోండి...",
    rate: "రేట్ చేయండి",
    submitReview: "సమీక్షను సమర్పించండి",
    done: "పూర్తయింది",
    crop: "పంట",
    quantity: "పరిమాణం",
    amount: "చెల్లించిన మొత్తం",
    kg: "కేజీ",
    call: "కాల్ చేయండి",
    coordinating: "రైతుతో డెలివరీ సమన్వయం చేయబడుతోంది...",
  },
};

export const cropsTranslations: Record<string, Record<Language, string>> = {
  "Tomato": {
    en: "Tomato",
    ml: "തക്കാളി",
    hi: "टमाटर",
    te: "టమోటా",
  },
  "Onion": {
    en: "Onion",
    ml: "ഉള്ളി",
    hi: "प्याज",
    te: "ఉల్లిపాయ",
  },
  "Potato": {
    en: "Potato",
    ml: "ഉരുളക്കിഴങ്ങ്",
    hi: "आलू",
    te: "బంగాళాదుంప",
  },
  "Corn": {
    en: "Corn",
    ml: "ചോളം",
    hi: "मक्का",
    te: "మొక్కజొన్న",
  },
  "Cabbage": {
    en: "Cabbage",
    ml: "കാബേജ്",
    hi: "पत्ता गोभी",
    te: "క్యాబేజీ",
  },
  "Carrot": {
    en: "Carrot",
    ml: "കാരറ്റ്",
    hi: "गाजर",
    te: "క్యారెట్",
  },
  "Green Beans": {
    en: "Green Beans",
    ml: "പയറ്",
    hi: "हरी बीन्स",
    te: "చిక్కుడుకాయలు",
  },
  "Rice": {
    en: "Rice",
    ml: "അരി",
    hi: "चावल / धान",
    te: "వరి / బియ్యం",
  },
  "Wheat": {
    en: "Wheat",
    ml: "ഗോതമ്പ്",
    hi: "गेहूं",
    te: "గోధుమలు",
  },
  "Spinach": {
    en: "Spinach",
    ml: "ചീര",
    hi: "पालक",
    te: "పాలకూర",
  },
  "Cauliflower": {
    en: "Cauliflower",
    ml: "കോളിഫ്ലവർ",
    hi: "फूलगोभी",
    te: "కాలీఫ్లవర్",
  },
  "Brinjal": {
    en: "Brinjal",
    ml: "വഴുതനങ്ങ്",
    hi: "बैंगन",
    te: "వంకాయ",
  },
  "Okra": {
    en: "Okra",
    ml: "വെണ്ടക്ക",
    hi: "भिंडी",
    te: "బెండకాయ",
  },
  "Cucumber": {
    en: "Cucumber",
    ml: "വെള്ളരി",
    hi: "खीरा",
    te: "దోసకాయ",
  },
  "Chili": {
    en: "Chili",
    ml: "മുളക്",
    hi: "मिर्च",
    te: "మిరపకాయ",
  },
};

export const namesTranslations: Record<string, Record<Language, string>> = {
  "NEERAJA": {
    en: "NEERAJA",
    ml: "നീരജ",
    hi: "नीरजा",
    te: "నీరజ",
  },
  "Manjunath S": {
    en: "Manjunath S",
    ml: "മഞ്ജുനാഥ് എസ്",
    hi: "मंजुनाथ एस",
    te: "మంజునాథ్ ఎస్",
  },
  "TAMAN RK": {
    en: "TAMAN RK",
    ml: "തമൻ ആർ കെ",
    hi: "तमन आर के",
    te: "తమన్ ఆర్ కె",
  },
  "Suresh Gowda": {
    en: "Suresh Gowda",
    ml: "സുരേഷ് ഗൗഡ",
    hi: "सुरेश गौड़ा",
    te: "సురేష్ గౌడ",
  },
  "Rajesh Naik": {
    en: "Rajesh Naik",
    ml: "രാജേഷ് നായിക്",
    hi: "राजेश नायक",
    te: "రాజేష్ నాయక్",
  },
  "Krishnan Pillai": {
    en: "Krishnan Pillai",
    ml: "കൃഷ്ണൻ പിള്ള",
    hi: "कृष्णन पिल्लई",
    te: "కృష్ణన్ పిళ్లై",
  },
  "Ramesh Kumar": {
    en: "Ramesh Kumar",
    ml: "രമേഷ് കുമാർ",
    hi: "रमेश कुमार",
    te: "రమేష్ కుమార్",
  },
  "Sita Devi": {
    en: "Sita Devi",
    ml: "സീത ദേവി",
    hi: "सीता देवी",
    te: "సీతా దేవి",
  },
  "Mohan Nair": {
    en: "Mohan Nair",
    ml: "മോഹൻ നായർ",
    hi: "मोहन नायर",
    te: "మోహన్ నాయర్",
  },
  "Priya Kumari": {
    en: "Priya Kumari",
    ml: "പ്രിയ കുമാരി",
    hi: "प्रिया कुमारी",
    te: "ప్రియా కుమారి",
  },
  "Vinod Menon": {
    en: "Vinod Menon",
    ml: "വിനോദ് മേനോൻ",
    hi: "विनोद मेनन",
    te: "వినోద్ మీనన్",
  },
  "Suresh Traders": {
    en: "Suresh Traders",
    ml: "സുരേഷ് ട്രേഡേഴ്സ്",
    hi: "सुरेश ट्रेडर्स",
    te: "సురేష్ ట్రేడర్స్",
  },
  "Metro Fresh Foods": {
    en: "Metro Fresh Foods",
    ml: "മെട്രോ ഫ്രഷ് ഫുഡ്സ്",
    hi: "मेट्रो फ्रेश फूड्स",
    te: "మెట్రో ఫ్రెష్ ఫుడ్స్",
  },
  "Green Valley Traders": {
    en: "Green Valley Traders",
    ml: "ഗ്രീൻ വാലി ട്രേഡേഴ്സ്",
    hi: "ग्रीन वैली ट्रेडर्स",
    te: "గ్రీన్ వ్యాలీ ట్రేడర్స్",
  },
  "Demo Buyer Co.": {
    en: "Demo Buyer Co.",
    ml: "ഫാം ഡയറക്ട് കമ്പനി",
    hi: "फार्म डायरेक्ट कंपनी",
    te: "ఫార్మ్ డైరెక్ట్ కో.",
  },
  "Kerala Organics": {
    en: "Kerala Organics",
    ml: "കേരള ഓർഗാനിക്സ്",
    hi: "केरल ऑर्गेनिक्स",
    te: "కేరళ ఆర్గానిక్స్",
  },
  "Spice Route Exports": {
    en: "Spice Route Exports",
    ml: "സ്പൈസ് റൂട്ട് എക്സ്പോർട്ട്സ്",
    hi: "स्पाइस रूट एक्सपोर्ट्स",
    te: "స్పైస్ రూట్ ఎక్స్‌పోర్ట్స్",
  },
  "Fresh Harvest Ltd": {
    en: "Fresh Harvest Ltd",
    ml: "ഫ്രഷ് ഹാർവെസ്റ്റ് ലിമിറ്റഡ്",
    hi: "फ्रेश हार्वेस्ट लिमिटेड",
    te: "ఫ్రెష్ హార్వెస్ట్ లిమిటెడ్",
  },
  "Coastal Vegetables": {
    en: "Coastal Vegetables",
    ml: "കോസ്റ്റൽ വെജിറ്റബിൾസ്",
    hi: "कोस्टल वेजिटेबल्स",
    te: "కోస్టల్ వెజిటబుల్స్",
  },
  "Hill Station Produce": {
    en: "Hill Station Produce",
    ml: "ഹിൽ സ്റ്റേഷൻ പ്രൊഡ്യൂസ്",
    hi: "हिल स्टेशन प्रोड्यूस",
    te: "హిల్ స్టేషన్ ప్రొడ్యూస్",
  },
};

export const villagesTranslations: Record<string, Record<Language, string>> = {
  "Thiruvananthapuram": {
    en: "Thiruvananthapuram",
    ml: "തിരുവനന്തപുരം",
    hi: "तिरुवनंतपुरम",
    te: "తిరువనంతపురం",
  },
  "Kochi": {
    en: "Kochi",
    ml: "കൊച്ചി",
    hi: "कोच्चि",
    te: "కొచ్చి",
  },
  "Kozhikode": {
    en: "Kozhikode",
    ml: "കോഴിക്കോട്",
    hi: "कोझिकोड",
    te: "కోజికోడ్",
  },
  "Thrissur": {
    en: "Thrissur",
    ml: "തൃശ്ശൂർ",
    hi: "त्रिशूर",
    te: "త్రిసూర్",
  },
  "Kottayam": {
    en: "Kottayam",
    ml: "കോട്ടയം",
    hi: "कोट्टायम",
    te: "కొట్టాయం",
  },
  "Palakkad": {
    en: "Palakkad",
    ml: "പാലക്കാട്",
    hi: "पालक्काड़",
    te: "పాలక్కాడ్",
  },
  "Malappuram": {
    en: "Malappuram",
    ml: "മലപ്പുറം",
    hi: "मलप्पुरम",
    te: "మలప్పురం",
  },
  "Idukki": {
    en: "Idukki",
    ml: "ഇടുക്കി",
    hi: "इडुक्की",
    te: "ఇడుక్కి",
  },
  "Wayanad": {
    en: "Wayanad",
    ml: "വയനാട്",
    hi: "वायनाड",
    te: "వయనాడ్",
  },
  "Kannur": {
    en: "Kannur",
    ml: "കണ്ണൂർ",
    hi: "कन्नूर",
    te: "కన్నూర్",
  },
  "Kasaragod": {
    en: "Kasaragod",
    ml: "കാസർഗോഡ്",
    hi: "कासरगोड",
    te: "కాసర్‌గోడ్",
  },
  "Kollam": {
    en: "Kollam",
    ml: "കൊല്ലം",
    hi: "कोल्लम",
    te: "కొల్లాం",
  },
};

export function getCropTranslation(crop: string, lang: Language): string {
  const item = cropsTranslations[crop];
  return item ? (item[lang] || item.en) : crop;
}

export function getNameTranslation(name: string, lang: Language): string {
  const item = namesTranslations[name];
  return item ? (item[lang] || item.en) : name;
}

export function getVillageTranslation(village: string, lang: Language): string {
  const item = villagesTranslations[village];
  return item ? (item[lang] || item.en) : village;
}

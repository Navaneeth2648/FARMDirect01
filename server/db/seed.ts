import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

/**
 * Reference data. Stage day-ranges are typical durations for medium-duration
 * varieties and are meant to be tuned per region/variety by an administrator.
 * Advisory text is general, non-chemical guidance and is seeded as
 * `needs_review` so it is always shown with an "awaiting expert review" label
 * until an agronomist approves it.
 */

type Stage = [key: string, name: string, start: number, end: number, water: 'low' | 'medium' | 'high' | 'critical'];
interface CropSeed {
  id: string; name: string; category: string; seasons: string[]; regions: string[]; agmarknet: string;
  local: Record<string, string>; stages: Stage[];
}

const CROPS: CropSeed[] = [
  {
    id: 'paddy', name: 'Paddy (Rice)', category: 'cereal', seasons: ['kharif', 'rabi'], agmarknet: 'Paddy(Dhan)(Common)',
    regions: ['Andhra Pradesh', 'Telangana', 'West Bengal', 'Uttar Pradesh', 'Punjab', 'Odisha', 'Tamil Nadu', 'Chhattisgarh', 'Bihar', 'Karnataka', 'Kerala'],
    local: { hi: 'धान', te: 'వరి', ml: 'നെല്ല്' },
    stages: [
      ['nursery', 'Nursery raising', -25, -1, 'high'], ['land_preparation', 'Land preparation & puddling', -10, -1, 'high'],
      ['transplanting', 'Transplanting', 0, 3, 'high'], ['establishment', 'Establishment', 4, 20, 'high'],
      ['tillering', 'Tillering (vegetative)', 21, 45, 'high'], ['panicle_initiation', 'Panicle initiation', 46, 65, 'critical'],
      ['flowering', 'Flowering', 66, 80, 'critical'], ['grain_filling', 'Grain filling', 81, 105, 'high'],
      ['maturity', 'Maturity & harvest', 106, 120, 'low'], ['post_harvest', 'Post-harvest drying & storage', 121, 135, 'low'],
    ],
  },
  {
    id: 'cotton', name: 'Cotton', category: 'cash', seasons: ['kharif'], agmarknet: 'Cotton',
    regions: ['Gujarat', 'Maharashtra', 'Telangana', 'Andhra Pradesh', 'Karnataka', 'Madhya Pradesh', 'Haryana', 'Punjab', 'Rajasthan'],
    local: { hi: 'कपास', te: 'పత్తి', ml: 'പരുത്തി' },
    stages: [
      ['land_preparation', 'Land preparation', -20, -1, 'low'], ['sowing', 'Seed treatment & sowing', 0, 5, 'medium'],
      ['establishment', 'Germination & establishment', 6, 25, 'medium'], ['vegetative', 'Vegetative growth', 26, 55, 'medium'],
      ['squaring', 'Squaring', 56, 75, 'high'], ['flowering', 'Flowering', 76, 110, 'critical'],
      ['boll_development', 'Boll development', 111, 150, 'high'], ['harvest', 'Boll opening & picking', 151, 180, 'low'],
    ],
  },
  {
    id: 'maize', name: 'Maize', category: 'cereal', seasons: ['kharif', 'rabi'], agmarknet: 'Maize',
    regions: ['Karnataka', 'Madhya Pradesh', 'Bihar', 'Telangana', 'Andhra Pradesh', 'Maharashtra', 'Rajasthan', 'Uttar Pradesh', 'Tamil Nadu'],
    local: { hi: 'मक्का', te: 'మొక్కజొన్న', ml: 'ചോളം' },
    stages: [
      ['land_preparation', 'Land preparation', -15, -1, 'low'], ['sowing', 'Sowing', 0, 3, 'medium'],
      ['establishment', 'Emergence & establishment', 4, 20, 'medium'], ['vegetative', 'Knee-high vegetative', 21, 50, 'high'],
      ['flowering', 'Tasselling & silking', 51, 65, 'critical'], ['grain_filling', 'Grain filling', 66, 95, 'high'],
      ['maturity', 'Maturity & harvest', 96, 110, 'low'],
    ],
  },
  {
    id: 'chilli', name: 'Chilli', category: 'spice', seasons: ['kharif', 'rabi'], agmarknet: 'Dry Chillies',
    regions: ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Madhya Pradesh', 'Maharashtra', 'Tamil Nadu', 'Odisha'],
    local: { hi: 'मिर्च', te: 'మిరప', ml: 'മുളക്' },
    stages: [
      ['nursery', 'Nursery raising', -40, -1, 'medium'], ['transplanting', 'Transplanting', 0, 5, 'high'],
      ['establishment', 'Establishment', 6, 25, 'medium'], ['vegetative', 'Vegetative growth', 26, 55, 'medium'],
      ['flowering', 'Flowering', 56, 85, 'critical'], ['fruit_development', 'Fruit development', 86, 130, 'high'],
      ['harvest', 'Picking (multiple)', 131, 180, 'medium'],
    ],
  },
  {
    id: 'tomato', name: 'Tomato', category: 'vegetable', seasons: ['kharif', 'rabi', 'zaid'], agmarknet: 'Tomato',
    regions: ['Andhra Pradesh', 'Karnataka', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Gujarat', 'West Bengal', 'Telangana', 'Tamil Nadu'],
    local: { hi: 'टमाटर', te: 'టమాటా', ml: 'തക്കാളി' },
    stages: [
      ['nursery', 'Nursery raising', -28, -1, 'medium'], ['transplanting', 'Transplanting', 0, 5, 'high'],
      ['establishment', 'Establishment', 6, 20, 'medium'], ['vegetative', 'Vegetative growth & staking', 21, 40, 'medium'],
      ['flowering', 'Flowering', 41, 60, 'critical'], ['fruit_development', 'Fruit set & development', 61, 90, 'high'],
      ['harvest', 'Harvest (multiple pickings)', 91, 120, 'medium'],
    ],
  },
  {
    id: 'chickpea', name: 'Chickpea (Chana)', category: 'pulse', seasons: ['rabi'], agmarknet: 'Bengal Gram(Gram)(Whole)',
    regions: ['Madhya Pradesh', 'Maharashtra', 'Rajasthan', 'Uttar Pradesh', 'Karnataka', 'Andhra Pradesh', 'Gujarat'],
    local: { hi: 'चना', te: 'శనగ', ml: 'കടല' },
    stages: [
      ['land_preparation', 'Land preparation', -15, -1, 'low'], ['sowing', 'Seed treatment & sowing', 0, 5, 'medium'],
      ['establishment', 'Establishment', 6, 25, 'low'], ['vegetative', 'Branching', 26, 45, 'medium'],
      ['flowering', 'Flowering', 46, 70, 'critical'], ['pod_filling', 'Pod filling', 71, 95, 'high'],
      ['maturity', 'Maturity & harvest', 96, 110, 'low'],
    ],
  },
  {
    id: 'groundnut', name: 'Groundnut', category: 'oilseed', seasons: ['kharif', 'rabi'], agmarknet: 'Groundnut',
    regions: ['Gujarat', 'Rajasthan', 'Andhra Pradesh', 'Tamil Nadu', 'Karnataka', 'Telangana', 'Maharashtra'],
    local: { hi: 'मूंगफली', te: 'వేరుశనగ', ml: 'നിലക്കടല' },
    stages: [
      ['land_preparation', 'Land preparation', -15, -1, 'low'], ['sowing', 'Sowing', 0, 5, 'medium'],
      ['establishment', 'Establishment', 6, 20, 'medium'], ['vegetative', 'Vegetative growth', 21, 35, 'medium'],
      ['flowering', 'Flowering & pegging', 36, 60, 'critical'], ['pod_development', 'Pod development', 61, 95, 'high'],
      ['maturity', 'Maturity & harvest', 96, 115, 'low'],
    ],
  },
  {
    id: 'soybean', name: 'Soybean', category: 'oilseed', seasons: ['kharif'], agmarknet: 'Soyabean',
    regions: ['Madhya Pradesh', 'Maharashtra', 'Rajasthan', 'Karnataka', 'Telangana'],
    local: { hi: 'सोयाबीन', te: 'సోయాబీన్', ml: 'സോയാബീൻ' },
    stages: [
      ['land_preparation', 'Land preparation', -15, -1, 'low'], ['sowing', 'Seed treatment & sowing', 0, 5, 'medium'],
      ['establishment', 'Emergence', 6, 20, 'medium'], ['vegetative', 'Vegetative growth', 21, 40, 'medium'],
      ['flowering', 'Flowering', 41, 55, 'critical'], ['pod_filling', 'Pod filling', 56, 85, 'critical'],
      ['maturity', 'Maturity & harvest', 86, 105, 'low'],
    ],
  },
  {
    id: 'sugarcane', name: 'Sugarcane', category: 'cash', seasons: ['annual'], agmarknet: 'Sugarcane',
    regions: ['Uttar Pradesh', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Bihar', 'Gujarat', 'Andhra Pradesh', 'Haryana', 'Punjab'],
    local: { hi: 'गन्ना', te: 'చెరకు', ml: 'കരിമ്പ്' },
    stages: [
      ['land_preparation', 'Land preparation', -20, -1, 'low'], ['planting', 'Sett treatment & planting', 0, 10, 'high'],
      ['germination', 'Germination', 11, 45, 'high'], ['tillering', 'Tillering', 46, 120, 'high'],
      ['grand_growth', 'Grand growth', 121, 270, 'critical'], ['maturity', 'Maturity & harvest', 271, 360, 'low'],
    ],
  },
  {
    id: 'turmeric', name: 'Turmeric', category: 'spice', seasons: ['kharif'], agmarknet: 'Turmeric',
    regions: ['Telangana', 'Maharashtra', 'Tamil Nadu', 'Andhra Pradesh', 'Karnataka', 'Odisha', 'Kerala'],
    local: { hi: 'हल्दी', te: 'పసుపు', ml: 'മഞ്ഞൾ' },
    stages: [
      ['land_preparation', 'Land & bed preparation', -20, -1, 'low'], ['planting', 'Rhizome treatment & planting', 0, 10, 'medium'],
      ['establishment', 'Sprouting', 11, 40, 'medium'], ['vegetative', 'Vegetative growth', 41, 150, 'high'],
      ['rhizome_development', 'Rhizome development', 151, 240, 'high'], ['maturity', 'Maturity & harvest', 241, 280, 'low'],
      ['post_harvest', 'Curing, drying & polishing', 281, 300, 'low'],
    ],
  },
  {
    id: 'wheat', name: 'Wheat', category: 'cereal', seasons: ['rabi'], agmarknet: 'Wheat',
    regions: ['Uttar Pradesh', 'Punjab', 'Haryana', 'Madhya Pradesh', 'Rajasthan', 'Bihar', 'Gujarat', 'Maharashtra'],
    local: { hi: 'गेहूं', te: 'గోధుమ', ml: 'ഗോതമ്പ്' },
    stages: [
      ['land_preparation', 'Land preparation', -15, -1, 'low'], ['sowing', 'Seed treatment & sowing', 0, 5, 'medium'],
      ['crown_root', 'Crown root initiation', 6, 25, 'critical'], ['tillering', 'Tillering', 26, 45, 'high'],
      ['jointing', 'Jointing', 46, 65, 'high'], ['flowering', 'Heading & flowering', 66, 85, 'critical'],
      ['grain_filling', 'Grain filling', 86, 110, 'high'], ['maturity', 'Maturity & harvest', 111, 125, 'low'],
    ],
  },
  {
    id: 'redgram', name: 'Pigeon pea (Tur/Arhar)', category: 'pulse', seasons: ['kharif'], agmarknet: 'Arhar (Tur/Red Gram)(Whole)',
    regions: ['Maharashtra', 'Karnataka', 'Madhya Pradesh', 'Telangana', 'Uttar Pradesh', 'Gujarat', 'Andhra Pradesh'],
    local: { hi: 'अरहर', te: 'కంది', ml: 'തുവര' },
    stages: [
      ['sowing', 'Seed treatment & sowing', 0, 5, 'medium'], ['establishment', 'Establishment', 6, 30, 'medium'],
      ['vegetative', 'Vegetative growth', 31, 80, 'medium'], ['flowering', 'Flowering', 81, 110, 'critical'],
      ['pod_filling', 'Pod development', 111, 145, 'high'], ['maturity', 'Maturity & harvest', 146, 170, 'low'],
    ],
  },
  {
    id: 'onion', name: 'Onion', category: 'vegetable', seasons: ['kharif', 'rabi'], agmarknet: 'Onion',
    regions: ['Maharashtra', 'Madhya Pradesh', 'Karnataka', 'Gujarat', 'Rajasthan', 'Bihar', 'Andhra Pradesh'],
    local: { hi: 'प्याज', te: 'ఉల్లి', ml: 'ഉള്ളി' },
    stages: [
      ['nursery', 'Nursery raising', -45, -1, 'medium'], ['transplanting', 'Transplanting', 0, 5, 'high'],
      ['establishment', 'Establishment', 6, 25, 'medium'], ['vegetative', 'Leaf growth', 26, 60, 'high'],
      ['bulb_development', 'Bulb development', 61, 100, 'critical'], ['maturity', 'Maturity, harvest & curing', 101, 120, 'low'],
    ],
  },
  {
    id: 'banana', name: 'Banana', category: 'fruit', seasons: ['annual'], agmarknet: 'Banana',
    regions: ['Andhra Pradesh', 'Maharashtra', 'Gujarat', 'Tamil Nadu', 'Karnataka', 'Kerala', 'Madhya Pradesh'],
    local: { hi: 'केला', te: 'అరటి', ml: 'വാഴ' },
    stages: [
      ['planting', 'Sucker/plantlet planting', 0, 15, 'high'], ['establishment', 'Establishment', 16, 60, 'high'],
      ['vegetative', 'Vegetative growth', 61, 180, 'high'], ['flowering', 'Shooting (flowering)', 181, 240, 'critical'],
      ['fruit_development', 'Bunch development', 241, 320, 'critical'], ['harvest', 'Harvest', 321, 360, 'medium'],
    ],
  },
];

/** Generic, non-chemical stage guidance. Pesticide/fertiliser doses are intentionally omitted. */
const STAGE_GUIDANCE: Record<string, { topic: string; title: string; body: string }[]> = {
  nursery: [{ topic: 'general', title: 'Raise healthy seedlings', body: 'Use certified seed from a licensed dealer. Prepare raised, well-drained nursery beds, keep them free of weeds, and protect young seedlings from heavy rain and direct midday heat. Transplant only vigorous, disease-free seedlings.' }],
  land_preparation: [{ topic: 'soil', title: 'Prepare the field', body: 'Plough to a fine tilth and level the field so water spreads evenly. Incorporate well-decomposed farmyard manure or compost. If you have a recent soil test, use it to plan nutrient application with your local agriculture officer or Krishi Vigyan Kendra (KVK).' }],
  sowing: [
    { topic: 'general', title: 'Sow at the right time and spacing', body: 'Sow within the recommended window for your district and variety. Follow the seed rate and spacing on the seed packet or from your KVK. Treat seed only with products registered for the crop and follow the label exactly.' },
    { topic: 'irrigation', title: 'Moisture at sowing', body: 'Sow into adequate soil moisture. Avoid sowing just before a forecast heavy-rain spell, which can cause crusting and poor emergence.' },
  ],
  transplanting: [{ topic: 'general', title: 'Transplant carefully', body: 'Transplant in the cooler part of the day, keep the root ball intact, and irrigate lightly soon after. Maintain recommended plant spacing to reduce disease pressure later.' }],
  planting: [{ topic: 'general', title: 'Use healthy planting material', body: 'Select disease-free setts, rhizomes or suckers from a trusted source. Plant at the recommended depth and spacing, and irrigate as needed for good establishment.' }],
  establishment: [
    { topic: 'weed', title: 'Early weed control', body: 'The first few weeks are the most sensitive period for weed competition. Hand weeding or inter-cultivation at this stage protects yield. Fill gaps where plants have failed.' },
    { topic: 'pest', title: 'Begin weekly scouting', body: 'Walk the field in a zig-zag pattern every week. Look at leaves (both sides), stems and growing tips. Record what you see; early detection allows non-chemical options to work.' },
  ],
  germination: [{ topic: 'weed', title: 'Keep the field weed-free', body: 'Control weeds early with inter-cultivation or manual weeding. Ensure even moisture for uniform germination.' }],
  vegetative: [
    { topic: 'nutrient', title: 'Plan nutrient top-dressing', body: 'Nutrient needs depend on your soil test, variety and target yield. Consult your soil health card or local agronomist for the split doses. Do not apply fertiliser on waterlogged soil or just before heavy rain.' },
    { topic: 'pest', title: 'Integrated pest management', body: 'Continue weekly scouting. Use pheromone or sticky traps where appropriate, conserve natural enemies, and act only when pest levels cross locally advised thresholds.' },
  ],
  tillering: [{ topic: 'nutrient', title: 'Support tillering', body: 'Maintain adequate moisture and follow the soil-test based nutrient schedule for this stage. Scout for leaf-feeding pests and leaf diseases.' }],
  squaring: [{ topic: 'pest', title: 'Monitor squares closely', body: 'Check squares and young bolls for feeding damage. Use traps for monitoring. Avoid unnecessary early sprays that kill beneficial insects.' }],
  jointing: [{ topic: 'irrigation', title: 'Irrigation at jointing', body: 'Water stress during jointing reduces yield. Irrigate according to soil moisture and rainfall forecast.' }],
  crown_root: [{ topic: 'irrigation', title: 'Crown root initiation is critical', body: 'Moisture stress at crown root initiation strongly reduces tillering and yield. Ensure irrigation is available at this stage unless rain is sufficient.' }],
  panicle_initiation: [{ topic: 'irrigation', title: 'Avoid water stress', body: 'Panicle initiation is moisture-sensitive. Maintain shallow standing water or adequate soil moisture. Scout for stem borer and leaf folder damage.' }],
  flowering: [
    { topic: 'irrigation', title: 'Flowering is a critical water stage', body: 'Moisture stress during flowering causes flower drop and poor seed set. Plan irrigation using the forecast. Avoid spraying during peak pollinator activity.' },
    { topic: 'disease', title: 'Watch for diseases in humid weather', body: 'Prolonged humidity and leaf wetness favour fungal diseases. Inspect regularly and seek expert advice if you see spreading spots, blights or mould.' },
  ],
  grain_filling: [{ topic: 'irrigation', title: 'Maintain moisture for grain filling', body: 'Keep adequate moisture until the grains reach the dough stage, then gradually reduce irrigation ahead of harvest.' }],
  pod_filling: [{ topic: 'pest', title: 'Protect pods', body: 'Scout for pod borers and sucking pests. Use monitoring traps and act on local thresholds. Maintain moisture if the soil is drying.' }],
  pod_development: [{ topic: 'irrigation', title: 'Pod development needs moisture', body: 'Keep the soil moist (not waterlogged) during pod development. Light soil around plants can help peg and pod development in groundnut.' }],
  boll_development: [{ topic: 'pest', title: 'Boll protection', body: 'Inspect bolls for entry holes and rosette flowers (pink bollworm sign). Remove and destroy damaged material. Consult an expert before any chemical control.' }],
  fruit_development: [{ topic: 'nutrient', title: 'Support fruit development', body: 'Avoid moisture fluctuations, which can cause fruit cracking and disorders. Follow the soil-test based schedule and scout for fruit borers.' }],
  bulb_development: [{ topic: 'irrigation', title: 'Steady moisture for bulbing', body: 'Irrigate regularly during bulb development and stop irrigation about 10–15 days before harvest to improve storage quality.' }],
  rhizome_development: [{ topic: 'general', title: 'Earthing up and mulching', body: 'Earth up and mulch to support rhizome development and conserve moisture. Ensure drainage to prevent rhizome rot.' }],
  grand_growth: [{ topic: 'irrigation', title: 'Peak water demand', body: 'This is the period of maximum growth and water use. Irrigate according to soil moisture. Propping/tying canes reduces lodging in windy weather.' }],
  maturity: [{ topic: 'harvest', title: 'Harvest at the right maturity', body: 'Harvest at physiological maturity in dry weather. Check the forecast to avoid harvesting just before rain. Dry produce to safe moisture before storage.' }],
  harvest: [{ topic: 'harvest', title: 'Harvest and handle carefully', body: 'Harvest in the cooler part of the day where possible, grade the produce, and avoid bruising. Check mandi prices before deciding when and where to sell.' }],
  post_harvest: [{ topic: 'harvest', title: 'Safe storage', body: 'Store only well-dried produce in clean, dry, ventilated storage. Inspect stored produce regularly for insects and moisture.' }],
  shooting: [], tasseling: [],
};

const SCHEMES = [
  {
    id: 'pm-kisan', name: 'PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)', department: 'Ministry of Agriculture & Farmers Welfare',
    scheme_type: 'income_support', farmer_categories: ['small', 'marginal', 'all_landholding'],
    eligibility: 'Landholding farmer families as per land records, subject to exclusion criteria (for example institutional landholders, income-tax payers and certain professionals). Final eligibility is determined by the state government and PM-KISAN verification.',
    benefits: 'Income support paid in instalments directly to the bank account of eligible farmer families.',
    documents: 'Aadhaar, land records, bank account linked to Aadhaar; e-KYC is required.',
    process: 'Register through the PM-KISAN portal, a Common Service Centre (CSC), or the state nodal officer. Complete e-KYC.',
    official_url: 'https://pmkisan.gov.in/',
  },
  {
    id: 'pmfby', name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)', department: 'Ministry of Agriculture & Farmers Welfare',
    scheme_type: 'insurance', farmer_categories: ['all'],
    eligibility: 'Farmers, including sharecroppers and tenant farmers, growing notified crops in notified areas. Enrolment deadlines are set per season and state.',
    benefits: 'Crop insurance cover against yield losses from notified risks, with farmer premium shares set by the scheme for each season and crop type.',
    documents: 'Aadhaar, bank account, land records or tenancy/sowing certificate, sowing declaration.',
    process: 'Apply through your bank, a CSC, an insurance company agent, or the PMFBY portal before the seasonal cut-off date.',
    official_url: 'https://pmfby.gov.in/',
  },
  {
    id: 'soil-health-card', name: 'Soil Health Card Scheme', department: 'Ministry of Agriculture & Farmers Welfare',
    scheme_type: 'soil', farmer_categories: ['all'],
    eligibility: 'All farmers.',
    benefits: 'Soil testing and a soil health card with crop-wise nutrient recommendations for your field.',
    documents: 'Contact details and farm/land details as required by the state soil testing lab.',
    process: 'Contact your local agriculture office or soil testing laboratory, or check the Soil Health portal.',
    official_url: 'https://soilhealth.dac.gov.in/',
  },
  {
    id: 'kcc', name: 'Kisan Credit Card (KCC)', department: 'Department of Financial Services / Ministry of Agriculture',
    scheme_type: 'credit', farmer_categories: ['all', 'tenant', 'fisheries', 'animal_husbandry'],
    eligibility: 'Owner-cultivators, tenant farmers, oral lessees, sharecroppers and self-help/joint liability groups, subject to bank norms.',
    benefits: 'Short-term credit for cultivation and allied needs, with interest subvention available on prompt repayment under government schemes.',
    documents: 'Identity and address proof, land records or tenancy documents, passport photo, as required by the bank.',
    process: 'Apply at a commercial, regional rural or cooperative bank branch.',
    official_url: 'https://www.myscheme.gov.in/schemes/kcc',
  },
  {
    id: 'pm-kusum', name: 'PM-KUSUM (solar pumps & grid-connected solar)', department: 'Ministry of New and Renewable Energy',
    scheme_type: 'irrigation', farmer_categories: ['all'],
    eligibility: 'Individual farmers, groups, FPOs, cooperatives and panchayats, as per state implementation guidelines.',
    benefits: 'Financial support for standalone solar pumps, solarisation of grid-connected pumps, and small solar plants on farmland.',
    documents: 'As specified by the state implementing agency.',
    process: 'Apply through the state nodal agency portal listed on the official website.',
    official_url: 'https://pmkusum.mnre.gov.in/',
  },
  {
    id: 'pmksy-pdmc', name: 'PMKSY – Per Drop More Crop (micro-irrigation)', department: 'Ministry of Agriculture & Farmers Welfare',
    scheme_type: 'irrigation', farmer_categories: ['small', 'marginal', 'all'],
    eligibility: 'Farmers adopting drip or sprinkler irrigation, as per state guidelines.',
    benefits: 'Assistance for installing micro-irrigation systems.',
    documents: 'Land records, Aadhaar, bank details, quotation from a registered system supplier (as required by the state).',
    process: 'Apply through the state horticulture/agriculture department or its micro-irrigation portal.',
    official_url: 'https://pmksy.gov.in/',
  },
  {
    id: 'enam', name: 'e-NAM (National Agriculture Market)', department: 'Small Farmers Agribusiness Consortium (SFAC)',
    scheme_type: 'market', farmer_categories: ['all'],
    eligibility: 'Farmers selling in e-NAM integrated mandis.',
    benefits: 'Online trading platform for transparent price discovery across integrated mandis.',
    documents: 'Registration details and bank account.',
    process: 'Register on the e-NAM portal or at an integrated mandi.',
    official_url: 'https://enam.gov.in/',
  },
];

// Starter field-guide entries: text only (no images until a licensed source is added), pending expert review.
const FIELD_GUIDES: { category: string; name: string; scientific_name: string | null; crops: string[]; symptoms: string; identification: string; management: string; seek_help: string }[] = [
  { category: 'pest', name: 'Fall armyworm', scientific_name: 'Spodoptera frugiperda', crops: ['maize'],
    symptoms: 'Ragged holes and "window panes" on young leaves; moist sawdust-like frass in the whorl; larvae with an inverted Y mark on the head and four dark spots in a square near the tail.',
    identification: 'Inspect whorls of 20 plants at several spots in the field, early morning. Look for egg masses covered with hairs on the underside of leaves.',
    management: 'Scout twice a week in the first 45 days. Hand-pick egg masses and larvae in small plots. Use pheromone traps to monitor. Apply only products registered for fall armyworm on maize, at the label dose, directed into the whorl.',
    seek_help: 'If many plants show fresh damage in the early whorl stage, contact your Krishi Vigyan Kendra or an agriculture officer.' },
  { category: 'pest', name: 'Pink bollworm', scientific_name: 'Pectinophora gossypiella', crops: ['cotton'],
    symptoms: 'Rosette (twisted, unopened) flowers; small exit holes on green bolls; stained, poor-quality lint; damaged seeds inside opened bolls.',
    identification: 'Open green bolls picked from different plants and look for small pink larvae inside. Use pheromone traps from about 45 days after sowing.',
    management: 'Remove and destroy rosette flowers. Avoid extending the crop beyond the normal season. Destroy crop residue after the last picking. Use only registered insecticides, at the label dose, when trap catches stay high.',
    seek_help: 'Ask an agriculture officer when pheromone trap catches stay high for several nights in a row.' },
  { category: 'pest', name: 'Brown planthopper', scientific_name: 'Nilaparvata lugens', crops: ['paddy'],
    symptoms: 'Circular patches of yellowing and drying plants ("hopper burn"); brown insects crowded at the base of tillers just above the water.',
    identification: 'Tilt plants and tap the base over a white tray; count the hoppers that fall.',
    management: 'Avoid excess nitrogen. Use alternate wetting and drying where possible. Leave alleys every few metres for air flow. Use only registered insecticides directed at the base of the plants.',
    seek_help: 'Contact an agriculture officer if hoppers are numerous at the base of most hills or you see hopper burn patches.' },
  { category: 'disease', name: 'Rice blast', scientific_name: 'Magnaporthe oryzae', crops: ['paddy'],
    symptoms: 'Spindle-shaped leaf spots with grey centres and brown margins; dark lesions on the neck of the panicle causing it to break ("neck blast"); chaffy grain.',
    identification: 'Check leaves in the morning, especially in cool, humid weather with heavy dew.',
    management: 'Use resistant varieties suited to your area. Avoid excess nitrogen; apply it in splits. Treat seed before sowing. Use registered fungicides at the label dose when lesions appear and the weather stays humid.',
    seek_help: 'Neck blast at flowering can cause heavy losses: contact an expert quickly if you see neck lesions.' },
  { category: 'disease', name: 'Early blight of tomato', scientific_name: 'Alternaria solani', crops: ['tomato'],
    symptoms: 'Brown spots with concentric rings (target pattern) on older, lower leaves first; yellowing around spots; leaves drop from the bottom up.',
    identification: 'Look at the lowest leaves first. Spots with rings distinguish it from bacterial spots, which are small and greasy.',
    management: 'Remove infected lower leaves. Mulch to stop soil splashing. Water at the base, not over the leaves. Rotate with non-solanaceous crops. Use registered fungicides at the label dose if spread continues.',
    seek_help: 'If spots appear on stems and fruit or the disease spreads quickly after rain, ask an expert.' },
  { category: 'disease', name: 'Late blight of tomato', scientific_name: 'Phytophthora infestans', crops: ['tomato'],
    symptoms: 'Large, water-soaked, dark patches on leaves that spread fast in cool wet weather; white growth on the leaf underside; firm brown patches on fruit.',
    identification: 'Turn the leaf over in the early morning: white growth at the edge of the patch is typical.',
    management: 'Remove and destroy affected plants. Avoid overhead irrigation. Improve spacing for air flow. Use registered fungicides at the label dose before and during wet spells.',
    seek_help: 'Late blight can destroy a field within days: contact an expert immediately.' },
  { category: 'pest', name: 'Chilli thrips', scientific_name: 'Scirtothrips dorsalis', crops: ['chilli'],
    symptoms: 'Leaves curl upwards (boat shape); silvery or brown streaks on the leaf underside; stunted growth and small, scarred fruit.',
    identification: 'Tap tender shoots over white paper and look for tiny, fast-moving, pale yellow insects. Blue or yellow sticky traps help monitoring.',
    management: 'Remove weeds that host thrips. Use sticky traps. Avoid repeated use of the same insecticide group. Use only registered products at the label dose.',
    seek_help: 'Upward curl can also be caused by mites or viruses; ask an expert to confirm before spraying repeatedly.' },
  { category: 'deficiency', name: 'Nitrogen deficiency', scientific_name: null, crops: ['paddy', 'maize', 'wheat'],
    symptoms: 'Uniform pale green to yellow colour starting from older, lower leaves; thin stems; reduced tillering and growth.',
    identification: 'Older leaves yellow first (unlike sulphur or iron deficiency, which show on young leaves). A leaf colour chart helps in paddy and maize.',
    management: 'Apply nitrogen in splits as per soil test and local recommendation. Do not apply all nitrogen at once. Correct waterlogging, which reduces uptake.',
    seek_help: 'Get a soil test through the Soil Health Card scheme to plan nutrient doses.' },
];

export function seed(db: DatabaseSync) {
  const hasCrops = db.prepare('SELECT COUNT(*) n FROM crops').get() as { n: number };
  if (hasCrops.n === 0) {
    const insCrop = db.prepare('INSERT INTO crops (id, name, local_names, category, seasons, regions, agmarknet_name) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insStage = db.prepare('INSERT INTO crop_stages (crop_id, seq, key, name, start_day, end_day, water_need) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insAdv = db.prepare(`INSERT INTO advisories (id, crop_id, stage_key, topic, title, body, source_name, source_url, review_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'needs_review')`);
    db.exec('BEGIN');
    for (const c of CROPS) {
      insCrop.run(c.id, c.name, JSON.stringify(c.local), c.category, JSON.stringify(c.seasons), JSON.stringify(c.regions), c.agmarknet);
      c.stages.forEach(([key, name, s, e, w], i) => {
        insStage.run(c.id, i + 1, key, name, s, e, w);
        for (const g of STAGE_GUIDANCE[key] || []) {
          insAdv.run(randomUUID(), c.id, key, g.topic, g.title, g.body,
            'General agronomic practice (FARMDirect editorial) – pending agronomist review', 'https://agritech.tnau.ac.in/');
        }
      });
    }
    db.exec('COMMIT');
  }

  const hasSchemes = db.prepare('SELECT COUNT(*) n FROM schemes').get() as { n: number };
  if (hasSchemes.n === 0) {
    const ins = db.prepare(`INSERT INTO schemes (id, name, department, level, scheme_type, farmer_categories, eligibility, benefits, documents, process, official_url)
      VALUES (?, ?, ?, 'central', ?, ?, ?, ?, ?, ?, ?)`);
    for (const s of SCHEMES) {
      ins.run(s.id, s.name, s.department, s.scheme_type, JSON.stringify(s.farmer_categories), s.eligibility, s.benefits, s.documents, s.process, s.official_url);
    }
  }

  const insGuide = db.prepare(`INSERT OR IGNORE INTO field_guides (id, category, name, scientific_name, crops, symptoms, identification, management, seek_help, source_name, review_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'FARMDirect editorial – pending expert review', 'needs_review')`);
  for (const g of FIELD_GUIDES) insGuide.run(randomUUID(), g.category, g.name, g.scientific_name, JSON.stringify(g.crops), g.symptoms, g.identification, g.management, g.seek_help);
}

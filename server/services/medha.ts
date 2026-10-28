import { q, type Row } from '../db/index.ts';
import { haversineKm } from './pricing.ts';

export type MedhaAction = { label: string; to: string };
type Source = { type: string; label: string; detail?: string };

/**
 * Navigation suggestions chosen by the server from the question's topic and the
 * user's role. These only open FARMDirect screens; Medha never performs an action
 * itself, so anything consequential still goes through the normal screen and its
 * confirmation and permission checks.
 */
const TOPICS: { words: RegExp; actions: MedhaAction[]; roles?: string[] }[] = [
  { words: /weather|rain|forecast|temperature|wind|humid|बारिश|मौसम|వర్ష|వాతావరణ|മഴ|കാലാവസ്ഥ/i, actions: [{ label: 'Open weather', to: '/weather' }] },
  { words: /disease|pest|insect|spot|leaf|blight|worm|fung|rot|wilt|yellow|रोग|कीट|తెగులు|పురుగు|രോഗ|കീട/i, actions: [{ label: 'Check a photo in Crop Doctor', to: '/crop-doctor' }, { label: 'Crop & pest guide', to: '/guides' }] },
  { words: /fertili[sz]er|urea|dap|npk|nutrient|irrigat|water|soil|खाद|सिंचाई|ఎరువు|నీటి|വളം|ജലസേചന/i, actions: [{ label: 'Soil & water', to: '/soil-water' }, { label: 'Crop advisory', to: '/advisory' }] },
  { words: /price|mandi|rate|market|sell|बेच|भाव|मंडी|ధర|అమ్మ|മാർക്കറ്റ്|വില/i, actions: [{ label: 'Mandi prices', to: '/mandi' }] },
  { words: /sell|list|lot|harvest|बेच|అమ్మ|വിൽ/i, actions: [{ label: 'List produce for sale', to: '/sell/new' }], roles: ['farmer', 'fpo_manager'] },
  { words: /offer|buyer|negotiat|counter|खरीदार|కొనుగోలు|വാങ്ങുന്ന/i, actions: [{ label: 'My offers', to: '/trade' }, { label: 'Buyers & businesses', to: '/businesses' }], roles: ['farmer', 'fpo_manager'] },
  { words: /buy|demand|requirement|supplier/i, actions: [{ label: 'Browse produce', to: '/market' }, { label: 'Post a requirement', to: '/buyer/demand' }], roles: ['buyer'] },
  { words: /storage|warehouse|cold|godown|store|भंडार|गोदाम|గిడ్డంగి|నిల్వ|സംഭരണ/i, actions: [{ label: 'Find nearby storage', to: '/storage' }] },
  { words: /transport|truck|vehicle|deliver|ट्रक|రవాణా|ഗതാഗത/i, actions: [{ label: 'My orders & transport', to: '/trade' }] },
  { words: /grade|grading|quality|inspect|ग्रेड|నాణ్యత|ഗുണനിലവാര/i, actions: [{ label: 'My lots (request grading)', to: '/sell' }], roles: ['farmer', 'fpo_manager'] },
  { words: /scheme|subsidy|insurance|pm-?kisan|pmfby|loan|kcc|योजना|పథక|പദ്ധതി/i, actions: [{ label: 'Government schemes', to: '/schemes' }] },
  { words: /genuine|fake|qr|verify|counterfeit|नकली|నకిలీ|വ്യാജ/i, actions: [{ label: 'Verify a product', to: '/verify' }, { label: 'Product catalogue', to: '/products' }] },
  { words: /seed|pesticide|input|dealer|बीज|విత్తన|വിത്ത്/i, actions: [{ label: 'Buy farm inputs', to: '/inputs' }], roles: ['farmer', 'fpo_manager'] },
  { words: /task|calendar|schedule|plan|sow|कब|ఎప్పుడు|എപ്പോൾ/i, actions: [{ label: 'Crop calendar', to: '/calendar' }, { label: 'My farm', to: '/farm' }] },
  { words: /statistic|production|yield|area|उत्पादन|ఉత్పత్తి|ഉത്പാദന/i, actions: [{ label: 'Crop statistics', to: '/statistics' }] },
  { words: /payment|paid|money|पैसा|భుగతాన|చెల్లింపు|പണം/i, actions: [{ label: 'Orders & payments', to: '/trade' }] },
];

export function suggestActions(question: string, role: string): MedhaAction[] {
  const seen = new Set<string>();
  const acts: MedhaAction[] = [];
  for (const t of TOPICS) {
    if (t.roles && !t.roles.includes(role)) continue;
    if (!t.words.test(question)) continue;
    for (const a of t.actions) if (!seen.has(a.to)) { seen.add(a.to); acts.push(a); }
  }
  return acts.slice(0, 4);
}

/** Marketplace, storage, scheme and diagnosis facts from the user's own FARMDirect records. */
export function marketplaceContext(userId: string, role: string, farm?: Row | null) {
  const lines: string[] = [];
  const sources: Source[] = [];
  const user = q.get<Row>('SELECT state, district FROM users WHERE id = ?', userId)!;

  if (role === 'farmer' || role === 'fpo_manager') {
    const lots = q.all<Row>(`SELECT id, commodity, variety, quantity_available, unit, price_per_unit, status, quality_grade FROM produce_lots
      WHERE farmer_id = ? AND status NOT IN ('sold','withdrawn','expired') ORDER BY created_at DESC LIMIT 5`, userId);
    if (lots.length) {
      lines.push(`MY LOTS [source: FARMDirect marketplace records]: ` + lots.map((l) =>
        `${l.commodity}${l.variety ? ` (${l.variety})` : ''} ${l.quantity_available} ${l.unit} available, asking ${l.price_per_unit ?? 'open'} INR/${l.unit}, status ${l.status}, grade ${l.quality_grade || 'not given'} (farmer-reported)`).join('; '));
      sources.push({ type: 'marketplace', label: 'Your lots', detail: `${lots.length} active` });
      const offers = q.all<Row>(`SELECT o.quantity, o.unit, o.price_per_unit, o.delivery_mode, o.expires_at, l.commodity FROM offers o JOIN produce_lots l ON l.id = o.lot_id
        WHERE o.farmer_id = ? AND o.status = 'pending' AND o.created_by != ? ORDER BY o.created_at DESC LIMIT 5`, userId, userId);
      if (offers.length) {
        lines.push(`PENDING OFFERS ON MY LOTS: ` + offers.map((o) => `${o.commodity}: ${o.quantity} ${o.unit} at ${o.price_per_unit} INR/${o.unit}, ${o.delivery_mode}, expires ${o.expires_at}`).join('; '));
        sources.push({ type: 'marketplace', label: 'Pending offers', detail: `${offers.length}` });
      } else lines.push('PENDING OFFERS ON MY LOTS: none.');
      const commodities = [...new Set(lots.map((l) => l.commodity))];
      const demand = q.all<Row>(`SELECT commodity, quantity, unit, price_min, price_max, district, state, delivery_date FROM demand_requests
        WHERE status IN ('open','partially_filled') AND commodity IN (${commodities.map(() => '?').join(',')}) ${user.state ? 'AND (state = ? OR state IS NULL)' : ''} ORDER BY created_at DESC LIMIT 5`,
        ...commodities, ...(user.state ? [user.state] : []));
      if (demand.length) {
        lines.push(`OPEN BUYER REQUIREMENTS for my crops [source: verified buyers on FARMDirect]: ` + demand.map((d) =>
          `${d.commodity} ${d.quantity} ${d.unit}${d.price_min ? `, ${d.price_min}–${d.price_max ?? d.price_min} INR/${d.unit}` : ''}, ${[d.district, d.state].filter(Boolean).join(', ')}${d.delivery_date ? `, by ${d.delivery_date}` : ''}`).join('; '));
        sources.push({ type: 'marketplace', label: 'Open buyer requirements', detail: `${demand.length}` });
      }
    } else {
      lines.push('MY LOTS: the farmer has no active produce listings.');
    }
  }

  // Nearby verified storage with published rates (only when we know the farm location).
  if (farm?.latitude != null && farm?.longitude != null) {
    const fac = q.all<Row>(`SELECT id, name, district, latitude, longitude, facility_type FROM storage_facilities WHERE status = 'verified'`)
      .map((f): Row => ({ ...f, km: Math.round(haversineKm(farm.latitude, farm.longitude, f.latitude, f.longitude)) }))
      .filter((f) => f.km <= 150).sort((a, b) => a.km - b.km).slice(0, 3);
    if (fac.length) {
      lines.push(`NEARBY VERIFIED STORAGE [source: FARMDirect storage listings; straight-line distance]: ` + fac.map((f) => {
        const r = q.get<Row>('SELECT price, unit, period FROM storage_rates WHERE facility_id = ? ORDER BY price LIMIT 1', f.id);
        return `${f.name} (${f.district}, ~${f.km} km, ${f.facility_type})${r ? `: from ${r.price} INR/${r.unit}/${r.period}` : ''}`;
      }).join('; ') + '. Availability must be checked on the facility page before booking.');
      sources.push({ type: 'storage', label: 'Verified storage listings', detail: `${fac.length} within 150 km` });
    } else lines.push('NEARBY VERIFIED STORAGE: none listed within 150 km.');
  }

  const diag = q.all<Row>(`SELECT crop_id, result_json, created_at FROM diagnoses WHERE user_id = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 2`, userId);
  for (const d of diag) {
    try {
      const r = JSON.parse(d.result_json || '{}');
      const top = r.primary_issue;
      if (top) {
        lines.push(`RECENT CROP DOCTOR RESULT (${d.created_at}, AI photo check, not lab-confirmed): ${d.crop_id || 'crop'} – ${top.name}${top.confidence != null ? ` (confidence ${top.confidence})` : ''}.`);
        sources.push({ type: 'diagnosis', label: 'Your Crop Doctor check', detail: d.created_at });
      }
    } catch { /* ignore malformed */ }
  }

  const schemes = q.all<Row>(`SELECT name, official_url FROM schemes ORDER BY name LIMIT 8`);
  if (schemes.length) {
    lines.push(`SCHEMES IN FARMDIRECT [source: scheme pages linked to official sites; eligibility must be checked on the official site]: ${schemes.map((s) => s.name).join('; ')}.`);
  }
  return { lines, sources };
}

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, BookOpen, Bot, CalendarDays, CheckCircle2, ChevronDown, CloudSun, FileCheck2, Handshake, Landmark, LineChart, Lock,
  Menu, MessageCircleQuestion, Mic, PackageCheck, QrCode, Scale, ShieldCheck, ShoppingBasket, Sprout, Stethoscope, Tractor, Truck, Warehouse, X,
} from 'lucide-react';
import { TUTORIALS } from '../learn/tutorials';
import { useAuth } from '../auth';
import { LANGUAGES } from '../i18n';
import { ThemeToggle } from '../theme';
import { MedhaAvatar } from '../medha';

// ---------------------------------------------------------------- shared public chrome
export function BrandMark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`grid place-items-center rounded-xl bg-emerald-700 text-white ${size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'}`}><Sprout className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden /></span>
      <span className={`font-extrabold tracking-tight text-gray-900 ${size === 'lg' ? 'text-2xl' : 'text-xl'}`}>FARM<span className="text-emerald-700">Direct</span></span>
    </span>
  );
}

const NAV = [
  { href: '/#how', label: 'How It Works' }, { href: '/#features', label: 'Features' }, { href: '/#farmers', label: 'Farmer Guide' },
  { href: '/#buyers', label: 'Buyer Guide' }, { href: '/#medha', label: 'Medha AI' }, { to: '/learn', label: 'Learn / Tutorials' },
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  const { user, lang, setLang } = useAuth();
  const item = (n: (typeof NAV)[number], cls: string) => n.to
    ? <Link key={n.label} to={n.to} className={cls} onClick={() => setOpen(false)}>{n.label}</Link>
    : <a key={n.label} href={n.href} className={cls} onClick={() => setOpen(false)}>{n.label}</a>;
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="FARMDirect home"><BrandMark /></Link>
        <nav aria-label="Main" className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          <Link to="/" className="rounded-lg px-3 py-2 text-[15px] font-medium text-gray-700 hover:bg-gray-100">Home</Link>
          {NAV.map((n) => item(n, 'rounded-lg px-3 py-2 text-[15px] font-medium text-gray-700 hover:bg-gray-100'))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as any)} className="hidden rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm sm:block">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <ThemeToggle />
          {user ? (
            <Link to="/" className="rounded-lg bg-emerald-700 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-emerald-800">Open my dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="hidden rounded-lg px-3 py-2.5 text-[15px] font-semibold text-gray-800 hover:bg-gray-100 sm:block">Sign In</Link>
              <Link to="/login" className="rounded-lg bg-emerald-700 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-emerald-800">Get Started</Link>
            </>
          )}
          <button className="rounded-lg p-2 hover:bg-gray-100 lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t border-gray-200 bg-white px-4 pb-4 lg:hidden">
          <Link to="/" className="block rounded-lg px-3 py-3 text-base font-medium" onClick={() => setOpen(false)}>Home</Link>
          {NAV.map((n) => item(n, 'block rounded-lg px-3 py-3 text-base font-medium text-gray-800 hover:bg-gray-100'))}
          {!user && <Link to="/login" className="mt-2 block rounded-lg border border-gray-300 px-3 py-3 text-center text-base font-semibold" onClick={() => setOpen(false)}>Sign In</Link>}
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <BrandMark />
          <p className="mt-3 max-w-md text-sm text-gray-600">Farming guidance, a direct marketplace with verified buyers, and nearby storage and transport – in one place, in your language.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Get started</p>
          <ul className="mt-2 space-y-2 text-sm text-gray-600">
            <li><Link className="hover:underline" to="/register/farmer">Register as a farmer</Link></li>
            <li><Link className="hover:underline" to="/register/buyer">Register as a buyer</Link></li>
            <li><Link className="hover:underline" to="/register/partner">Storage, transport and professionals</Link></li>
            <li><Link className="hover:underline" to="/login">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Learn</p>
          <ul className="mt-2 space-y-2 text-sm text-gray-600">
            <li><Link className="hover:underline" to="/learn">Learning Centre</Link></li>
            <li><a className="hover:underline" href="/#faq">Frequently asked questions</a></li>
            <li><a className="hover:underline" href="/#trust">Trust and safety</a></li>
            <li><Link className="hover:underline" to="/admin/login">Administrator sign-in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 py-4 text-center text-xs text-gray-500">© {new Date().getFullYear()} FARMDirect</div>
    </footer>
  );
}

// ---------------------------------------------------------------- hero illustration (original SVG)
/** Hero illustration: a farmer's phone at the centre of buyers, prices, storage, transport and Medha AI. Original artwork; motion is decorative and stops with "reduce motion". */
function HeroArt() {
  const card = (x: number, y: number, w: number, h: number, delay: string, children: ReactNode) => (
    <g className="fdh-float" style={{ animationDelay: delay }}>
      <g transform={`translate(${x} ${y})`}>
        <rect width={w} height={h} rx="14" fill="#ffffff" filter="url(#fdh-shadow)" />
        {children}
      </g>
    </g>
  );
  return (
    <svg viewBox="0 0 560 460" className="h-auto w-full" role="img" aria-label="Illustration: a farmer's phone connected to mandi prices, verified buyers, offers, nearby storage, transport and Medha AI" style={{ fontFamily: 'inherit' }}>
      <style>{`
        .fdh-float { animation: fdh-float 6s ease-in-out infinite; }
        .fdh-phone { animation: fdh-float 7s ease-in-out infinite; }
        .fdh-flow { stroke-dasharray: 4 7; animation: fdh-flow 1.6s linear infinite; }
        .fdh-draw { stroke-dasharray: 160; stroke-dashoffset: 160; animation: fdh-draw 3.5s ease-out infinite; }
        .fdh-truck { animation: fdh-truck 16s linear infinite; }
        .fdh-sway { transform-box: fill-box; transform-origin: 50% 100%; animation: fdh-sway 4s ease-in-out infinite; }
        .fdh-sun { transform-box: fill-box; transform-origin: center; animation: fdh-pulse 5s ease-in-out infinite; }
        .fdh-cloud { animation: fdh-cloud 30s linear infinite; }
        .fdh-ping { transform-box: fill-box; transform-origin: center; animation: fdh-ping 2.4s ease-out infinite; }
        @keyframes fdh-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes fdh-flow { to { stroke-dashoffset: -22; } }
        @keyframes fdh-draw { 0% { stroke-dashoffset: 160; } 45%, 100% { stroke-dashoffset: 0; } }
        @keyframes fdh-truck { 0% { transform: translateX(-140px); } 100% { transform: translateX(640px); } }
        @keyframes fdh-sway { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
        @keyframes fdh-pulse { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.12); } }
        @keyframes fdh-cloud { 0% { transform: translateX(-80px); } 100% { transform: translateX(620px); } }
        @keyframes fdh-ping { 0% { opacity: 0.7; transform: scale(0.6); } 100% { opacity: 0; transform: scale(1.8); } }
      `}</style>
      <defs>
        <linearGradient id="fdh-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e3f6ea" /><stop offset="0.6" stopColor="#f4fbf6" /><stop offset="1" stopColor="#ffffff" /></linearGradient>
        <linearGradient id="fdh-hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bfe9c9" /><stop offset="1" stopColor="#9bdcad" /></linearGradient>
        <linearGradient id="fdh-hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7fcf93" /><stop offset="1" stopColor="#4fb36d" /></linearGradient>
        <linearGradient id="fdh-hub" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1f9d44" /><stop offset="1" stopColor="#0f5f2b" /></linearGradient>
        <linearGradient id="fdh-chart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f9d44" stopOpacity="0.25" /><stop offset="1" stopColor="#1f9d44" stopOpacity="0" /></linearGradient>
        <radialGradient id="fdh-glow"><stop offset="0" stopColor="#fde68a" /><stop offset="1" stopColor="#fde68a" stopOpacity="0" /></radialGradient>
        <filter id="fdh-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#0f3d22" floodOpacity="0.14" /></filter>
        <pattern id="fdh-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#1f9d44" opacity="0.12" /></pattern>
        <clipPath id="fdh-frame"><rect width="560" height="460" rx="28" /></clipPath>
      </defs>

      <g clipPath="url(#fdh-frame)">
        <rect width="560" height="460" fill="url(#fdh-sky)" />
        <rect width="560" height="300" fill="url(#fdh-dots)" />

        {/* sun and clouds */}
        <circle className="fdh-sun" cx="470" cy="62" r="54" fill="url(#fdh-glow)" />
        <circle cx="470" cy="62" r="22" fill="#fcd34d" />
        <g className="fdh-cloud" opacity="0.9"><path d="M60 52 a14 14 0 0 1 26 -6 a11 11 0 0 1 18 9 h-50 a8 8 0 0 1 6 -3z" fill="#ffffff" /></g>
        <g className="fdh-cloud" style={{ animationDelay: '-15s' }} opacity="0.8"><path d="M230 34 a12 12 0 0 1 22 -5 a9 9 0 0 1 15 8 h-42 a7 7 0 0 1 5 -3z" fill="#ffffff" /></g>

        {/* fields */}
        <path d="M0 330 C140 300 300 318 560 290 L560 460 L0 460 Z" fill="url(#fdh-hill1)" />
        <path d="M0 372 C160 340 330 362 560 336 L560 460 L0 460 Z" fill="url(#fdh-hill2)" />
        {Array.from({ length: 11 }, (_, i) => (
          <g key={i} className="fdh-sway" style={{ animationDelay: `${-i * 0.35}s` }}>
            <path d={`M${28 + i * 52} 402 q-2 -14 0 -26`} stroke="#2f8f4e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d={`M${28 + i * 52} 386 q-12 -4 -14 -14 q11 1 14 10z`} fill="#3aa35b" />
            <path d={`M${28 + i * 52} 380 q12 -4 14 -14 q-11 1 -14 10z`} fill="#45b267" />
          </g>
        ))}

        {/* road and truck */}
        <path d="M0 430 C180 412 380 426 560 410 L560 460 L0 460 Z" fill="#e7ece8" />
        <path d="M0 446 C180 428 380 442 560 426" stroke="#ffffff" strokeWidth="3" strokeDasharray="16 14" fill="none" opacity="0.9" />
        <g className="fdh-truck">
          <g transform="translate(0 398)">
            <rect width="74" height="34" rx="6" fill="#ffffff" stroke="#1f2937" strokeWidth="2" />
            <path d="M37 8 c-6 5 -6 13 0 17 c6 -4 6 -12 0 -17z" fill="#1f9d44" />
            <path d="M74 12 h18 l10 11 v11 h-28z" fill="#d6f2de" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
            <rect x="80" y="15" width="10" height="7" rx="1.5" fill="#9fd8f5" />
            <circle cx="18" cy="36" r="7" fill="#1f2937" /><circle cx="18" cy="36" r="2.5" fill="#cbd5e1" />
            <circle cx="88" cy="36" r="7" fill="#1f2937" /><circle cx="88" cy="36" r="2.5" fill="#cbd5e1" />
          </g>
        </g>

        {/* connection lines from the phone to each card */}
        {[
          'M210 130 C175 120 160 112 150 104',
          'M350 120 C390 110 400 100 410 96',
          'M350 230 C385 236 398 240 412 244',
          'M210 236 C178 244 164 248 150 252',
          'M236 352 C214 360 196 362 178 360',
        ].map((d, i) => (
          <path key={i} d={d} className="fdh-flow" stroke="#1f9d44" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.75" style={{ animationDelay: `${-i * 0.3}s` }} />
        ))}

        {/* phone */}
        <g className="fdh-phone">
          <rect x="208" y="58" width="144" height="300" rx="24" fill="#111827" filter="url(#fdh-shadow)" />
          <rect x="216" y="68" width="128" height="280" rx="18" fill="#f6fbf7" />
          <rect x="262" y="74" width="36" height="6" rx="3" fill="#111827" />
          {/* app header */}
          <rect x="216" y="86" width="128" height="34" fill="url(#fdh-hub)" />
          <path d="M232 95 c-5 4 -5 11 0 15 c5 -4 5 -11 0 -15z" fill="#ffffff" />
          <text x="242" y="107" fontSize="11" fontWeight="800" fill="#ffffff">FARM<tspan fill="#c9f0d4">Direct</tspan></text>
          {/* lot card */}
          <rect x="224" y="128" width="112" height="70" rx="10" fill="#ffffff" stroke="#e2efe6" />
          <circle cx="242" cy="148" r="11" fill="#fdecea" />
          <path d="M238 152 c3 -9 9 -11 11 -8 c-2 6 -6 10 -11 8z" fill="#dc2626" /><path d="M247 143 l3 -4" stroke="#2f8f4e" strokeWidth="2" strokeLinecap="round" />
          <text x="258" y="146" fontSize="9" fontWeight="700" fill="#111827">Dry Chillies</text>
          <text x="258" y="158" fontSize="7.5" fill="#6b7280">Grade A · ready</text>
          <rect x="232" y="170" width="96" height="20" rx="7" fill="#1f9d44" />
          <text x="280" y="183.5" fontSize="8.5" fontWeight="700" fill="#ffffff" textAnchor="middle">View offers</text>
          {/* price trend */}
          <rect x="224" y="206" width="112" height="72" rx="10" fill="#ffffff" stroke="#e2efe6" />
          <text x="232" y="221" fontSize="8" fontWeight="700" fill="#111827">Price trend</text>
          <path d="M232 266 L248 258 L262 262 L278 248 L292 252 L308 238 L328 232 L328 270 L232 270 Z" fill="url(#fdh-chart)" />
          <path className="fdh-draw" d="M232 266 L248 258 L262 262 L278 248 L292 252 L308 238 L328 232" stroke="#1f9d44" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="328" cy="232" r="3.5" fill="#1f9d44" />
          {/* quick icons */}
          {[['#e6f6ea', '#1f9d44'], ['#e6f1fb', '#0369a1'], ['#fdf3e2', '#b45309']].map(([bg, fg], i) => (
            <g key={i} transform={`translate(${228 + i * 38} 288)`}>
              <rect width="30" height="30" rx="9" fill={bg} />
              {i === 0 && <path d="M9 19 a6 6 0 0 1 3 -11 a5 5 0 0 1 9 3 a4 4 0 0 1 0 8z" fill={fg} />}
              {i === 1 && <path d="M7 22 v-9 l8 -5 l8 5 v9z M12 22 v-5 h6 v5" fill="none" stroke={fg} strokeWidth="2" strokeLinejoin="round" />}
              {i === 2 && <path d="M6 18 h12 v-7 h-12z M18 14 h4 l2 3 v1 h-6z" fill={fg} />}
            </g>
          ))}
          <rect x="226" y="326" width="108" height="12" rx="6" fill="#eef5f0" />
        </g>

        {/* cards */}
        {card(18, 62, 132, 66, '0s', <>
          <text x="14" y="22" fontSize="11" fontWeight="700" fill="#111827">Mandi prices</text>
          <text x="14" y="36" fontSize="8.5" fill="#6b7280">Official Agmarknet data</text>
          <path className="fdh-draw" d="M14 54 L34 48 L52 51 L72 42 L92 45 L116 34" stroke="#1f9d44" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: '-1s' }} />
        </>)}
        {card(410, 64, 132, 66, '-1.5s', <>
          <circle cx="28" cy="33" r="15" fill="#dbeafe" />
          <circle cx="28" cy="29" r="5.5" fill="#0369a1" /><path d="M18 42 a10 8 0 0 1 20 0z" fill="#0369a1" />
          <circle cx="39" cy="44" r="7" fill="#1f9d44" stroke="#ffffff" strokeWidth="2" />
          <path d="M36 44 l2 2 l4 -4" stroke="#ffffff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="52" y="30" fontSize="11" fontWeight="700" fill="#111827">Verified</text>
          <text x="52" y="44" fontSize="11" fontWeight="700" fill="#111827">buyer</text>
        </>)}
        {card(412, 212, 130, 72, '-3s', <>
          <circle cx="24" cy="24" r="12" fill="#e6f6ea" />
          <text x="24" y="28.5" fontSize="13" fontWeight="800" fill="#1f9d44" textAnchor="middle">₹</text>
          <circle className="fdh-ping" cx="112" cy="16" r="5" fill="#1f9d44" /><circle cx="112" cy="16" r="3.5" fill="#1f9d44" />
          <text x="42" y="22" fontSize="11" fontWeight="700" fill="#111827">New offer</text>
          <text x="42" y="34" fontSize="8.5" fill="#6b7280">from a buyer</text>
          <rect x="12" y="46" width="50" height="16" rx="8" fill="#1f9d44" /><text x="37" y="57" fontSize="8" fontWeight="700" fill="#ffffff" textAnchor="middle">Accept</text>
          <rect x="68" y="46" width="50" height="16" rx="8" fill="#ffffff" stroke="#cfe3d5" /><text x="93" y="57" fontSize="8" fontWeight="700" fill="#374151" textAnchor="middle">Counter</text>
        </>)}
        {card(18, 222, 132, 62, '-4.5s', <>
          <rect x="12" y="14" width="30" height="30" rx="9" fill="#e6f1fb" />
          <path d="M18 38 v-11 l9 -6 l9 6 v11z" fill="none" stroke="#0369a1" strokeWidth="2" strokeLinejoin="round" />
          <path d="M24 30 l3 -3 l3 3 M27 27 v7" stroke="#0369a1" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <text x="50" y="27" fontSize="11" fontWeight="700" fill="#111827">Cold storage</text>
          <text x="50" y="41" fontSize="8.5" fill="#6b7280">nearby · space open</text>
        </>)}
        {card(30, 326, 150, 56, '-2.2s', <>
          <circle cx="26" cy="28" r="16" fill="#1f9d44" />
          <path d="M26 16 c-5 -6 -11 -5 -13 -2 c3 4 8 4 13 2z M26 15 c4 -7 11 -7 13 -4 c-3 5 -9 5 -13 4z" fill="#bef264" />
          <rect x="15" y="20" width="22" height="17" rx="8" fill="#f4fff6" />
          <path d="M20 27 q2 -2 4 0 M28 27 q2 -2 4 0" stroke="#0f4b23" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M23 31 q3 2.5 6 0" stroke="#0f4b23" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <text x="50" y="25" fontSize="10" fontWeight="700" fill="#111827">Medha AI</text>
          <text x="50" y="38" fontSize="8.5" fill="#6b7280">Rain likely tomorrow</text>
        </>)}
      </g>
      <rect x="0.5" y="0.5" width="559" height="459" rx="27.5" fill="none" stroke="#d6eadc" />
    </svg>
  );
}

// ---------------------------------------------------------------- sections
function Section({ id, eyebrow, title, intro, children, tone = 'white' }: { id?: string; eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode; tone?: 'white' | 'muted' }) {
  return (
    <section id={id} className={`scroll-mt-20 ${tone === 'muted' ? 'bg-gray-50' : 'bg-white'}`}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-3xl">
          {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">{eyebrow}</p>}
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{title}</h2>
          {intro && <p className="mt-4 text-lg leading-relaxed text-gray-600">{intro}</p>}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: BadgeCheck, title: 'Register and verify', text: 'Create an account with your mobile number. Farmers can sell after adding their village; buyers are verified by a reviewer.', to: '/learn/create-farmer-account' },
  { icon: Tractor, title: 'Manage your farm', text: 'Add your farm, location and crops. FARMDirect builds a crop calendar for each crop.', to: '/learn/add-farm-and-crops' },
  { icon: CloudSun, title: 'Get farming guidance', text: 'Weather for your farm, stage-wise crop advice, Crop Doctor and Medha AI.', to: '/learn/weather-and-advisory' },
  { icon: PackageCheck, title: 'Prepare your produce', text: 'Record quantity, harvest date and quality. Request an inspection for a documented grade.', to: '/learn/crop-grading' },
  { icon: LineChart, title: 'Discover buyers and prices', text: 'Answer verified buyers’ requirements, receive offers and compare them by the money you receive.', to: '/learn/find-buyers-compare-offers' },
  { icon: Warehouse, title: 'Arrange storage and transport', text: 'Book verified storage near you or wait for a better price; ask verified transporters for quotes.', to: '/learn/find-nearby-storage' },
  { icon: Handshake, title: 'Complete the transaction', text: 'Both sides confirm the terms, delivery and quality are recorded, and payments are tracked to completion.', to: '/learn/track-orders-payments',
    note: 'Payments are recorded by both parties. Online collection works only when a payment provider is configured.' },
];

const FEATURES: { icon: any; title: string; points: string[]; to: string; tutorial: string }[] = [
  { icon: CloudSun, title: 'Smart farming', points: ['Weather forecast with crop-aware advice', 'Crop calendar and farm records', 'Soil, water and stage-wise advisory', 'Crop Doctor for diseases and pests', 'Satellite vegetation index (when configured)'], to: '/weather', tutorial: '/learn/weather-and-advisory' },
  { icon: Bot, title: 'Medha AI', points: ['Farming questions answered in your language', 'Uses your farm, the forecast and market data', 'Selling and storage guidance', 'Takes you to the right screen – you stay in control'], to: '/assistant', tutorial: '/learn/ask-medha-ai' },
  { icon: ShoppingBasket, title: 'Direct marketplace', points: ['Produce listings with quantity, harvest and quality', 'Requirements from verified buyers', 'Offers and counter-offers with full history', 'Every charge shown before you confirm'], to: '/market', tutorial: '/learn/create-produce-listing' },
  { icon: ShieldCheck, title: 'Trust and verification', points: ['Farmer levels and business verification', 'Recorded quality inspections and grades', 'Product authenticity checks', 'Order history, reports and disputes'], to: '/verify', tutorial: '/learn/verify-products-report' },
  { icon: Truck, title: 'Storage and logistics', points: ['Verified warehouses and cold storage near you', 'Price for your dates before you book', 'Capacity held so you are not double-booked', 'Transport quotes and delivery milestones'], to: '/storage', tutorial: '/learn/find-nearby-storage' },
  { icon: Scale, title: 'Market intelligence', points: ['Official mandi prices with dates', 'Buyer bids and completed sales', 'Estimated net amount after known costs', 'Break-even price for storing to sell later'], to: '/market?tab=prices', tutorial: '/learn/review-market-prices' },
  { icon: Landmark, title: 'Learning and government services', points: ['Step-by-step tutorials', 'Crop, pest and disease field guide', 'Government schemes with official links', 'Official crop statistics (when published by an administrator)'], to: '/learn', tutorial: '/learn' },
];

// ---------------------------------------------------------------- interactive demos (illustrative data only)
function DemoBadge() { return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Illustrative example – not live data</span>; }

function Demos() {
  const [tab, setTab] = useState<'listing' | 'offers' | 'storage' | 'medha' | 'timeline'>('offers');
  const [transport, setTransport] = useState(true);
  const offers = [
    { who: 'Buyer A (verified)', price: 2250, qty: 20, transportPaidBy: 'farmer', transport: 3000 },
    { who: 'Buyer B (verified)', price: 2180, qty: 20, transportPaidBy: 'buyer', transport: 0 },
  ];
  const tabs = [['offers', 'Compare offers'], ['listing', 'Sample listing'], ['storage', 'Storage search'], ['medha', 'Medha AI'], ['timeline', 'Order timeline']] as const;
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div role="tablist" className="flex overflow-x-auto border-b border-gray-200 bg-gray-50">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`whitespace-nowrap px-5 py-3.5 text-[15px] font-semibold ${tab === id ? 'border-b-2 border-emerald-700 bg-white text-emerald-800' : 'text-gray-600 hover:text-gray-900'}`}>{label}</button>
        ))}
      </div>
      <div className="p-6">
        <div className="mb-4"><DemoBadge /></div>
        {tab === 'offers' && (
          <div>
            <p className="text-gray-700">Two offers for 20 quintal of paddy. The higher price is not always the better deal once you count who pays transport.</p>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={transport} onChange={(e) => setTransport(e.target.checked)} />Include transport cost the farmer pays</label>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {offers.map((o) => {
                const value = o.price * o.qty;
                const cost = transport && o.transportPaidBy === 'farmer' ? o.transport : 0;
                return (
                  <div key={o.who} className="rounded-xl border border-gray-200 p-4">
                    <p className="font-semibold">{o.who}</p>
                    <p className="text-sm text-gray-600">₹{o.price.toLocaleString('en-IN')}/quintal · transport paid by {o.transportPaidBy}</p>
                    <dl className="mt-3 space-y-1 text-sm">
                      <div className="flex justify-between"><dt>Product value</dt><dd>₹{value.toLocaleString('en-IN')}</dd></div>
                      <div className="flex justify-between"><dt>Transport you pay</dt><dd>₹{cost.toLocaleString('en-IN')}</dd></div>
                      <div className="flex justify-between"><dt>Platform fee</dt><dd>₹0</dd></div>
                      <div className="flex justify-between border-t pt-1 font-bold"><dt>You receive (estimate)</dt><dd>₹{(value - cost).toLocaleString('en-IN')}</dd></div>
                    </dl>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-sm text-gray-500">In the real app, this comparison uses actual offers on your lot and shows unknown costs as unknown.</p>
          </div>
        )}
        {tab === 'listing' && (
          <div className="max-w-md rounded-xl border border-gray-200 p-4">
            <div className="flex justify-between"><p className="text-lg font-semibold">Paddy · BPT 5204</p><span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Profile verified</span></div>
            <p className="mt-1">25 quintal · <b>₹2,300/quintal</b> · negotiable</p>
            <p className="text-sm text-gray-600">Example village, Example district · harvest this week</p>
            <p className="mt-2 text-sm"><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">Grade A · inspected</span> <span className="ml-1 text-gray-500">moisture 14% (reported by farmer)</span></p>
            <p className="mt-2 text-xs text-gray-500">Buyers see the village and district – never the farmer’s phone number or address.</p>
          </div>
        )}
        {tab === 'storage' && (
          <ul className="grid gap-3 md:grid-cols-2">
            {[['Sample Warehouse 1', 6.2, 400, 20], ['Sample Cold Store 2', 14.8, 120, 45]].map(([n, km, free, rate]) => (
              <li key={n as string} className="rounded-xl border border-gray-200 p-4">
                <p className="font-semibold">{n} <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Verified</span></p>
                <p className="text-sm text-gray-600">{km} km away · {free} quintal free for your dates</p>
                <p className="text-sm">₹{rate}/quintal/month · loading and unloading shown before booking</p>
              </li>
            ))}
          </ul>
        )}
        {tab === 'medha' && (
          <div className="max-w-2xl space-y-3">
            <div className="ml-auto max-w-md rounded-2xl bg-emerald-700 px-4 py-2 text-white">Should I sell my cotton now or store it for two months?</div>
            <div className="max-w-xl rounded-2xl border bg-white px-4 py-3 text-gray-800">
              <p>Your best current offer gives about ₹1,48,000 after transport. Storing at the nearest verified warehouse for 2 months costs about ₹3,600, so prices would need to rise above roughly ₹7,600/quintal to come out ahead. Prices are not guaranteed. [source: your offers, storage rate card]</p>
              <p className="mt-2 text-sm text-gray-500">General suggestion (AI) · <span className="underline">Open selling options</span> · <span className="underline">Find storage</span></p>
            </div>
          </div>
        )}
        {tab === 'timeline' && (
          <ol className="relative space-y-4 border-l-2 border-emerald-200 pl-6">
            {['Buyer makes an offer', 'Farmer counters, buyer accepts – quantity reserved', 'Both confirm the terms and charges', 'Transport arranged, pickup recorded', 'Buyer records delivery and quality accepted', 'Buyer pays and farmer confirms receipt', 'Order completed – statement available'].map((s, i) => (
              <li key={s}><span className="absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-600" /><p className="font-medium">{i + 1}. {s}</p></li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function FAQ() {
  const items: [string, ReactNode][] = [
    ['What is FARMDirect?', 'A platform where farmers get farming guidance (weather, crop advice, Crop Doctor, Medha AI), list produce for verified buyers, and find nearby storage and transport. Buyers use it to source produce directly from farmers.'],
    ['Who can register?', 'Farmers and FPO managers, buyers (traders, wholesalers, retailers, processors, exporters, institutions and cooperatives), storage operators, transporters, and agricultural professionals. Administrator accounts are created only by a FARMDirect super administrator.'],
    ['How does farmer verification work?', 'Level 1 is your verified mobile number. Level 2 is reached when you add your state, district and village – you can then sell. Level 3 is optional: a reviewer checks any government photo ID and removes the per-order limit. Land ownership and Aadhaar are not required.'],
    ['How can buyers discover produce?', 'Buyers browse produce in Market with filters for crop, state, grade, quantity, price and distance, and can post requirements that farmers respond to. Making offers needs business verification by a reviewer.'],
    ['How can I find storage near my farm?', 'Open Storage, choose your crop, quantity and dates, and search. You see verified facilities, distance, free capacity for your dates and an estimated price, and you can request a booking.'],
    ['How do I use Medha AI?', <>Sign in and open <b>Medha AI</b> from the menu. Type or speak your question. Medha AI needs the AI service to be configured on the server; if it is not, you will see a clear notice.</>],
    ['How are market prices obtained?', 'Official mandi prices come from Agmarknet through the Government of India open data platform (data.gov.in) and show the arrival date. Buyer bids and completed sales come from FARMDirect itself. None of these are live prices.'],
    ['How can I learn to use the platform?', <>The <Link className="underline" to="/learn">Learning Centre</Link> has 15 step-by-step guides with the exact buttons to press. Most screens also have a “Listen” button.</>],
    ['What happens if a buyer or seller behaves suspiciously?', 'Use the Report link on any listing, requirement, facility or order. Reviewers investigate. Accounts can be restricted with a stated reason, and users can appeal to a different reviewer. Disputes about an order go to a resolution officer.'],
    ['Which services require verification?', 'Publishing produce needs farmer level 2. Making offers and posting requirements needs buyer business verification. Storage facilities and transporters must be approved before they can be booked. Browsing and learning do not need verification.'],
  ];
  return (
    <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
      {items.map(([q, a]) => (
        <details key={q} className="group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-gray-900">{q}<ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden /></summary>
          <div className="mt-3 text-base leading-relaxed text-gray-700">{a}</div>
        </details>
      ))}
    </div>
  );
}

export function LandingPage() {
  const featured = ['create-farmer-account', 'create-produce-listing', 'find-nearby-storage', 'ask-medha-ai', 'buyer-account', 'track-orders-payments'];
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <PublicHeader />
      <main id="main">
        {/* Hero */}
        <section className="border-b border-gray-100 bg-gradient-to-b from-emerald-50/60 to-white">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-sm font-medium text-emerald-800"><Sprout className="h-4 w-4" aria-hidden />For Indian farmers and buyers</p>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl">From your farm to the right buyer. <span className="text-emerald-700">Directly.</span></h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">FARMDirect helps farmers make informed crop decisions, discover market opportunities, connect with verified buyers, and find nearby storage and transport services – all in one place.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register/farmer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3.5 text-lg font-semibold text-white shadow-sm hover:bg-emerald-800">Get Started as a Farmer <ArrowRight className="h-5 w-5" aria-hidden /></Link>
                <Link to="/login/buyer" className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-6 py-3.5 text-lg font-semibold text-gray-900 hover:border-gray-400">Continue as a Buyer</Link>
              </div>
              <a href="#how" className="mt-5 inline-flex items-center gap-1 text-base font-semibold text-emerald-800 underline-offset-4 hover:underline">Explore how it works <ChevronDown className="h-4 w-4" aria-hidden /></a>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
                {['English, हिन्दी, తెలుగు, മലയാളം', 'Works on any phone', 'Listen-aloud on most screens'].map((t) => <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />{t}</li>)}
              </ul>
            </div>
            <div className="mx-auto w-full max-w-xl"><HeroArt /></div>
          </div>
        </section>

        {/* How it works */}
        <Section id="how" eyebrow="How it works" title="Seven steps from sowing to a completed sale" intro="Each step opens a guide that shows exactly what to press.">
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-700 text-lg font-bold text-white">{i + 1}</span><s.icon className="h-6 w-6 text-emerald-700" aria-hidden /></div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 flex-1 text-[15px] leading-relaxed text-gray-600">{s.text}</p>
                {s.note && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{s.note}</p>}
                <Link to={s.to} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800 hover:underline">Read the guide <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              </li>
            ))}
          </ol>
        </Section>

        {/* Features */}
        <Section id="features" tone="muted" eyebrow="Features" title="Everything a farm needs, connected" intro="These modules work together: your farm details feed the advice, your lots feed the price comparison, and your orders feed storage and transport.">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition hover:shadow-md">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><f.icon className="h-6 w-6" aria-hidden /></span>
                <h3 className="mt-4 text-xl font-semibold">{f.title}</h3>
                <ul className="mt-3 flex-1 space-y-2 text-[15px] text-gray-600">{f.points.map((p) => <li key={p} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{p}</li>)}</ul>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to={f.to} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Open feature</Link>
                  <Link to={f.tutorial} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">Learn more</Link>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-500">“Open feature” asks you to sign in first if you are not signed in.</p>
        </Section>

        {/* Tutorials preview */}
        <Section id="learn" eyebrow="Learning Centre" title="How to use FARMDirect" intro="Short guides with numbered steps, tips and common mistakes – written for first-time smartphone users.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TUTORIALS.filter((t) => featured.includes(t.slug)).map((t) => (
              <Link key={t.slug} to={`/learn/${t.slug}`} className="group rounded-2xl border border-gray-200 p-5 hover:border-emerald-400">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">For {t.audience === 'everyone' ? 'everyone' : `${t.audience}s`} · {t.steps.length} steps</p>
                <h3 className="mt-2 text-lg font-semibold group-hover:text-emerald-800">{t.title}</h3>
                <p className="mt-1 text-[15px] text-gray-600">{t.summary}</p>
              </Link>
            ))}
          </div>
          <Link to="/learn" className="mt-8 inline-flex items-center gap-2 rounded-xl border-2 border-emerald-700 px-5 py-3 text-base font-semibold text-emerald-800 hover:bg-emerald-50"><BookOpen className="h-5 w-5" aria-hidden />See all {TUTORIALS.length} guides</Link>
        </Section>

        {/* Demos */}
        <Section id="demo" tone="muted" eyebrow="Try it" title="See how it works before you sign in" intro="Small interactive examples with made-up numbers, so you can understand each workflow.">
          <Demos />
        </Section>

        {/* Journeys */}
        <section className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
            <div id="farmers" className="scroll-mt-20 rounded-3xl border border-emerald-200 bg-emerald-50/50 p-8">
              <Tractor className="h-10 w-10 text-emerald-700" aria-hidden />
              <h2 className="mt-4 text-3xl font-bold">For farmers</h2>
              <ol className="mt-5 space-y-3 text-base text-gray-800">
                {['Register with your mobile number – no documents needed to start', 'Add your village, farm and crops', 'Use weather, crop advice, Crop Doctor and Medha AI', 'List your produce and answer buyer requirements', 'Compare offers by the money you receive', 'Book nearby storage or arrange transport'].map((s, i) => <li key={s} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-bold text-white">{i + 1}</span>{s}</li>)}
              </ol>
              <div className="mt-6 flex flex-wrap gap-3"><Link to="/register/farmer" className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800">Register as a farmer</Link><Link to="/login/farmer" className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold">Farmer sign in</Link></div>
            </div>
            <div id="buyers" className="scroll-mt-20 rounded-3xl border border-sky-200 bg-sky-50/50 p-8">
              <ShoppingBasket className="h-10 w-10 text-sky-700" aria-hidden />
              <h2 className="mt-4 text-3xl font-bold">For buyers and businesses</h2>
              <ol className="mt-5 space-y-3 text-base text-gray-800">
                {['Register as a buyer and verify your mobile', 'Add your business details and purchasing needs', 'Upload the documents required for your business type', 'After review, browse produce and post requirements', 'Make offers and negotiate with farmers', 'Track orders, delivery, inspection and payments'].map((s, i) => <li key={s} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-700 text-sm font-bold text-white">{i + 1}</span>{s}</li>)}
              </ol>
              <p className="mt-4 text-sm text-gray-600">You can browse before verification. Offers, requirements and farmer contact details need a completed review.</p>
              <div className="mt-6 flex flex-wrap gap-3"><Link to="/register/buyer" className="rounded-xl bg-sky-700 px-5 py-3 font-semibold text-white hover:bg-sky-800">Register as a buyer</Link><Link to="/login/buyer" className="rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold">Buyer sign in</Link></div>
            </div>
          </div>
        </section>

        {/* Medha AI */}
        <Section id="medha" tone="muted" eyebrow="Medha AI" title="Your farming assistant, in your language">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-5 text-base text-gray-700">
              <div className="flex items-center gap-3"><MedhaAvatar size={64} /><p className="text-lg font-semibold text-gray-900">Namaskar! I am Medha, your farming helper.</p></div>
              <p>Medha AI answers questions using your farm details, the forecast for your location, stored mandi prices, your offers and nearby storage – and tells you where each fact came from.</p>
              <ul className="space-y-3">
                <li className="flex gap-3"><MessageCircleQuestion className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden /><span><b>Ask anything about farming:</b> crop choice, irrigation, pests, fertiliser timing, selling and storage.</span></li>
                <li className="flex gap-3"><Mic className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden /><span><b>Speak or listen:</b> voice input and read-aloud where your phone’s browser supports them. Typing always works.</span></li>
                <li className="flex gap-3"><Stethoscope className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden /><span><b>Photos:</b> for a sick plant, Medha AI sends you to Crop Doctor.</span></li>
                <li className="flex gap-3"><Lock className="h-6 w-6 shrink-0 text-emerald-700" aria-hidden /><span><b>You stay in control:</b> Medha AI suggests the next screen, but never books, sells or pays for you.</span></li>
              </ul>
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Medha AI can make mistakes. For spreading diseases, chemical use or large financial decisions, confirm with an expert – Medha AI will suggest it. It needs the AI service configured on the server.</p>
              <Link to="/assistant" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-6 py-3 text-lg font-semibold text-white hover:bg-emerald-800"><MedhaAvatar size={24} />Open Medha AI</Link>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="text-sm font-semibold text-gray-900">Questions farmers ask</p>
              <ul className="mt-3 space-y-2">
                {['Should I irrigate my paddy this week?', 'Which crop suits my black soil this rabi?', 'Yellow spots on tomato leaves – what should I do?', 'Is it better to sell now or store for two months?', 'Which scheme helps with crop insurance?', 'How do I get my produce graded?'].map((q) => <li key={q} className="rounded-xl border border-gray-200 px-4 py-3 text-[15px]">“{q}”</li>)}
              </ul>
            </div>
          </div>
        </Section>

        {/* Trust */}
        <Section id="trust" eyebrow="Trust and safety" title="Built so both sides can rely on each other" intro="These safeguards are in the app today. They reduce risk; they cannot guarantee buyers, prices or payments.">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              [BadgeCheck, 'Verified accounts', 'Farmer levels, and business verification decided by a reviewer – not just uploaded documents.'],
              [FileCheck2, 'Clear produce information', 'Quantity, harvest date, photos, and grades from recorded inspections. Farmer-reported details are labelled.'],
              [Scale, 'Transparent offers and fees', 'Every charge and who pays it is shown before anyone confirms. Default platform fee is zero.'],
              [CalendarDays, 'Traceable records', 'Offer history, order events, delivery and quality records, storage receipts and statements.'],
              [Lock, 'Private by default', 'Phone numbers are shared only after both sides confirm. Documents open only through short, logged links.'],
              [QrCode, 'Reports, disputes and appeals', 'Report suspicious activity, open a dispute with evidence, and appeal decisions to a different reviewer.'],
            ].map(([Icon, t, d]: any) => (
              <div key={t} className="rounded-2xl border border-gray-200 p-6"><Icon className="h-7 w-7 text-emerald-700" aria-hidden /><h3 className="mt-3 text-lg font-semibold">{t}</h3><p className="mt-1 text-[15px] text-gray-600">{d}</p></div>
            ))}
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq" tone="muted" eyebrow="FAQ" title="Frequently asked questions"><FAQ /></Section>

        {/* Final CTA */}
        <section className="bg-emerald-800">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
            <div><h2 className="text-3xl font-bold text-white">Ready to start?</h2><p className="mt-2 text-lg text-emerald-100">Registration takes about two minutes. Guides are here whenever you need them.</p></div>
            <div className="flex flex-wrap gap-3">
              <Link to="/register/farmer" className="rounded-xl bg-white px-6 py-3.5 text-lg font-semibold text-emerald-800 hover:bg-emerald-50">I am a farmer</Link>
              <Link to="/register/buyer" className="rounded-xl border-2 border-white px-6 py-3.5 text-lg font-semibold text-white hover:bg-emerald-700">I am a buyer</Link>
              <Link to="/learn" className="rounded-xl px-6 py-3.5 text-lg font-semibold text-white underline-offset-4 hover:underline">Read the guides</Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

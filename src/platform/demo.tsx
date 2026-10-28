import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';

const DEMO_LOGINS = [
  { who: 'Farmer', phone: '9000000001', password: 'devfarmer123' },
  { who: 'Buyer', phone: '9000000031', password: 'devbuyer123' },
  { who: 'Storage provider', phone: '9000000041', password: 'devstorage123' },
  { who: 'Admin (/admin/login)', phone: '9000000009', password: 'devadmin12345' },
];

let cached: boolean | null = null;

/** Thin banner shown only when the server runs with DEMO_MODE=on. */
export function DemoBanner() {
  const [demo, setDemo] = useState<boolean>(cached ?? false);
  useEffect(() => {
    if (cached !== null) return;
    fetch('/api/health').then((r) => r.json()).then((h) => { cached = !!h.demo; setDemo(cached); }).catch(() => { cached = false; });
  }, []);
  if (!demo) return null;
  return (
    <div role="note" className="relative z-40 bg-amber-100 px-3 py-1.5 text-center text-xs text-amber-900">
      <FlaskConical className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
      <b>Prototype – demo mode.</b> Sign-in codes appear on screen and data may reset. Use test data only.{' '}
      <details className="inline-block text-left">
        <summary className="inline cursor-pointer font-semibold underline">Demo logins</summary>
        <ul className="mt-1 rounded-lg bg-white/80 p-2 text-gray-800">
          {DEMO_LOGINS.map((l) => <li key={l.phone}>{l.who}: <b>{l.phone}</b> / <b>{l.password}</b></li>)}
        </ul>
      </details>
    </div>
  );
}

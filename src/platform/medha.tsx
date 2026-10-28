import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';

/** Medha AI's character: a friendly seedling. Original artwork drawn for FARMDirect. */
export function MedhaAvatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  const g = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Medha AI" className={className} data-keep-bright>
      <defs>
        <linearGradient id={`${g}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2fb457" />
          <stop offset="1" stopColor="#0f5f2b" />
        </linearGradient>
        <linearGradient id={`${g}leaf`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9f99d" />
          <stop offset="1" stopColor="#86d36a" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill={`url(#${g}bg)`} />
      {/* sprout */}
      <path d="M32 24 C32 19 32 16 32 13" stroke="#d9f99d" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M32 16 C27 9 19 9 16 12 C19 18 26 19 32 16 Z" fill={`url(#${g}leaf)`} />
      <path d="M32 14 C37 6 46 6 49 9 C46 16 38 17 32 14 Z" fill={`url(#${g}leaf)`} />
      {/* face */}
      <rect x="14" y="23" width="36" height="29" rx="14" fill="#f4fff6" />
      <path d="M22.5 36 q3 -3.6 6 0" stroke="#0f4b23" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M35.5 36 q3 -3.6 6 0" stroke="#0f4b23" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <circle cx="20.5" cy="41.5" r="2.4" fill="#fbb6a8" opacity="0.9" />
      <circle cx="43.5" cy="41.5" r="2.4" fill="#fbb6a8" opacity="0.9" />
      <path d="M27.5 42.5 q4.5 4 9 0" stroke="#0f4b23" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      {/* spark */}
      <path d="M52 22 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3 z" fill="#fde68a" />
    </svg>
  );
}

const HIDE_ON = ['/assistant', '/more'];

/** Floating shortcut to Medha AI, shown above the phone tab bar on every signed-in screen. */
export function FloatingMedha() {
  const loc = useLocation();
  if (HIDE_ON.some((p) => loc.pathname.startsWith(p))) return null;
  return (
    <Link to="/assistant" aria-label="Ask Medha AI"
      className="fd-pop group fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-white p-1 shadow-lg ring-1 ring-black/5 transition hover:shadow-xl lg:bottom-6 lg:right-6 lg:pr-4">
      <MedhaAvatar size={52} />
      <span className="hidden text-sm font-semibold text-gray-900 lg:inline">Ask Medha AI</span>
    </Link>
  );
}

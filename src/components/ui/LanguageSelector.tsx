import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Languages, ChevronDown, Check } from 'lucide-react';
import { Language } from '../../types';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
];

interface LanguageSelectorProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  variant?: 'glass' | 'light' | 'outline';
  className?: string;
}

export function LanguageSelector({
  language,
  onLanguageChange,
  variant = 'light',
  className = '',
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption =
    SUPPORTED_LANGUAGES.find((opt) => opt.code === language) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const variantStyles = {
    glass:
      'bg-white/20 border-white/30 text-white hover:bg-white/30 backdrop-blur-md shadow-sm',
    light:
      'bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50 shadow-sm',
    outline:
      'bg-white/90 border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm',
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id="language-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold transition-all duration-150 cursor-pointer ${variantStyles[variant]}`}
      >
        <Languages className="h-4 w-4 shrink-0" />
        <span className="font-medium">{currentOption.nativeLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 opacity-70 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            id="language-selector-dropdown"
            className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl border border-emerald-100 py-1.5 z-50 overflow-hidden"
          >
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-600 border-b border-gray-100">
              Select Language
            </div>
            <div className="py-1">
              {SUPPORTED_LANGUAGES.map((opt) => {
                const isSelected = opt.code === language;
                return (
                  <button
                    key={opt.code}
                    id={`lang-option-${opt.code}`}
                    onClick={() => {
                      onLanguageChange(opt.code);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50 font-medium'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{opt.nativeLabel}</span>
                      <span className="text-[11px] text-gray-600 font-normal">
                        {opt.label}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

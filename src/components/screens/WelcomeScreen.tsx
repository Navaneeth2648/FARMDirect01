import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sprout, Users, Shield, CircleCheckBig, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Language, UserType } from '../../types';
import { welcomeTranslations } from '../../data/translations';
import { LanguageSelector, SUPPORTED_LANGUAGES } from '../ui/LanguageSelector';

interface WelcomeScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onLogin: (type: UserType) => void;
}

export function WelcomeScreen({ language, onLanguageChange, onLogin }: WelcomeScreenProps) {
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [aadhar, setAadhar] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'select' | 'aadhar' | 'otp'>('select');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const t = welcomeTranslations[language];

  const isValidAadhar = (val: string) => {
    const cleaned = val.replace(/[\s-]/g, '');
    return /^\d{12}$/.test(cleaned);
  };

  const handleSelectRole = (role: UserType) => {
    setSelectedType(role);
    setStep('aadhar');
    setError('');
  };

  const handleVerifyAadhar = async () => {
    if (!isValidAadhar(aadhar)) {
      setError(t.invalidAadhar);
      return;
    }
    setIsVerifying(true);
    setError('');
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsVerifying(false);
    setStep('otp');
  };

  const handleCompleteLogin = () => {
    if (otp.length === 4 && selectedType) {
      onLogin(selectedType);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 relative overflow-hidden text-gray-900">
      {/* Animated ambient background floating circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-12 left-12 w-28 h-28 bg-white/10 rounded-full blur-xl"
          animate={{ y: [0, -25, 0], x: [0, 15, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-48 right-16 w-36 h-36 bg-white/10 rounded-full blur-2xl"
          animate={{ y: [0, 30, 0], x: [0, -20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-xl"
          animate={{ y: [0, -20, 0], x: [0, 12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Top right language switch */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute top-4 right-4 z-20"
      >
        <LanguageSelector
          language={language}
          onLanguageChange={onLanguageChange}
          variant="glass"
        />
      </motion.div>

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center mb-8 z-10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, duration: 0.7, type: 'spring', stiffness: 200 }}
          className="mb-4 flex justify-center"
        >
          <div className="bg-white/20 backdrop-blur-md p-5 rounded-full border border-white/30 shadow-lg">
            <Sprout className="h-14 w-14 text-white" />
          </div>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-4xl md:text-5xl font-extrabold text-white mb-2 tracking-tight drop-shadow-md"
        >
          {t.appTitle}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-lg md:text-xl text-emerald-100 font-medium max-w-md mx-auto drop-shadow"
        >
          {t.subtitle}
        </motion.p>
      </motion.div>

      {/* Main Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-white/95 backdrop-blur-md shadow-2xl border-white/50 overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div
                key="select"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25 }}
              >
                <CardContent className="p-6 md:p-8">
                  <div className="space-y-4">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={() => handleSelectRole('farmer')}
                        className="w-full h-18 bg-emerald-600 hover:bg-emerald-700 text-white text-xl flex items-center justify-center gap-3.5 font-bold shadow-md rounded-xl"
                      >
                        <Sprout className="h-7 w-7" />
                        <span>{t.farmerLogin}</span>
                      </Button>
                    </motion.div>

                    <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-200"></div>
                      <span className="flex-shrink mx-4 text-gray-500 font-bold text-sm tracking-wider uppercase">
                        {t.or}
                      </span>
                      <div className="flex-grow border-t border-gray-200"></div>
                    </div>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={() => handleSelectRole('buyer')}
                        variant="outline"
                        className="w-full h-18 border-2 border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xl flex items-center justify-center gap-3.5 font-bold shadow-md rounded-xl"
                      >
                        <Users className="h-7 w-7 text-emerald-700" />
                        <span>{t.buyerLogin}</span>
                      </Button>
                    </motion.div>

                    {/* Quick language selection pills */}
                    <div className="pt-3 border-t border-gray-100">
                      <div className="text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wider mb-2">
                        {language === 'en' ? 'Choose Language' : language === 'ml' ? 'ഭാഷ തിരഞ്ഞെടുക്കുക' : language === 'hi' ? 'भाषा चुनें' : 'భాషను ఎంచుకోండి'}
                      </div>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {SUPPORTED_LANGUAGES.map((langOpt) => (
                          <button
                            key={langOpt.code}
                            type="button"
                            id={`welcome-lang-btn-${langOpt.code}`}
                            onClick={() => onLanguageChange(langOpt.code)}
                            className={`px-3 py-1 text-xs rounded-full font-medium transition-all cursor-pointer ${
                              language === langOpt.code
                                ? 'bg-emerald-600 text-white font-bold shadow-sm ring-2 ring-emerald-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            {langOpt.nativeLabel}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </motion.div>
            )}

            {step === 'aadhar' && (
              <motion.div
                key="aadhar"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25 }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-center text-xl flex items-center justify-center gap-2 text-emerald-900">
                    <Shield className="h-5 w-5 text-emerald-600" />
                    <span>{selectedType === 'farmer' ? t.farmerLogin : t.buyerLogin}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-6 pt-2">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700">
                      {t.aadharNumber}
                    </label>
                    <Input
                      type="text"
                      placeholder={t.aadharPlaceholder}
                      value={aadhar}
                      onChange={(e) => {
                        setAadhar(e.target.value);
                        setError('');
                      }}
                      className="text-lg h-14 px-4 border-2 border-gray-300 rounded-xl text-center tracking-wider font-semibold focus:border-emerald-600"
                      maxLength={14}
                    />
                    <AnimatePresence>
                      {error && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-rose-600 text-sm mt-1.5 font-medium"
                        >
                          {error}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      onClick={handleVerifyAadhar}
                      disabled={!aadhar || isVerifying}
                      className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold shadow-md rounded-xl"
                    >
                      {isVerifying ? (
                        <>
                          <Clock className="h-5 w-5 mr-2 animate-spin" />
                          <span>{t.verifying}</span>
                        </>
                      ) : (
                        <>
                          <Shield className="h-5 w-5 mr-2" />
                          <span>{t.verifyAadhar}</span>
                        </>
                      )}
                    </Button>
                  </motion.div>

                  <Button
                    onClick={() => setStep('select')}
                    variant="ghost"
                    className="w-full text-gray-600 hover:text-gray-900 font-medium"
                  >
                    {t.back}
                  </Button>
                </CardContent>
              </motion.div>
            )}

            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.25 }}
              >
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl flex items-center justify-center gap-2 text-emerald-900">
                    <CircleCheckBig className="h-5 w-5 text-emerald-600" />
                    <span>{t.enterOTP}</span>
                  </CardTitle>
                  <p className="text-xs text-gray-600 mt-1">{t.otpSentToAadhar}</p>
                  <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                    Aadhar: ****-****-{aadhar.slice(-4) || '9012'}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 p-6 pt-2">
                  <div>
                    <Input
                      type="text"
                      placeholder="1234"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="text-2xl h-16 text-center tracking-[0.4em] font-bold border-2 border-gray-300 rounded-xl focus:border-emerald-600"
                      maxLength={4}
                    />
                  </div>

                  <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Button
                      onClick={handleCompleteLogin}
                      disabled={otp.length !== 4}
                      className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold shadow-md rounded-xl disabled:opacity-50"
                    >
                      {t.login}
                    </Button>
                  </motion.div>

                  <Button
                    onClick={() => setStep('aadhar')}
                    variant="ghost"
                    className="w-full text-gray-600 hover:text-gray-900 font-medium"
                  >
                    {t.back}
                  </Button>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* Bottom informational badge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="mt-6 text-center text-xs text-emerald-100 max-w-sm space-y-2 z-10"
      >
        <p className="opacity-90">Demo credentials: Enter any 12-digit Aadhar (e.g. 1234-5678-9012) and OTP 1234</p>
        <div className="bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl p-2.5 text-white flex items-center justify-center gap-2">
          <Shield className="h-4 w-4 text-emerald-200" />
          <span className="text-xs font-semibold">Verified Direct Farmer-to-Buyer Authentication</span>
        </div>
      </motion.div>
    </div>
  );
}

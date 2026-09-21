import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Store,
  MessageCircle,
  Shield,
  Truck,
  TrendingUp,
  Star,
  Smartphone,
  IndianRupee,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Language, User } from '../../types';
import { onboardingTranslations } from '../../data/translations';
import { LanguageSelector } from '../ui/LanguageSelector';

interface OnboardingScreenProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
  user: User;
  onComplete: () => void;
  onSkip: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Store,
  MessageCircle,
  Shield,
  Truck,
  TrendingUp,
  Star,
  Smartphone,
  IndianRupee,
};

export function OnboardingScreen({ language, onLanguageChange, user, onComplete, onSkip }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showFeaturesSummary, setShowFeaturesSummary] = useState(false);

  const t = onboardingTranslations[language];
  const steps = t.steps[user.type] || t.steps.farmer;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      setShowFeaturesSummary(true);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (showFeaturesSummary) {
      setShowFeaturesSummary(false);
    } else if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    try {
      localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
    } catch (err) {
      console.warn('LocalStorage error:', err);
    }
    onComplete();
  };

  if (showFeaturesSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-4xl"
        >
          <Card className="bg-white/95 backdrop-blur-md shadow-2xl border-0 overflow-hidden">
            <CardContent className="p-6 md:p-10">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">
                  {t.features.title}
                </h2>
                <p className="text-gray-600 text-sm md:text-base">
                  {t.subtitle}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                {t.features.items.map((feat: any, idx: number) => {
                  const IconComp = iconMap[feat.icon] || Shield;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="flex items-start space-x-4 p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 hover:bg-emerald-50 transition-colors"
                    >
                      <div className="bg-emerald-600 p-3 rounded-full flex-shrink-0 text-white shadow-sm">
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-base">{feat.title}</h3>
                        <p className="text-gray-600 text-sm mt-0.5 leading-relaxed">{feat.desc}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <Button
                  onClick={handlePrev}
                  variant="outline"
                  className="flex items-center gap-2 text-gray-700 border-gray-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>{t.previous}</span>
                </Button>

                <Button
                  onClick={handleFinish}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 px-8 font-bold shadow-md"
                >
                  <span>{t.getStarted}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const activeStep = steps[currentStep];
  const StepIcon = iconMap[activeStep.icon] || SproutPlaceholder;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl"
      >
        <Card className="bg-white/95 backdrop-blur-md shadow-2xl border-0 overflow-hidden">
          <CardContent className="p-6 md:p-10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">{t.welcome}</h1>
                <p className="text-gray-500 text-xs md:text-sm mt-0.5">{t.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                {onLanguageChange && (
                  <LanguageSelector
                    language={language}
                    onLanguageChange={onLanguageChange}
                    variant="outline"
                  />
                )}
                <Button
                  onClick={onSkip}
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                >
                  {t.skip}
                </Button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center text-xs font-semibold text-gray-500 mb-2">
                <span>Step {currentStep + 1} of {steps.length}</span>
                <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  className="bg-emerald-600 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Step Card Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center py-6"
              >
                <div className="w-24 h-24 mx-auto mb-6 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center shadow-inner">
                  <StepIcon className="h-12 w-12" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">{activeStep.title}</h2>
                <p className="text-gray-600 max-w-md mx-auto text-base leading-relaxed">
                  {activeStep.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Nav buttons */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-100">
              <Button
                onClick={handlePrev}
                disabled={currentStep === 0}
                variant="outline"
                className="flex items-center gap-1.5 text-gray-700 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{t.previous}</span>
              </Button>

              <Button
                onClick={handleNext}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 px-6 font-bold shadow-md"
              >
                <span>{isLastStep ? t.getStarted : t.next}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function SproutPlaceholder(props: { className?: string }) {
  return <Store {...props} />;
}

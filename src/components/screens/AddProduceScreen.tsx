import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Language, User, Produce } from '../../types';
import { addProduceTranslations } from '../../data/translations';
import { GOVERNMENT_PRICES, getCropImage } from '../../data/mockData';
import { LanguageSelector } from '../ui/LanguageSelector';

interface AddProduceScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  user: User;
  onBack: () => void;
  onAddProduce: (newProduce: Produce) => void;
  getTranslatedCropName: (crop: string, lang: Language) => string;
  getTranslatedVillageName: (village: string, lang: Language) => string;
}

const AVAILABLE_CROPS = [
  'Tomato',
  'Potato',
  'Onion',
  'Carrot',
  'Cabbage',
  'Cauliflower',
  'Spinach',
  'Green Beans',
  'Brinjal',
  'Okra',
  'Cucumber',
  'Chili',
  'Corn',
  'Rice',
  'Wheat',
];

export function AddProduceScreen({
  language,
  onLanguageChange,
  user,
  onBack,
  onAddProduce,
  getTranslatedCropName,
  getTranslatedVillageName,
}: AddProduceScreenProps) {
  const [cropName, setCropName] = useState<string>('Tomato');
  const [quantity, setQuantity] = useState<string>('100');
  const [pricePerKg, setPricePerKg] = useState<string>('24');
  const [location, setLocation] = useState<string>(user.village || 'Vattavada');
  const [negotiable, setNegotiable] = useState<boolean>(true);
  const [customImage, setCustomImage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const t = addProduceTranslations[language];

  // Look up APMC benchmark data
  const apmcData = GOVERNMENT_PRICES.find(
    (p) => p.cropName.toLowerCase() === cropName.toLowerCase()
  );

  const parsedPrice = parseFloat(pricePerKg) || 0;
  const parsedQuantity = parseFloat(quantity) || 0;

  // Price benchmark evaluation
  const getPriceBenchmark = () => {
    if (!apmcData || parsedPrice <= 0) return null;
    if (parsedPrice < apmcData.minPrice) {
      return {
        label: t.belowAvg || 'Below APMC Rate',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        note: 'Attracts quick buyers with competitive pricing.',
      };
    }
    if (parsedPrice > apmcData.maxPrice) {
      return {
        label: t.aboveAvg || 'Above APMC Rate',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        note: 'Ensure premium organic or Grade-A quality to justify.',
      };
    }
    return {
      label: t.fairPrice || 'Fair Market APMC Rate',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      note: 'Optimal market rate for high demand and fair profit.',
    };
  };

  const benchmark = getPriceBenchmark();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!parsedQuantity || parsedQuantity <= 0) {
      newErrors.quantity = 'Please enter a valid quantity';
    }
    if (!parsedPrice || parsedPrice <= 0) {
      newErrors.price = 'Please enter a valid price per kg';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const today = new Date().toISOString().split('T')[0];
    const newProduce: Produce = {
      id: 'prod_' + Date.now(),
      farmerId: user.id,
      farmerName: user.name,
      farmerVillage: location || user.village,
      cropName,
      quantity: parsedQuantity,
      pricePerKg: parsedPrice,
      negotiable,
      status: 'available',
      imageUrl: customImage || getCropImage(cropName),
      postedDate: today,
    };

    onAddProduce(newProduce);
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-emerald-100/40 pb-16 text-gray-900">
      {/* Top Banner */}
      <div className="bg-emerald-600 text-white p-4 md:p-6 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-emerald-700 rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t.addProduce}</h1>
          </div>

          <LanguageSelector
            language={language}
            onLanguageChange={onLanguageChange}
            variant="glass"
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8"
            >
              <Card className="shadow-xl border-emerald-200 overflow-hidden">
                <CardContent className="p-8 space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="h-12 w-12" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 mb-1">
                      {t.success}
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Your {getTranslatedCropName(cropName, language)} harvest is now live on the marketplace for all Kerala buyers.
                    </p>
                  </div>

                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-left space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Crop:</span>
                      <span className="font-bold text-gray-900">
                        {getTranslatedCropName(cropName, language)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quantity:</span>
                      <span className="font-bold text-gray-900">{quantity} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Price:</span>
                      <span className="font-bold text-emerald-700">₹{pricePerKg} / kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Lot Value:</span>
                      <span className="font-black text-gray-900">
                        ₹{(parsedQuantity * parsedPrice).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={onBack}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-md"
                  >
                    Go to Dashboard
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="shadow-md border-gray-100">
                  <CardHeader className="border-b border-gray-100 pb-4">
                    <CardTitle className="text-lg text-gray-900">Crop Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-5">
                    {/* Crop Selection */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        {t.selectCrop}
                      </label>
                      <select
                        value={cropName}
                        onChange={(e) => setCropName(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-gray-300 bg-white font-semibold text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                      >
                        {AVAILABLE_CROPS.map((crop) => (
                          <option key={crop} value={crop}>
                            {getTranslatedCropName(crop, language)} ({crop})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity & Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          {t.quantity} (kg)
                        </label>
                        <Input
                          type="number"
                          value={quantity}
                          onChange={(e) => {
                            setQuantity(e.target.value);
                            setErrors({ ...errors, quantity: '' });
                          }}
                          placeholder="e.g. 100"
                          className="h-12 text-base font-semibold"
                        />
                        {errors.quantity && (
                          <p className="text-xs text-rose-600 mt-1 font-medium">{errors.quantity}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          {t.pricePerKg}
                        </label>
                        <Input
                          type="number"
                          value={pricePerKg}
                          onChange={(e) => {
                            setPricePerKg(e.target.value);
                            setErrors({ ...errors, price: '' });
                          }}
                          placeholder="e.g. 25"
                          className="h-12 text-base font-semibold"
                        />
                        {errors.price && (
                          <p className="text-xs text-rose-600 mt-1 font-medium">{errors.price}</p>
                        )}
                      </div>
                    </div>

                    {/* Government APMC Rate Card */}
                    {apmcData && (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-700" />
                            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                              {language === 'te'
                                ? 'ఆంధ్రప్రదేశ్ APMC మార్కెట్ బెంచ్‌మార్క్'
                                : language === 'hi'
                                ? 'आंध्र प्रदेश APMC मार्केट बेंचमार्क'
                                : language === 'ml'
                                ? 'ആന്ധ്രാപ്രദേശ് APMC മാർക്കറ്റ് ബെഞ്ച്മാർക്ക്'
                                : 'Andra Pradesh APMC Market Benchmark'}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-500 font-medium">
                            {apmcData.market}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center py-1">
                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[11px] text-gray-500 block">Min Rate</span>
                            <span className="font-bold text-sm text-gray-800">₹{apmcData.minPrice}/kg</span>
                          </div>
                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[11px] text-gray-500 block">Avg Rate</span>
                            <span className="font-extrabold text-sm text-emerald-700">₹{apmcData.averagePrice}/kg</span>
                          </div>
                          <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
                            <span className="text-[11px] text-gray-500 block">Max Rate</span>
                            <span className="font-bold text-sm text-gray-800">₹{apmcData.maxPrice}/kg</span>
                          </div>
                        </div>

                        {benchmark && (
                          <div className={`p-2 rounded-lg border text-xs flex items-center justify-between ${benchmark.color}`}>
                            <span className="font-bold">{benchmark.label}</span>
                            <span className="text-[11px] opacity-90">{benchmark.note}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Location & Negotiable */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        {t.location}
                      </label>
                      <Input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Village / Town"
                        className="h-12 text-base font-semibold"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="checkbox"
                        id="negotiable"
                        checked={negotiable}
                        onChange={(e) => setNegotiable(e.target.checked)}
                        className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer"
                      />
                      <label htmlFor="negotiable" className="text-sm font-medium text-gray-800 cursor-pointer">
                        {t.negotiablePrice}
                      </label>
                    </div>

                    {/* Harvest Photo */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        {t.cropPhoto}
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex-1 flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-xl cursor-pointer bg-gray-50/50 hover:bg-emerald-50/30 transition-all">
                          <Camera className="h-7 w-7 text-gray-400 mb-1" />
                          <span className="text-xs font-semibold text-gray-600">
                            {customImage ? 'Change Harvest Photo' : t.takePhoto}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>

                        {/* Preview */}
                        <div className="w-28 h-28 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                          <img
                            src={customImage || getCropImage(cropName)}
                            alt="Crop Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Submit CTA */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>Publishing Harvest...</span>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      <span>{t.postListing}</span>
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

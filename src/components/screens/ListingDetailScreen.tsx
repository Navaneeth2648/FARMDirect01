import {
  ArrowLeft,
  MapPin,
  ShieldCheck,
  Star,
  MessageCircle,
  CreditCard,
  TrendingUp,
  Scale,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { Language, User, Produce, Screen } from '../../types';
import { listingDetailTranslations } from '../../data/translations';
import { GOVERNMENT_PRICES, MOCK_USERS } from '../../data/mockData';
import { LanguageSelector } from '../ui/LanguageSelector';

interface ListingDetailScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  produce: Produce;
  currentUser: User;
  onBack: () => void;
  onNavigate: (screen: Screen, listing?: Produce, partner?: User) => void;
  getTranslatedCropName: (crop: string, lang: Language) => string;
  getTranslatedUserName: (name: string, lang: Language) => string;
  getTranslatedVillageName: (village: string, lang: Language) => string;
}

export function ListingDetailScreen({
  language,
  onLanguageChange,
  produce,
  currentUser,
  onBack,
  onNavigate,
  getTranslatedCropName,
  getTranslatedUserName,
  getTranslatedVillageName,
}: ListingDetailScreenProps) {
  const t = listingDetailTranslations[language];

  // Find farmer profile details
  const farmerUser =
    MOCK_USERS.find((u) => u.id === produce.farmerId) || {
      id: produce.farmerId,
      name: produce.farmerName,
      phone: '+91 94471 23456',
      type: 'farmer' as const,
      village: produce.farmerVillage,
      aadharNumber: 'XXXX-XXXX-8901',
      rating: 4.8,
      totalReviews: 26,
    };

  // APMC comparison
  const apmcData = GOVERNMENT_PRICES.find(
    (p) => p.cropName.toLowerCase() === produce.cropName.toLowerCase()
  );

  const totalBatchPrice = produce.quantity * produce.pricePerKg;

  const getPriceComparisonBadge = () => {
    if (!apmcData) return null;
    if (produce.pricePerKg < apmcData.minPrice) {
      return {
        label: t.belowAvg || 'Below APMC Rate',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    }
    if (produce.pricePerKg > apmcData.maxPrice) {
      return {
        label: t.aboveAvg || 'Above APMC Rate',
        color: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    }
    return {
      label: t.fairPricing || t.atAvg || 'Fair Market Rate',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  };

  const compBadge = getPriceComparisonBadge();

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-emerald-100/40 pb-20 text-gray-900">
      {/* Top Banner */}
      <div className="bg-emerald-600 text-white p-4 md:p-6 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-emerald-700 rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {getTranslatedCropName(produce.cropName, language)}
            </h1>
          </div>

          <LanguageSelector
            language={language}
            onLanguageChange={onLanguageChange}
            variant="glass"
          />
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Main Crop Image Banner */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg aspect-[16/9] bg-gray-900">
          <ImageWithFallback
            src={produce.imageUrl}
            alt={produce.cropName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end text-white">
            <div>
              <span className="text-xs bg-emerald-600/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                {produce.status}
              </span>
              <h2 className="text-2xl md:text-3xl font-black mt-1 text-white">
                {getTranslatedCropName(produce.cropName, language)}
              </h2>
            </div>

            <div className="text-right">
              <span className="text-xs text-white/80 block">{t.price}</span>
              <span className="text-2xl md:text-3xl font-black text-emerald-300">
                ₹{produce.pricePerKg}
                <span className="text-sm font-normal text-white"> / {t.kg}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs text-gray-500 font-medium block">{t.quantity}</span>
            <span className="text-lg font-bold text-gray-900 mt-0.5 flex items-center gap-1">
              <Scale className="h-4 w-4 text-emerald-600" />
              {produce.quantity} {t.kg}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs text-gray-500 font-medium block">{t.price}</span>
            <span className="text-lg font-bold text-emerald-700 mt-0.5">
              ₹{produce.pricePerKg} / {t.kg}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs text-gray-500 font-medium block">{t.totalValue}</span>
            <span className="text-lg font-extrabold text-gray-900 mt-0.5">
              ₹{totalBatchPrice.toLocaleString()}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <span className="text-xs text-gray-500 font-medium block">{t.negotiable}</span>
            <span
              className={`text-sm font-bold mt-1 inline-block px-2 py-0.5 rounded-full ${
                produce.negotiable
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {produce.negotiable ? t.yes : t.no}
            </span>
          </div>
        </div>

        {/* Andra Pradesh APMC Price Benchmark Card */}
        {apmcData && (
          <Card className="shadow-md border-emerald-100 overflow-hidden">
            <CardHeader className="bg-emerald-50/70 border-b border-emerald-100 py-3.5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2 text-emerald-950 font-bold">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span>{t.priceComparison}</span>
                </CardTitle>
                {compBadge && (
                  <Badge variant="outline" className={`font-semibold text-xs ${compBadge.color}`}>
                    {compBadge.label}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-xs text-gray-500 block">APMC Min Rate</span>
                  <span className="text-base font-bold text-gray-800 mt-0.5 block">
                    ₹{apmcData.minPrice} / kg
                  </span>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  <span className="text-xs text-emerald-800 font-semibold block">APMC Avg Rate</span>
                  <span className="text-lg font-black text-emerald-700 mt-0.5 block">
                    ₹{apmcData.averagePrice} / kg
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl">
                  <span className="text-xs text-gray-500 block">APMC Max Rate</span>
                  <span className="text-base font-bold text-gray-800 mt-0.5 block">
                    ₹{apmcData.maxPrice} / kg
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-500 flex justify-between items-center pt-2">
                <span>
                  {language === 'te'
                    ? `బెంచ్‌మార్క్ మూలం: ఆంధ్రప్రదేశ్ వ్యవసాయ మార్కెట్ (${apmcData.market})`
                    : language === 'hi'
                    ? `बेंचमार्क स्रोत: आंध्र प्रदेश कृषि मंडी (${apmcData.market})`
                    : language === 'ml'
                    ? `ബെഞ്ച്മാർക്ക് ഉറവിടം: ആന്ധ്രാപ്രദേശ് അഗ്രികൾച്ചർ മാർക്കറ്റ് (${apmcData.market})`
                    : `Benchmark Source: Andra Pradesh Agriculture Market (${apmcData.market})`}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {apmcData.date}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Farmer Information Card */}
        <Card className="shadow-md border-gray-100">
          <CardHeader className="border-b border-gray-100 pb-3">
            <CardTitle className="text-base text-gray-900">{t.farmer}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center text-lg shadow-inner">
                  {farmerUser.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-lg">
                    {getTranslatedUserName(farmerUser.name, language)}
                  </h4>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{getTranslatedVillageName(farmerUser.village, language)}</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-amber-500 font-bold text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{farmerUser.rating || 4.8}</span>
                </div>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  ({farmerUser.totalReviews || 24} {t.reviews})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-900 font-semibold">
              <ShieldCheck className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>Aadhar Verified Farmer (Direct Cultivator in Kerala)</span>
            </div>
          </CardContent>
        </Card>

        {/* Action Controls for Buyer */}
        {currentUser.type === 'buyer' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              onClick={() => onNavigate('chat', produce, farmerUser)}
              variant="outline"
              className="h-14 border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm"
            >
              <MessageCircle className="h-5 w-5" />
              <span>{t.chatWithFarmer}</span>
            </Button>

            <Button
              onClick={() => onNavigate('payment-escrow', produce, farmerUser)}
              className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <CreditCard className="h-5 w-5" />
              <span>{t.buyNow}</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

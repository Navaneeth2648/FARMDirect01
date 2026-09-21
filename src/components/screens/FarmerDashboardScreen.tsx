import { motion } from 'motion/react';
import {
  IndianRupee,
  TrendingUp,
  Plus,
  Package,
  LogOut,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Language, User, Produce, Screen } from '../../types';
import { farmerDashTranslations } from '../../data/translations';
import { LanguageSelector } from '../ui/LanguageSelector';

interface FarmerDashboardScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  user: User;
  produce: Produce[];
  onNavigate: (screen: Screen, listing?: Produce, partner?: User) => void;
  onLogout: () => void;
  getTranslatedCropName: (crop: string, lang: Language) => string;
  getTranslatedUserName: (name: string, lang: Language) => string;
  getTranslatedVillageName: (village: string, lang: Language) => string;
}

export function FarmerDashboardScreen({
  language,
  onLanguageChange,
  user,
  produce,
  onNavigate,
  onLogout,
  getTranslatedCropName,
  getTranslatedUserName,
  getTranslatedVillageName,
}: FarmerDashboardScreenProps) {
  const t = farmerDashTranslations[language];

  // Calculate earnings
  const soldEarnings = produce
    .filter((p) => p.status === 'sold')
    .reduce((sum, p) => sum + p.quantity * p.pricePerKg, 0);

  const activeValue = produce
    .filter((p) => p.status === 'available')
    .reduce((sum, p) => sum + p.quantity * p.pricePerKg, 0);

  const totalEarnings = soldEarnings > 0 ? soldEarnings * 3 + activeValue : activeValue;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available':
        return 'success';
      case 'sold':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return t.available || 'Available';
      case 'sold':
        return t.sold || 'Sold';
      case 'pending':
        return t.pending || 'Pending';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-emerald-100/40 pb-12 text-gray-900">
      {/* Top Banner */}
      <div className="bg-emerald-600 text-white p-4 md:p-6 shadow-md">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{t.dashboard}</h1>
                <span className="text-xs bg-emerald-700/80 text-emerald-100 px-2 py-0.5 rounded-full font-medium">
                  {getTranslatedVillageName(user.village, language)}
                </span>
              </div>
              <p className="text-emerald-100 text-sm mt-0.5">
                {t.welcome}, <span className="font-semibold">{getTranslatedUserName(user.name, language)}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <LanguageSelector
                language={language}
                onLanguageChange={onLanguageChange}
                variant="glass"
              />

              <Button
                onClick={onLogout}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-emerald-700 text-xs px-2.5 h-8 gap-1 border border-emerald-500/50"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>

          {/* Earnings Stats Cards */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 mt-2">
            <div className="bg-white/15 backdrop-blur-md rounded-xl p-3.5 md:p-4 border border-white/20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-lg text-emerald-100">
                  <IndianRupee className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-emerald-100 font-medium">{t.earnings}</p>
                  <p className="text-xl md:text-2xl font-extrabold tracking-tight">
                    ₹{soldEarnings.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/15 backdrop-blur-md rounded-xl p-3.5 md:p-4 border border-white/20 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-lg text-emerald-100">
                  <TrendingUp className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-emerald-100 font-medium">{t.totalEarnings}</p>
                  <p className="text-xl md:text-2xl font-extrabold tracking-tight">
                    ₹{totalEarnings.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* Add Produce Action Button */}
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button
            onClick={() => onNavigate('add-produce')}
            className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold shadow-lg shadow-emerald-600/20 rounded-xl flex items-center justify-center gap-3"
          >
            <Plus className="h-6 w-6" />
            <span>{t.addProduce}</span>
          </Button>
        </motion.div>

        {/* My Listings Card */}
        <Card className="shadow-md border-emerald-100">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-gray-900">
              <Package className="h-5 w-5 text-emerald-600" />
              <span>{t.myListings}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-auto font-medium">
                {produce.length} {produce.length === 1 ? 'crop' : 'crops'}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4 md:p-6">
            {produce.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="h-14 w-14 mx-auto mb-3 text-emerald-200" />
                <p className="text-base font-semibold text-gray-700 mb-1">{t.noListings}</p>
                <p className="text-sm text-gray-500">{t.startSelling}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {produce.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigate('listing-detail', item)}
                    className="border border-gray-100 rounded-xl p-4 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all cursor-pointer bg-white shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <img
                        src={item.imageUrl}
                        alt={item.cropName}
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg text-gray-900">
                            {getTranslatedCropName(item.cropName, language)}
                          </h3>
                          <Badge
                            variant={getStatusBadgeVariant(item.status) as any}
                            className={
                              item.status === 'available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.status === 'sold'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }
                          >
                            {getStatusLabel(item.status)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                          <span className="font-semibold text-emerald-700">
                            ₹{item.pricePerKg} {t.perKg}
                          </span>
                          <span>•</span>
                          <span>
                            {item.quantity} {t.kg}
                          </span>
                          <span>•</span>
                          <span className="text-gray-500 text-xs flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {item.postedDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                      <div className="text-right">
                        <span className="text-xs text-gray-500 block">Total Batch Value</span>
                        <span className="text-base font-extrabold text-gray-900">
                          ₹{(item.quantity * item.pricePerKg).toLocaleString()}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      >
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Store,
  Search,
  Funnel,
  MapPin,
  MessageCircle,
  LogOut,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';
import { ImageWithFallback } from '../common/ImageWithFallback';
import { Language, User, Produce, Screen } from '../../types';
import { buyerMarketTranslations } from '../../data/translations';
import { LanguageSelector } from '../ui/LanguageSelector';

interface BuyerMarketplaceScreenProps {
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

export function BuyerMarketplaceScreen({
  language,
  onLanguageChange,
  user,
  produce,
  onNavigate,
  onLogout,
  getTranslatedCropName,
  getTranslatedUserName,
  getTranslatedVillageName,
}: BuyerMarketplaceScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [negotiableOnly, setNegotiableOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  const t = buyerMarketTranslations[language];

  const filteredProduce = useMemo(() => {
    return produce.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.cropName.toLowerCase().includes(q) ||
        item.farmerVillage.toLowerCase().includes(q) ||
        item.farmerName.toLowerCase().includes(q) ||
        getTranslatedCropName(item.cropName, language).toLowerCase().includes(q);

      const matchesNegotiable = !negotiableOnly || item.negotiable;
      const matchesPrice = maxPrice === '' || item.pricePerKg <= maxPrice;

      return matchesSearch && matchesNegotiable && matchesPrice;
    });
  }, [produce, searchQuery, negotiableOnly, maxPrice, language, getTranslatedCropName]);

  const handleOpenDetail = (item: Produce) => {
    onNavigate('listing-detail', item);
  };

  const handleQuickChat = (e: React.MouseEvent, item: Produce) => {
    e.stopPropagation();
    onNavigate('chat', item);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 to-emerald-100/40 pb-16 text-gray-900">
      {/* Top Banner */}
      <div className="bg-emerald-600 text-white p-4 md:p-6 shadow-md">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
                <Store className="h-6 w-6 text-emerald-200" />
                <span>{t.marketplace}</span>
              </h1>
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

          {/* Search bar & filter toggle */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search}
                className="pl-11 bg-white text-gray-900 h-12 text-base rounded-xl shadow-sm border-0 focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <Button
              onClick={() => setShowFilter(!showFilter)}
              variant="outline"
              className={`bg-white text-emerald-700 border-0 hover:bg-emerald-50 h-12 px-4 rounded-xl shadow-sm ${
                showFilter ? 'ring-2 ring-emerald-300 bg-emerald-50' : ''
              }`}
            >
              <Funnel className="h-5 w-5" />
            </Button>
          </div>

          {/* Filter expansion drawer */}
          {showFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-emerald-700/60 backdrop-blur-md rounded-xl p-3.5 mt-3 border border-emerald-500/40 text-sm space-y-2"
            >
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-white font-medium">
                  <input
                    type="checkbox"
                    checked={negotiableOnly}
                    onChange={(e) => setNegotiableOnly(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 h-4 w-4"
                  />
                  <span>Negotiable Only</span>
                </label>

                <div className="flex items-center gap-2 text-white">
                  <span>Max ₹/kg:</span>
                  <input
                    type="number"
                    placeholder="e.g. 30"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-20 px-2 py-1 rounded bg-white text-gray-900 text-xs font-semibold focus:outline-none"
                  />
                </div>

                {(negotiableOnly || maxPrice !== '') && (
                  <button
                    onClick={() => {
                      setNegotiableOnly(false);
                      setMaxPrice('');
                    }}
                    className="text-xs text-emerald-200 underline hover:text-white ml-auto"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{t.freshProduce}</h2>
            <p className="text-gray-500 text-xs md:text-sm">
              {filteredProduce.length} {filteredProduce.length === 1 ? 'item' : 'items'} available directly from Kerala farms
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-100/70 px-3 py-1.5 rounded-full font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Escrow Protected</span>
          </div>
        </div>

        {filteredProduce.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Store className="h-16 w-16 mx-auto text-gray-300 mb-3" />
            <h3 className="text-lg font-bold text-gray-700 mb-1">{t.noResults}</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">{t.tryDifferent}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProduce.map((item) => (
              <Card
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className="overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer border-gray-100 group flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[16/10] relative overflow-hidden bg-gray-100">
                    <ImageWithFallback
                      src={item.imageUrl}
                      alt={item.cropName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    <Badge className="absolute top-2.5 right-2.5 bg-emerald-600 text-white font-bold shadow-sm">
                      {t.available}
                    </Badge>

                    <button
                      onClick={(e) => handleQuickChat(e, item)}
                      title="Quick Chat with Farmer"
                      className="absolute top-2.5 left-2.5 bg-blue-600/90 hover:bg-blue-700 text-white p-2 rounded-lg backdrop-blur-sm shadow-md transition-transform hover:scale-110"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                  </div>

                  <CardContent className="p-4 space-y-3">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
                          {getTranslatedCropName(item.cropName, language)}
                        </h3>
                        {item.negotiable && (
                          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Negotiable
                          </span>
                        )}
                      </div>

                      <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{t.from} {getTranslatedVillageName(item.farmerVillage, language)}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-xs text-gray-400 block">{t.available}</span>
                        <span className="text-sm font-semibold text-gray-700">
                          {item.quantity} {t.kg}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-gray-400 block">{t.perKg}</span>
                        <span className="text-xl font-black text-emerald-700">
                          ₹{item.pricePerKg}
                          <span className="text-xs font-medium text-gray-500"> / {t.kg}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                      <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-medium text-gray-700">
                        {getTranslatedUserName(item.farmerName, language)}
                      </span>
                    </div>
                  </CardContent>
                </div>

                <div className="p-4 pt-0">
                  <Button
                    onClick={() => handleOpenDetail(item)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 text-sm shadow-sm"
                  >
                    {t.viewDetails}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

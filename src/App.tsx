import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { Language, User, Produce, Screen, UserType } from './types';
import {
  MOCK_USERS,
  INITIAL_PRODUCE,
} from './data/mockData';
import {
  getCropTranslation,
  getNameTranslation,
  getVillageTranslation,
} from './data/translations';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { OnboardingScreen } from './components/screens/OnboardingScreen';
import { FarmerDashboardScreen } from './components/screens/FarmerDashboardScreen';
import { BuyerMarketplaceScreen } from './components/screens/BuyerMarketplaceScreen';
import { AddProduceScreen } from './components/screens/AddProduceScreen';
import { ListingDetailScreen } from './components/screens/ListingDetailScreen';
import { ChatScreen } from './components/screens/ChatScreen';
import { PaymentEscrowScreen } from './components/screens/PaymentEscrowScreen';
import { DeliveryConfirmationScreen } from './components/screens/DeliveryConfirmationScreen';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  // Language state (persisted)
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('fc_language');
      return saved === 'ml' || saved === 'en' || saved === 'hi' || saved === 'te' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang);
    try {
      localStorage.setItem('fc_language', newLang);
    } catch (err) {
      console.warn('Storage error:', err);
    }
  };

  // User and Screen state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('fc_current_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');

  // Produce inventory state
  const [produceList, setProduceList] = useState<Produce[]>(() => {
    try {
      const saved = localStorage.getItem('fc_produce_list');
      return saved ? JSON.parse(saved) : INITIAL_PRODUCE;
    } catch {
      return INITIAL_PRODUCE;
    }
  });

  // Navigation contexts
  const [selectedListing, setSelectedListing] = useState<Produce | null>(null);
  const [chatPartner, setChatPartner] = useState<User | null>(null);
  const [agreedChatPrice, setAgreedChatPrice] = useState<number | undefined>(undefined);
  const [activeOrderData, setActiveOrderData] = useState<{
    orderId: string;
    produce: Produce;
    totalAmount: number;
    unitPrice: number;
  } | null>(null);

  // Online / Offline monitor
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Save produce list changes
  useEffect(() => {
    try {
      localStorage.setItem('fc_produce_list', JSON.stringify(produceList));
    } catch (err) {
      console.warn('Storage error:', err);
    }
  }, [produceList]);

  // Handle Login
  const handleLogin = (userType: UserType) => {
    // Select default mock user matching userType
    const user =
      MOCK_USERS.find((u) => u.type === userType) || {
        id: userType === 'farmer' ? 'farmer_1' : 'buyer_1',
        name: userType === 'farmer' ? 'Ramesh Kumar' : 'Manju Suresh',
        phone: '+91 94471 23456',
        type: userType,
        village: userType === 'farmer' ? 'Vattavada' : 'Kochi',
        aadharNumber: 'XXXX-XXXX-9012',
        rating: 4.8,
        totalReviews: 24,
      };

    setCurrentUser(user);
    try {
      localStorage.setItem('fc_current_user', JSON.stringify(user));
    } catch (err) {
      console.warn('Storage error:', err);
    }

    // Check if user has completed onboarding before
    let hasCompletedOnboarding = false;
    try {
      hasCompletedOnboarding =
        localStorage.getItem(`onboarding_completed_${user.id}`) === 'true';
    } catch {
      hasCompletedOnboarding = false;
    }

    if (!hasCompletedOnboarding) {
      setCurrentScreen('onboarding');
    } else {
      setCurrentScreen(userType === 'farmer' ? 'farmer-dashboard' : 'buyer-marketplace');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedListing(null);
    setChatPartner(null);
    try {
      localStorage.removeItem('fc_current_user');
    } catch (err) {
      console.warn('Storage error:', err);
    }
    setCurrentScreen('welcome');
  };

  const handleOnboardingComplete = () => {
    if (currentUser?.type === 'farmer') {
      setCurrentScreen('farmer-dashboard');
    } else {
      setCurrentScreen('buyer-marketplace');
    }
  };

  const handleNavigate = useCallback(
    (screen: Screen, listing?: Produce, partner?: User) => {
      if (listing) {
        setSelectedListing(listing);
      }
      if (partner) {
        setChatPartner(partner);
      }
      setCurrentScreen(screen);
    },
    []
  );

  const handleAddProduce = (newProduce: Produce) => {
    setProduceList((prev) => [newProduce, ...prev]);
  };

  const handlePaymentSuccess = (orderData: {
    orderId: string;
    produce: Produce;
    totalAmount: number;
    unitPrice: number;
  }) => {
    setActiveOrderData(orderData);
    // Mark listing as pending or sold
    setProduceList((prev) =>
      prev.map((item) =>
        item.id === orderData.produce.id ? { ...item, status: 'pending' } : item
      )
    );
    setCurrentScreen('delivery-confirmation');
  };

  const handleDeliveryFinished = () => {
    if (activeOrderData) {
      // Mark listing as completely sold
      setProduceList((prev) =>
        prev.map((item) =>
          item.id === activeOrderData.produce.id ? { ...item, status: 'sold' } : item
        )
      );
    }
    setActiveOrderData(null);
    setSelectedListing(null);
    if (currentUser?.type === 'farmer') {
      setCurrentScreen('farmer-dashboard');
    } else {
      setCurrentScreen('buyer-marketplace');
    }
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 relative selection:bg-emerald-500 selection:text-white">
        {/* Offline indicator banner */}
        {!isOnline && (
          <div className="bg-amber-600 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 sticky top-0 z-50">
            <WifiOff className="h-4 w-4" />
            <span>You are currently offline. Cached listings and demo functions remain active.</span>
          </div>
        )}

        {/* Screen Routing with smooth transitions */}
        <AnimatePresence mode="wait">
          {currentScreen === 'welcome' && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <WelcomeScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                onLogin={handleLogin}
              />
            </motion.div>
          )}

          {currentScreen === 'onboarding' && currentUser && (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <OnboardingScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                user={currentUser}
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingComplete}
              />
            </motion.div>
          )}

          {currentScreen === 'farmer-dashboard' && currentUser && (
            <motion.div
              key="farmer-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <FarmerDashboardScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                user={currentUser}
                produce={produceList.filter((p) => p.farmerId === currentUser.id)}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                getTranslatedCropName={getCropTranslation}
                getTranslatedUserName={getNameTranslation}
                getTranslatedVillageName={getVillageTranslation}
              />
            </motion.div>
          )}

          {currentScreen === 'buyer-marketplace' && currentUser && (
            <motion.div
              key="buyer-marketplace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <BuyerMarketplaceScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                user={currentUser}
                produce={produceList}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
                getTranslatedCropName={getCropTranslation}
                getTranslatedUserName={getNameTranslation}
                getTranslatedVillageName={getVillageTranslation}
              />
            </motion.div>
          )}

          {currentScreen === 'add-produce' && currentUser && (
            <motion.div
              key="add-produce"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <AddProduceScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                user={currentUser}
                onBack={() => setCurrentScreen('farmer-dashboard')}
                onAddProduce={handleAddProduce}
                getTranslatedCropName={getCropTranslation}
                getTranslatedVillageName={getVillageTranslation}
              />
            </motion.div>
          )}

          {currentScreen === 'listing-detail' && selectedListing && currentUser && (
            <motion.div
              key="listing-detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ListingDetailScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                produce={selectedListing}
                currentUser={currentUser}
                onBack={() => {
                  if (currentUser.type === 'farmer') {
                    setCurrentScreen('farmer-dashboard');
                  } else {
                    setCurrentScreen('buyer-marketplace');
                  }
                }}
                onNavigate={handleNavigate}
                getTranslatedCropName={getCropTranslation}
                getTranslatedUserName={getNameTranslation}
                getTranslatedVillageName={getVillageTranslation}
              />
            </motion.div>
          )}

          {currentScreen === 'chat' && selectedListing && currentUser && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ChatScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                produce={selectedListing}
                currentUser={currentUser}
                partnerUser={chatPartner || undefined}
                onBack={() => {
                  if (selectedListing) {
                    setCurrentScreen('listing-detail');
                  } else if (currentUser.type === 'farmer') {
                    setCurrentScreen('farmer-dashboard');
                  } else {
                    setCurrentScreen('buyer-marketplace');
                  }
                }}
                onNavigateToPayment={(produce, agreedPrice) => {
                  setSelectedListing(produce);
                  setAgreedChatPrice(agreedPrice);
                  setCurrentScreen('payment-escrow');
                }}
                getTranslatedCropName={getCropTranslation}
                getTranslatedUserName={getNameTranslation}
              />
            </motion.div>
          )}

          {currentScreen === 'payment-escrow' && selectedListing && currentUser && (
            <motion.div
              key="payment-escrow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <PaymentEscrowScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                produce={selectedListing}
                buyer={currentUser}
                agreedPrice={agreedChatPrice}
                onBack={() => setCurrentScreen('listing-detail')}
                onPaymentSuccess={handlePaymentSuccess}
                getTranslatedCropName={getCropTranslation}
                getTranslatedUserName={getNameTranslation}
              />
            </motion.div>
          )}

          {currentScreen === 'delivery-confirmation' && activeOrderData && currentUser && (
            <motion.div
              key="delivery-confirmation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <DeliveryConfirmationScreen
                language={language}
                onLanguageChange={handleLanguageChange}
                orderData={activeOrderData}
                buyer={currentUser}
                onFinish={handleDeliveryFinished}
                getTranslatedCropName={getCropTranslation}
                getTranslatedUserName={getNameTranslation}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

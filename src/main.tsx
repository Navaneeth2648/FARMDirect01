import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, homeFor, STAFF_ROLES, useAuth, type Role } from './platform/auth';
import { ToastProvider, Skeleton } from './platform/ui';
import { Layout } from './platform/Layout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import {
  AdminLoginPage, BuyerLoginPage, BuyerRegisterPage, FarmerLoginPage, FarmerRegisterPage, ForgotPage, LoginChooser, PartnerRegisterPage,
} from './platform/pages/AuthPages';
import { DemoBanner } from './platform/demo';

const page = (load: () => Promise<any>, name: string) => lazy<React.ComponentType<any>>(() => load().then((m) => ({ default: m[name] })));
const Onboarding = page(() => import('./platform/pages/Onboarding'), 'OnboardingPage');
const Dashboard = page(() => import('./platform/pages/Dashboard'), 'DashboardPage');
const Farm = page(() => import('./platform/pages/Farm'), 'FarmPage');
const Weather = page(() => import('./platform/pages/Weather'), 'WeatherPage');
const CropDoctor = page(() => import('./platform/pages/CropDoctor'), 'CropDoctorPage');
const DiagnosisDetail = page(() => import('./platform/pages/CropDoctor'), 'DiagnosisDetailPage');
const Advisory = page(() => import('./platform/pages/Advisory'), 'AdvisoryPage');
const Assistant = page(() => import('./platform/pages/Assistant'), 'AssistantPage');
const Mandi = page(() => import('./platform/pages/Mandi'), 'MandiPage');
const Calendar = page(() => import('./platform/pages/Calendar'), 'CalendarPage');
const Operations = page(() => import('./platform/pages/Operations'), 'OperationsPage');
const SoilWater = page(() => import('./platform/pages/SoilWater'), 'SoilWaterPage');
const SatellitePage = page(() => import('./platform/pages/Satellite'), 'SatellitePage');
const Alerts = page(() => import('./platform/pages/Alerts'), 'AlertsPage');
const Products = page(() => import('./platform/pages/Products'), 'ProductsPage');
const ProductDetail = page(() => import('./platform/pages/Products'), 'ProductDetailPage');
const Verify = page(() => import('./platform/pages/Verify'), 'VerifyPage');
const Schemes = page(() => import('./platform/pages/Schemes'), 'SchemesPage');
const Knowledge = page(() => import('./platform/pages/Knowledge'), 'KnowledgePage');
const ContentDetail = page(() => import('./platform/pages/Knowledge'), 'ContentDetailPage');
const Experts = page(() => import('./platform/pages/Experts'), 'ExpertsPage');
const CaseDetail = page(() => import('./platform/pages/Experts'), 'CaseDetailPage');
const Community = page(() => import('./platform/pages/Community'), 'CommunityPage');
const PostDetail = page(() => import('./platform/pages/Community'), 'PostDetailPage');
const Notifications = page(() => import('./platform/pages/Notifications'), 'NotificationsPage');
const Saved = page(() => import('./platform/pages/Notifications'), 'SavedPage');
const Settings = page(() => import('./platform/pages/Settings'), 'SettingsPage');
const ExpertDesk = page(() => import('./platform/pages/ExpertDesk'), 'ExpertDeskPage');
const Admin = page(() => import('./platform/pages/Admin'), 'AdminPage');
const Sell = page(() => import('./platform/pages/Sell'), 'SellPage');
const SellWizard = page(() => import('./platform/pages/Sell'), 'SellWizardPage');
const LotManage = page(() => import('./platform/pages/Sell'), 'LotManagePage');
const Market = page(() => import('./platform/pages/Market'), 'MarketPage');
const LotDetail = page(() => import('./platform/pages/Market'), 'LotDetailPage');
const DemandDetail = page(() => import('./platform/pages/Market'), 'DemandDetailPage');
const Trade = page(() => import('./platform/pages/Trade'), 'TradePage');
const Thread = page(() => import('./platform/pages/Trade'), 'ThreadPage');
const Order = page(() => import('./platform/pages/Trade'), 'OrderPage');
const Statement = page(() => import('./platform/pages/Trade'), 'StatementPage');
const Dispute = page(() => import('./platform/pages/Trade'), 'DisputePage');
const TransportRequest = page(() => import('./platform/pages/Trade'), 'TransportRequestPage');
const Storage = page(() => import('./platform/pages/Storage'), 'StoragePage');
const Facility = page(() => import('./platform/pages/Storage'), 'FacilityPage');
const Booking = page(() => import('./platform/pages/Storage'), 'BookingPage');
const StorageProvider = page(() => import('./platform/pages/Storage'), 'StorageProviderPage');
const TransportProvider = page(() => import('./platform/pages/Storage'), 'TransportProviderPage');
const BuyerHome = page(() => import('./platform/pages/Buyer'), 'BuyerHomePage');
const BuyerVerification = page(() => import('./platform/pages/Buyer'), 'BuyerVerificationPage');
const BuyerDemand = page(() => import('./platform/pages/Buyer'), 'BuyerDemandPage');
const AccountVerification = page(() => import('./platform/pages/Buyer'), 'AccountVerificationPage');
const LegacyMarketplace = lazy(() => import('./App'));
const Landing = page(() => import('./platform/pages/Landing'), 'LandingPage');
const LearnIndex = page(() => import('./platform/pages/Learn'), 'LearnIndexPage');
const LearnGuide = page(() => import('./platform/pages/Learn'), 'LearnGuidePage');
const Grading = page(() => import('./platform/pages/Grading'), 'GradingPage');
const Guides = page(() => import('./platform/pages/Guides'), 'GuidesPage');
const GuideDetail = page(() => import('./platform/pages/Guides'), 'GuideDetailPage');
const Statistics = page(() => import('./platform/pages/Guides'), 'StatisticsPage');
const Businesses = page(() => import('./platform/pages/Business'), 'BusinessesPage');
const Inputs = page(() => import('./platform/pages/Business'), 'InputsPage');
const More = page(() => import('./platform/pages/More'), 'MorePage');

function Protected({ children, roles }: { children: React.ReactNode; roles?: Role[] }) {
  const { user, loading, hasRole } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8"><Skeleton lines={4} /></div>;
  // Visitors see the public homepage at "/"; every other protected page asks them to sign in.
  if (!user) return loc.pathname === '/' ? <Landing /> : <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  if (!user.onboarding_complete && user.role === 'farmer' && loc.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation() as any;
  if (loading) return null;
  return user ? <Navigate to={loc.state?.from || homeFor(user)} replace /> : <>{children}</>;
}

/** The farmer dashboard is home for farm users; buyers, partners and administrators land on their own workspace. */
function Home() {
  const { user } = useAuth();
  const target = homeFor(user);
  return target === '/' ? <Dashboard /> : <Navigate to={target} replace />;
}

const fallback = <div className="p-6"><Skeleton lines={5} /></div>;
const SELLERS: Role[] = ['farmer', 'fpo_manager'];

function AppRoutes() {
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/welcome" element={<Landing />} />
        <Route path="/learn" element={<LearnIndex />} />
        <Route path="/learn/:slug" element={<LearnGuide />} />
        <Route path="/login" element={<GuestOnly><LoginChooser /></GuestOnly>} />
        <Route path="/login/farmer" element={<GuestOnly><FarmerLoginPage /></GuestOnly>} />
        <Route path="/login/buyer" element={<GuestOnly><BuyerLoginPage /></GuestOnly>} />
        <Route path="/admin/login" element={<GuestOnly><AdminLoginPage /></GuestOnly>} />
        <Route path="/register" element={<Navigate to="/register/farmer" replace />} />
        <Route path="/register/farmer" element={<GuestOnly><FarmerRegisterPage /></GuestOnly>} />
        <Route path="/register/buyer" element={<GuestOnly><BuyerRegisterPage /></GuestOnly>} />
        <Route path="/register/partner" element={<GuestOnly><PartnerRegisterPage /></GuestOnly>} />
        <Route path="/forgot" element={<GuestOnly><ForgotPage /></GuestOnly>} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
        {/* The earlier browser-only marketplace prototype, kept for reference; real trading is at /market. */}
        <Route path="/marketplace" element={<Navigate to="/market" replace />} />
        <Route path="/marketplace/legacy/*" element={<Protected>
          <div className="bg-amber-700 px-4 py-2 text-sm text-white">
            <a href="/market" className="font-semibold underline">← Go to the real marketplace</a>
            <span className="ml-2 opacity-90">This is the old prototype with demo data stored only in this browser. Nothing here is a real listing or payment.</span>
          </div>
          <LegacyMarketplace />
        </Protected>} />
        <Route path="/trade/orders/:id/statement" element={<Protected><Statement /></Protected>} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route index element={<Home />} />
          <Route path="farm" element={<Farm />} />
          <Route path="weather" element={<Weather />} />
          <Route path="crop-doctor" element={<CropDoctor />} />
          <Route path="crop-doctor/:id" element={<DiagnosisDetail />} />
          <Route path="advisory" element={<Advisory />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="mandi" element={<Mandi />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="operations" element={<Operations />} />
          <Route path="soil-water" element={<SoilWater />} />
          <Route path="satellite" element={<SatellitePage />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="verify" element={<Verify />} />
          <Route path="grading" element={<Grading />} />
          <Route path="guides" element={<Guides />} />
          <Route path="guides/:id" element={<GuideDetail />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="businesses" element={<Businesses />} />
          <Route path="inputs" element={<Inputs />} />
          <Route path="more" element={<More />} />
          <Route path="schemes" element={<Schemes />} />
          <Route path="knowledge" element={<Knowledge kind="knowledge" />} />
          <Route path="knowledge/:id" element={<ContentDetail />} />
          <Route path="news" element={<Knowledge kind="news" />} />
          <Route path="experts" element={<Experts />} />
          <Route path="experts/cases/:id" element={<CaseDetail />} />
          <Route path="community" element={<Community />} />
          <Route path="community/:id" element={<PostDetail />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="saved" element={<Saved />} />
          <Route path="settings" element={<Settings />} />
          <Route path="account/verification" element={<AccountVerification />} />
          {/* Marketplace */}
          <Route path="sell" element={<Protected roles={SELLERS}><Sell /></Protected>} />
          <Route path="sell/new" element={<Protected roles={SELLERS}><SellWizard /></Protected>} />
          <Route path="sell/:id" element={<Protected roles={SELLERS}><LotManage /></Protected>} />
          <Route path="market" element={<Market />} />
          <Route path="market/lots/:id" element={<LotDetail />} />
          <Route path="market/demand/:id" element={<DemandDetail />} />
          <Route path="trade" element={<Trade />} />
          <Route path="trade/threads/:threadId" element={<Thread />} />
          <Route path="trade/orders/:id" element={<Order />} />
          <Route path="trade/disputes/:id" element={<Dispute />} />
          <Route path="trade/transport/:id" element={<TransportRequest />} />
          <Route path="storage" element={<Storage />} />
          <Route path="storage/facilities/:id" element={<Facility />} />
          <Route path="storage/bookings/:id" element={<Booking />} />
          <Route path="storage/provider" element={<Protected roles={['storage_provider']}><StorageProvider /></Protected>} />
          <Route path="transport/provider" element={<Protected roles={['transport_provider']}><TransportProvider /></Protected>} />
          <Route path="buyer" element={<Protected roles={['buyer']}><BuyerHome /></Protected>} />
          <Route path="buyer/verification" element={<Protected roles={['buyer']}><BuyerVerification /></Protected>} />
          <Route path="buyer/demand" element={<Protected roles={['buyer']}><BuyerDemand /></Protected>} />
          <Route path="expert-desk" element={<Protected roles={['expert', 'field_agent', 'admin', 'content_editor']}><ExpertDesk /></Protected>} />
          <Route path="admin" element={<Protected roles={STAFF_ROLES}><Admin /></Protected>} />
          <Route path="*" element={<div className="p-6 text-center"><h1 className="text-xl font-semibold">Page not found</h1></div>} />
        </Route>
      </Routes>
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <DemoBanner />
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}



import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';

// Components (Keep distinct for fast access)
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatBot } from './components/ChatBot';
import { PrivateRoute } from './components/PrivateRoute';
import { InactivityMonitor } from './components/InactivityMonitor';
import { KeyboardShortcutsProvider } from './components/KeyboardShortcutsProvider';
import { GlobalSearchModal } from './components/GlobalSearchModal';

// Lazy Load Screens (Code Splitting)
const Dashboard = React.lazy(() => import('./screens/Dashboard').then(m => ({ default: m.Dashboard })));
const PortfolioScreen = React.lazy(() => import('./screens/PortfolioScreen').then(m => ({ default: m.PortfolioScreen })));
const MarketAnalysis = React.lazy(() => import('./screens/MarketAnalysis').then(m => ({ default: m.MarketAnalysis })));
const ManualEntry = React.lazy(() => import('./screens/ManualEntry').then(m => ({ default: m.ManualEntry })));
const NewsScreen = React.lazy(() => import('./screens/NewsScreen').then(m => ({ default: m.NewsScreen })));
const ReportsScreen = React.lazy(() => import('./screens/ReportsScreen').then(m => ({ default: m.ReportsScreen })));
const ProfileScreen = React.lazy(() => import('./screens/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const AlertsScreen = React.lazy(() => import('./screens/AlertsScreen').then(m => ({ default: m.AlertsScreen })));
const WatchlistsScreen = React.lazy(() => import('./screens/WatchlistsScreen').then(m => ({ default: m.WatchlistsScreen })));
const LoginScreen = React.lazy(() => import('./screens/LoginScreen').then(m => ({ default: m.LoginScreen })));
const RegisterScreen = React.lazy(() => import('./screens/RegisterScreen').then(m => ({ default: m.RegisterScreen })));
const RiskVisualScreen = React.lazy(() => import('./screens/RiskVisualScreen').then(m => ({ default: m.RiskVisualScreen })));
const AdminScreen = React.lazy(() => import('./screens/AdminScreen').then(m => ({ default: m.AdminScreen })));
const ImportersScreen = React.lazy(() => import('./screens/ImportersScreen').then(m => ({ default: m.ImportersScreen })));
const NotificationChannelsScreen = React.lazy(() => import('./screens/NotificationChannelsScreen').then(m => ({ default: m.NotificationChannelsScreen })));
const CalendarScreen = React.lazy(() => import('./screens/CalendarScreen').then(m => ({ default: m.CalendarScreen })));
const StopAlertScreen = React.lazy(() => import('./screens/StopAlertScreen').then(m => ({ default: m.StopAlertScreen })));
const ResetPasswordScreen = React.lazy(() => import('./screens/ResetPasswordScreen').then(m => ({ default: m.ResetPasswordScreen })));

// Loading Component
const PageLoading = () => (
  <div className="flex items-center justify-center h-full w-full bg-background-light dark:bg-background-dark">
    <div className="flex flex-col items-center gap-4">
      <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm font-bold text-text-muted animate-pulse">Cargando módulo...</p>
    </div>
  </div>
);

const MainLayout: React.FC = () => {
  return (
    <KeyboardShortcutsProvider>
      <div className="flex w-full h-screen overflow-hidden bg-background-light dark:bg-background-dark transition-colors duration-300">
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">

          {/* Unified Header (Sticky) */}
          <Header />

          {/* Scrollable Content */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-0 relative">
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/portfolio" element={<PortfolioScreen />} />
                <Route path="/market" element={<MarketAnalysis />} />
                <Route path="/manual-entry" element={<ManualEntry />} />
                <Route path="/risk-vis" element={<RiskVisualScreen />} />
                <Route path="/news" element={<NewsScreen />} />
                <Route path="/reports" element={<ReportsScreen />} />
                <Route path="/profile" element={<ProfileScreen />} />
                <Route path="/watchlists" element={<WatchlistsScreen />} />
                <Route path="/alerts" element={<AlertsScreen />} />
                <Route path="/admin" element={<AdminScreen />} />
                <Route path="/importers" element={<ImportersScreen />} />
                <Route path="/notifications" element={<NotificationChannelsScreen />} />
                <Route path="/calendar" element={<CalendarScreen />} />
              </Routes>
            </Suspense>
          </main>

          <ChatBot />
        </div>

        <InactivityMonitor timeoutMinutes={30} warningMinutes={2} />
        <GlobalSearchModal />
      </div>
    </KeyboardShortcutsProvider>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <ToastProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<RegisterScreen />} />
          <Route path="/reset-password" element={<ResetPasswordScreen />} />
          <Route path="/stop-alert/:token" element={<StopAlertScreen />} />

          {/* Protected Routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/chat" element={<div className="w-screen h-screen"><ChatBot embedded={true} /></div>} />
            <Route path="/*" element={<MainLayout />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </Router>
  );
};

export default App;


import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { Dashboard } from './screens/Dashboard';
import { PortfolioScreen } from './screens/PortfolioScreen';
import { MarketAnalysis } from './screens/MarketAnalysis';
import { ManualEntry } from './screens/ManualEntry';
import { NewsScreen } from './screens/NewsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { AlertsScreen } from './screens/AlertsScreen';
import { WatchlistsScreen } from './screens/WatchlistsScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { RiskVisualScreen } from './screens/RiskVisualScreen';
import { AdminScreen } from './screens/AdminScreen';
import { ImportersScreen } from './screens/ImportersScreen';
import { NotificationChannelsScreen } from './screens/NotificationChannelsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { StopAlertScreen } from './screens/StopAlertScreen';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header'; // Hoisted Header
import { ChatBot } from './components/ChatBot';
import { PrivateRoute } from './components/PrivateRoute';
import { InactivityMonitor } from './components/InactivityMonitor';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { KeyboardShortcutsProvider } from './components/KeyboardShortcutsProvider';
import { GlobalSearchModal } from './components/GlobalSearchModal';

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

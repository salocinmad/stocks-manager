
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import { Sidebar } from './components/Sidebar';
import { ChatBot } from './components/ChatBot';
import { PrivateRoute } from './components/PrivateRoute';

const MainLayout: React.FC = () => {
  return (
    <div className="flex w-full h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden relative scroll-smooth bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark transition-colors duration-300">
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
        </Routes>
        <ChatBot />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />

        {/* Protected Routes */}
        <Route element={<PrivateRoute />}>
          <Route path="/chat" element={<div className="w-screen h-screen"><ChatBot embedded={true} /></div>} />
          <Route path="/*" element={<MainLayout />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;

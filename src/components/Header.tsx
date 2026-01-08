import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Breadcrumbs } from './Breadcrumbs';

interface HeaderProps {
  // Title is now optional as we derive it from location
  title?: string;
}

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/portfolio': 'Cartera',
  '/market': 'Mercado',
  '/news': 'Noticias',
  '/reports': 'Reportes',
  '/alerts': 'Alertas',
  '/watchlists': 'Watchlists',
  '/profile': 'Perfil',
  '/admin': 'Admin',
  '/importers': 'Importar',
  '/notifications': 'Notificaciones',
  '/calendar': 'Calendario',
  '/manual-entry': 'Nueva Operación',
};

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { api, user } = useAuth();
  const [marketStatus, setMarketStatus] = useState<any[]>([]);
  const [showMarkets, setShowMarkets] = useState(false);

  // Determine title dynamically if not provided
  const displayTitle = title || routeTitles[location.pathname] || 'Stocks Manager';

  // Extra check for sub-routes
  const getDynamicTitle = () => {
    if (location.pathname.startsWith('/portfolio')) return 'Cartera';
    return displayTitle;
  }

  const finalTitle = getDynamicTitle();

  const fetchMarketStatus = useCallback(async () => {
    try {
      const { data } = await api.get('/market/status');
      if (Array.isArray(data)) setMarketStatus(data);
    } catch (e) {
      console.error('Error fetching market status:', e);
    }
  }, [api]);

  useEffect(() => {
    fetchMarketStatus();
    const interval = setInterval(fetchMarketStatus, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketStatus]);

  const nameMap: Record<string, string> = {
    '^IBEX': 'IBEX',
    '^IXIC': 'NASDAQ',
    '^NYA': 'NYSE',
    '^GDAXI': 'DAX',
    '^FTSE': 'FTSE',
    '^FCHI': 'CAC',
    '^GSPC': 'S&P500',
    '^DJI': 'DOW',
    '^MERV': 'MERVAL',
    '^BVSP': 'BOVESPA',
    '^MXX': 'IPC',
    '^STOXX50E': 'STOXX',
    '^N225': 'NIKKEI',
    '^HSI': 'HSI',
    '000001.SS': 'SSE',
    '^BSESN': 'SENSEX',
    '^AEX': 'AEX',
    '^AXJO': 'ASX'
  };

  return (
    <header className="flex flex-col gap-2 md:gap-4 px-4 md:px-10 py-3 md:py-6 sticky top-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-xl z-10 border-b border-border-light/50 dark:border-border-dark/50 transition-colors duration-300">
      <div className="flex items-center justify-between gap-2 md:gap-4">

        {/* Left: Title */}
        <div className="flex flex-col gap-0 md:gap-1 min-w-0 flex-1">
          <div className="hidden md:block">
            <Breadcrumbs />
          </div>
          <h2 className="text-xl md:text-3xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark leading-tight truncate">
            {finalTitle}
          </h2>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Market Status Toggle (móvil) */}
          <button
            onClick={() => setShowMarkets(!showMarkets)}
            className="md:hidden flex items-center justify-center size-10 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark"
          >
            <span className="material-symbols-outlined text-[20px]">monitoring</span>
          </button>

          {/* Market Status (Desktop - inline) */}
          <div className="hidden md:flex flex-wrap justify-end gap-2">
            {marketStatus.slice(0, 4).map((m, idx) => {
              const stateMap: any = {
                'REGULAR': { label: 'OPEN', color: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]', text: 'text-green-500' },
                'PRE': { label: 'PRE', color: 'bg-orange-500', text: 'text-orange-500' },
                'PREPRE': { label: 'PRE', color: 'bg-orange-500', text: 'text-orange-500' },
                'POST': { label: 'POST', color: 'bg-orange-500', text: 'text-orange-500' },
                'POSTPOST': { label: 'POST', color: 'bg-orange-500', text: 'text-orange-500' },
                'CLOSED': { label: 'OFF', color: 'bg-red-500', text: 'text-red-500 text-opacity-70' }
              };
              const status = stateMap[m.state] || { label: m.state, color: 'bg-gray-500', text: 'text-gray-500' };

              return (
                <div key={idx} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                  <span className="text-[10px] font-black">{nameMap[m.symbol] || m.symbol}</span>
                  <div className={`size-1.5 rounded-full ${status.color}`}></div>
                </div>
              );
            })}
          </div>

          {/* Notifications */}
          <button className="hidden md:flex items-center justify-center size-10 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary hover:border-primary transition-all">
            <span className="material-symbols-outlined">notifications</span>
          </button>

          {/* Nueva Operación */}
          <button
            onClick={() => navigate('/manual-entry')}
            className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-full bg-primary text-black font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span className="hidden sm:inline text-sm">Nueva</span>
          </button>
        </div>

      </div>

      {/* Market Status Dropdown (móvil) */}
      {showMarkets && (
        <div className="md:hidden flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {marketStatus.map((m, idx) => {
            const stateMap: any = {
              'REGULAR': { label: 'OPEN', color: 'bg-green-500', text: 'text-green-500' },
              'PRE': { label: 'PRE', color: 'bg-orange-500', text: 'text-orange-500' },
              'PREPRE': { label: 'PRE', color: 'bg-orange-500', text: 'text-orange-500' },
              'POST': { label: 'POST', color: 'bg-orange-500', text: 'text-orange-500' },
              'POSTPOST': { label: 'POST', color: 'bg-orange-500', text: 'text-orange-500' },
              'CLOSED': { label: 'OFF', color: 'bg-red-500', text: 'text-red-500' }
            };
            const status = stateMap[m.state] || { label: m.state, color: 'bg-gray-500', text: 'text-gray-500' };

            return (
              <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shrink-0">
                <span className="text-[10px] font-black">{nameMap[m.symbol] || m.symbol}</span>
                <div className={`size-1.5 rounded-full ${status.color}`}></div>
              </div>
            );
          })}
        </div>
      )}
    </header>
  );
};


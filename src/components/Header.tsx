import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Breadcrumbs } from './Breadcrumbs';

interface HeaderProps {
  // Title is now optional as we derive it from location
  title?: string;
}

const routeTitles: Record<string, string> = {
  '/': 'Control Dashboard',
  '/portfolio': 'Cartera de Inversión',
  '/market': 'Análisis de Mercado',
  '/news': 'Noticias Globales',
  '/reports': 'Reportes Financieros',
  '/alerts': 'Centro de Alertas',
  '/watchlists': 'Listas de Seguimiento',
  '/profile': 'Configuración de Perfil',
  '/admin': 'Panel de Administración',
  '/importers': 'Importación de Datos',
  '/notifications': 'Canales de Notificación',
  '/calendar': 'Calendario Económico',
  '/manual-entry': 'Nueva Operación',
};

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { api, user } = useAuth();
  const [marketStatus, setMarketStatus] = useState<any[]>([]);

  // Determine title dynamically if not provided
  const displayTitle = title || routeTitles[location.pathname] || 'Stocks Manager';

  // Extra check for sub-routes
  const getDynamicTitle = () => {
    if (location.pathname.startsWith('/portfolio')) return 'Gestión de Cartera';
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

  return (
    <header className="flex flex-col gap-4 px-6 md:px-10 py-6 sticky top-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-xl z-10 border-b border-border-light/50 dark:border-border-dark/50 transition-colors duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

        {/* Left: Title & Breadcrumbs */}
        <div className="flex flex-col gap-1">
          <Breadcrumbs />
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark leading-tight animate-fade-in-up">
            {finalTitle}
          </h2>
        </div>

        {/* Right: Actions & Market Status (Compact) */}
        <div className="flex flex-col md:flex-row items-end md:items-center gap-4">

          {/* Market Status Ticker */}
          <div className="flex flex-wrap justify-end gap-2">
            {marketStatus.map((m, idx) => {
              const stateMap: any = {
                'REGULAR': { label: 'ABIERTO', color: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]', text: 'text-green-500' },
                'PRE': { label: 'PRE', color: 'bg-orange-500', text: 'text-orange-500' },
                'PREPRE': { label: 'PRE', color: 'bg-orange-500', text: 'text-orange-500' },
                'POST': { label: 'POST', color: 'bg-orange-500', text: 'text-orange-500' },
                'POSTPOST': { label: 'POST', color: 'bg-orange-500', text: 'text-orange-500' },
                'CLOSED': { label: 'CERRADO', color: 'bg-red-500', text: 'text-red-500 text-opacity-70' }
              };

              // Fallback for unknown states
              const status = stateMap[m.state] || { label: m.state, color: 'bg-gray-500', text: 'text-gray-500' };

              const nameMap: any = {
                '^IBEX': 'IBEX 35 (Spain)',
                '^IXIC': 'NASDAQ (USA)',
                '^NYA': 'NYSE (USA)',
                '^GDAXI': 'DAX (Germany)',
                '^FTSE': 'FTSE 100 (UK)',
                '^FCHI': 'CAC 40 (France)',
                '^GSPC': 'S&P 500 (USA)',
                '^DJI': 'DOW JONES (USA)',
                '^MERV': 'MERVAL (Argentina)',
                '^BVSP': 'BOVESPA (Brazil)',
                '^MXX': 'IPC (Mexico)',
                '^STOXX50E': 'STOXX 50 (EU)',
                '^N225': 'NIKKEI 225 (Japan)',
                '^HSI': 'HANG SENG (HK)',
                '000001.SS': 'SHANGHAI (China)',
                '^BSESN': 'SENSEX (India)',
                '^AEX': 'AEX (Netherlands)',
                '^AXJO': 'ASX 200 (Australia)'
              };

              return (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark group hover:border-primary/30 transition-colors">
                  <div className="flex flex-col items-start leading-none gap-0.5">
                    <span className="text-[10px] font-black text-text-primary-light dark:text-text-primary-dark">{nameMap[m.symbol] || m.symbol}</span>
                    <span className={`text-[8px] font-bold ${status.text}`}>{status.label}</span>
                  </div>
                  <div className={`size-1.5 rounded-full ${status.color}`}></div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center justify-center size-10 rounded-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary hover:border-primary transition-all hover:scale-105 active:scale-95">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button
              onClick={() => navigate('/manual-entry')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-black font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:scale-95 active:translate-y-0"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span className="hidden sm:inline">Nueva Operación</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

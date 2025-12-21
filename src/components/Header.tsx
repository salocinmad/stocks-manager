import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  const { api } = useAuth();
  const [marketStatus, setMarketStatus] = useState<any[]>([]);

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
    const interval = setInterval(fetchMarketStatus, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, [fetchMarketStatus]);

  return (
    <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 px-6 py-8 md:px-10 sticky top-0 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md z-10 border-b border-border-light/50 dark:border-border-dark/50">
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark leading-none">
          {title}
        </h2>

        {/* Market Status Row */}
        <div className="flex flex-wrap gap-2 md:gap-3">
          {marketStatus.map((m, idx) => {
            const isReg = m.state === 'REGULAR';
            const isPrePost = m.state === 'PRE' || m.state === 'POST';
            const statusLabel = isReg ? 'Abierto' : isPrePost ? 'Pre/Post' : 'Cerrado';

            // Colors based on state
            const dotColor = isReg ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : isPrePost ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' : 'bg-red-500';
            const textColor = isReg ? 'text-green-600 dark:text-green-400' : isPrePost ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500';
            const borderOpacity = isReg ? 'border-green-500/20' : isPrePost ? 'border-yellow-500/20' : 'border-red-500/10';

            const nameMap: any = { '^IBEX': 'Ibex 35', '^IXIC': 'Nasdaq', '^NYA': 'NYSE', '^GDAXI': 'DAX', '^FTSE': 'FTSE 100' };

            return (
              <div key={idx} className={`flex items-center gap-2 px-3 py-1 rounded-full border ${borderOpacity} bg-white/50 dark:bg-surface-dark/50 shadow-sm transition-all hover:scale-105`}>
                <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
                <span className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                  {nameMap[m.symbol] || m.symbol}: <span className={textColor}>{statusLabel}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center justify-center size-10 rounded-full bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary hover:border-primary transition-all">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button
          onClick={() => navigate('/manual-entry')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-text-primary-light dark:bg-primary text-white dark:text-black font-semibold shadow-lg shadow-primary/10 hover:opacity-90 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Nueva Operación</span>
        </button>
      </div>
    </header>
  );
};

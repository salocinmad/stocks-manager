/**
 * Global Search Modal v2.1.0
 * 
 * Command palette style search modal (Ctrl+K)
 * Search across: tickers, screens, portfolios
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShortcuts } from './KeyboardShortcutsProvider';
import { useAuth } from '../context/AuthContext';

interface SearchResult {
    type: 'screen' | 'ticker' | 'portfolio' | 'action';
    title: string;
    subtitle?: string;
    icon: string;
    action: () => void;
}

export const GlobalSearchModal: React.FC = () => {
    const navigate = useNavigate();
    const { api } = useAuth();
    const { isSearchOpen, setIsSearchOpen } = useShortcuts();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Default screens
    const screens: SearchResult[] = [
        { type: 'screen', title: 'Dashboard', subtitle: 'Vista general', icon: '🏠', action: () => navigate('/') },
        { type: 'screen', title: 'Cartera', subtitle: 'Mis posiciones', icon: '📊', action: () => navigate('/portfolio') },
        { type: 'screen', title: 'Alertas', subtitle: 'Gestionar alertas', icon: '🔔', action: () => navigate('/alerts') },
        { type: 'screen', title: 'Watchlist', subtitle: 'Seguimiento', icon: '👁️', action: () => navigate('/watchlist') },
        { type: 'screen', title: 'Calendario', subtitle: 'Eventos financieros', icon: '📅', action: () => navigate('/calendar') },
        { type: 'screen', title: 'Noticias', subtitle: 'Últimas noticias', icon: '📰', action: () => navigate('/news') },
        { type: 'screen', title: 'Descubrir', subtitle: 'Oportunidades', icon: '🔍', action: () => navigate('/discovery') },
        { type: 'screen', title: 'Operación', subtitle: 'Nueva compra/venta', icon: '📝', action: () => navigate('/manual-entry') },
        { type: 'screen', title: 'Reportes', subtitle: 'Informes fiscales', icon: '📄', action: () => navigate('/reports') },
        { type: 'screen', title: 'Perfil', subtitle: 'Mi cuenta', icon: '👤', action: () => navigate('/profile') },
    ];

    // Search for tickers in the market
    const searchTickers = useCallback(async (q: string): Promise<SearchResult[]> => {
        if (q.length < 2) return [];

        try {
            const { data } = await api.get(`/market/search?query=${encodeURIComponent(q)}`);
            if (data && Array.isArray(data)) {
                return data.slice(0, 5).map((item: any) => ({
                    type: 'ticker' as const,
                    title: item.symbol,
                    subtitle: item.name,
                    icon: '📈',
                    action: () => {
                        // Could navigate to a detail page or open modal
                        navigate(`/watchlist?add=${item.symbol}`);
                    }
                }));
            }
        } catch (e) {
            console.error('Search error:', e);
        }
        return [];
    }, [api, navigate]);

    // Search portfolios
    const searchPortfolios = useCallback(async (q: string): Promise<SearchResult[]> => {
        try {
            const { data } = await api.get('/portfolios');
            if (data && Array.isArray(data)) {
                return data
                    .filter((p: any) => p.name.toLowerCase().includes(q.toLowerCase()))
                    .slice(0, 3)
                    .map((p: any) => ({
                        type: 'portfolio' as const,
                        title: p.name,
                        subtitle: 'Cartera',
                        icon: '💼',
                        action: () => navigate('/portfolio')
                    }));
            }
        } catch (e) {
            console.error('Portfolio search error:', e);
        }
        return [];
    }, [api, navigate]);

    // Update results when query changes
    useEffect(() => {
        const updateResults = async () => {
            if (!query.trim()) {
                setResults(screens);
                setSelectedIndex(0);
                return;
            }

            const q = query.toLowerCase();

            // Filter screens
            const screenResults = screens.filter(s =>
                s.title.toLowerCase().includes(q) ||
                s.subtitle?.toLowerCase().includes(q)
            );

            // Search tickers (debounced)
            const [tickerResults, portfolioResults] = await Promise.all([
                searchTickers(query),
                searchPortfolios(query)
            ]);

            setResults([...screenResults, ...portfolioResults, ...tickerResults]);
            setSelectedIndex(0);
        };

        const debounce = setTimeout(updateResults, 200);
        return () => clearTimeout(debounce);
    }, [query, searchTickers, searchPortfolios]);

    // Focus input when modal opens
    useEffect(() => {
        if (isSearchOpen) {
            setQuery('');
            setResults(screens);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isSearchOpen]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && results[selectedIndex]) {
            e.preventDefault();
            results[selectedIndex].action();
            setIsSearchOpen(false);
        }
    };

    if (!isSearchOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
            onClick={() => setIsSearchOpen(false)}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-gray-400 text-xl">🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Buscar pantallas, tickers, carteras..."
                        className="flex-1 bg-transparent border-none outline-none text-lg text-gray-800 dark:text-white placeholder-gray-400"
                    />
                    <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500 font-mono">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[400px] overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No se encontraron resultados para "{query}"
                        </div>
                    ) : (
                        <div className="py-2">
                            {results.map((result, index) => (
                                <button
                                    key={`${result.type}-${result.title}-${index}`}
                                    onClick={() => {
                                        result.action();
                                        setIsSearchOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors ${index === selectedIndex
                                            ? 'bg-blue-50 dark:bg-blue-900/30'
                                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <span className="text-2xl">{result.icon}</span>
                                    <div className="flex-1">
                                        <p className={`font-medium ${index === selectedIndex ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-white'}`}>
                                            {result.title}
                                        </p>
                                        {result.subtitle && (
                                            <p className="text-sm text-gray-500">{result.subtitle}</p>
                                        )}
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded ${result.type === 'screen' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' :
                                            result.type === 'ticker' ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400' :
                                                result.type === 'portfolio' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
                                                    'bg-gray-100 text-gray-600'
                                        }`}>
                                        {result.type === 'screen' ? 'Pantalla' :
                                            result.type === 'ticker' ? 'Ticker' :
                                                result.type === 'portfolio' ? 'Cartera' : 'Acción'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
                    <div className="flex items-center gap-4">
                        <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd> navegar</span>
                        <span><kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd> seleccionar</span>
                    </div>
                    <span>Ctrl+K para abrir</span>
                </div>
            </div>
        </div>
    );
};

export default GlobalSearchModal;

/**
 * Keyboard Shortcuts Provider v2.1.0
 * 
 * Global keyboard shortcuts for the application:
 * - Ctrl+K: Global search
 * - Ctrl+N: New operation
 * - Ctrl+P: Change portfolio
 * - Ctrl+A: Go to Alerts
 * - Ctrl+D: Go to Dashboard
 * - Ctrl+W: Go to Watchlist
 * - Escape: Close active modal
 * - ?: Show shortcuts help
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutsContextType {
    isSearchOpen: boolean;
    setIsSearchOpen: (open: boolean) => void;
    isHelpOpen: boolean;
    setIsHelpOpen: (open: boolean) => void;
}

const ShortcutsContext = createContext<ShortcutsContextType>({
    isSearchOpen: false,
    setIsSearchOpen: () => { },
    isHelpOpen: false,
    setIsHelpOpen: () => { }
});

export const useShortcuts = () => useContext(ShortcutsContext);

interface KeyboardShortcutsProviderProps {
    children: ReactNode;
}

export const KeyboardShortcutsProvider: React.FC<KeyboardShortcutsProviderProps> = ({ children }) => {
    const navigate = useNavigate();
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const showToast = useCallback((message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2000);
    }, []);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignore if typing in input
        const target = e.target as HTMLElement;
        const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        // Escape always works
        if (e.key === 'Escape') {
            if (isSearchOpen) setIsSearchOpen(false);
            if (isHelpOpen) setIsHelpOpen(false);
            return;
        }

        // '?' for help (only if not typing)
        if (e.key === '?' && !e.ctrlKey && !e.metaKey && !isTyping) {
            e.preventDefault();
            setIsHelpOpen(prev => !prev);
            return;
        }

        // Ctrl shortcuts work even when typing
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'k':
                    e.preventDefault();
                    setIsSearchOpen(true);
                    break;
                case 'n':
                    if (!isTyping) {
                        e.preventDefault();
                        navigate('/manual-entry');
                        showToast('📝 Nueva operación');
                    }
                    break;
                case 'p':
                    if (!isTyping) {
                        e.preventDefault();
                        navigate('/portfolio');
                        showToast('📊 Cartera');
                    }
                    break;
                case 'a':
                    if (!isTyping) {
                        e.preventDefault();
                        navigate('/alerts');
                        showToast('🔔 Alertas');
                    }
                    break;
                case 'd':
                    if (!isTyping) {
                        e.preventDefault();
                        navigate('/');
                        showToast('🏠 Dashboard');
                    }
                    break;
                case 'w':
                    if (!isTyping) {
                        e.preventDefault();
                        navigate('/watchlist');
                        showToast('👁️ Watchlist');
                    }
                    break;
            }
        }
    }, [navigate, isSearchOpen, isHelpOpen, showToast]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <ShortcutsContext.Provider value={{ isSearchOpen, setIsSearchOpen, isHelpOpen, setIsHelpOpen }}>
            {children}

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-2 fade-in duration-200">
                    <div className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl text-sm font-medium">
                        {toast}
                    </div>
                </div>
            )}

            {/* Help Modal */}
            {isHelpOpen && (
                <div
                    className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => setIsHelpOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 fade-in duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                                ⌨️ Atajos de Teclado
                            </h3>
                            <button
                                onClick={() => setIsHelpOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3">
                            {[
                                { keys: 'Ctrl + K', action: 'Búsqueda global' },
                                { keys: 'Ctrl + N', action: 'Nueva operación' },
                                { keys: 'Ctrl + D', action: 'Ir a Dashboard' },
                                { keys: 'Ctrl + P', action: 'Ir a Cartera' },
                                { keys: 'Ctrl + A', action: 'Ir a Alertas' },
                                { keys: 'Ctrl + W', action: 'Ir a Watchlist' },
                                { keys: 'Escape', action: 'Cerrar modal' },
                                { keys: '?', action: 'Mostrar ayuda' }
                            ].map(shortcut => (
                                <div
                                    key={shortcut.keys}
                                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                                >
                                    <span className="text-gray-600 dark:text-gray-300">{shortcut.action}</span>
                                    <kbd className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg text-sm font-mono font-bold text-gray-700 dark:text-gray-200">
                                        {shortcut.keys}
                                    </kbd>
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-gray-400 text-center mt-6">
                            Pulsa ESC o fuera del modal para cerrar
                        </p>
                    </div>
                </div>
            )}
        </ShortcutsContext.Provider>
    );
};

export default KeyboardShortcutsProvider;

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: Toast = { id, message, type };

        setToasts(prev => [...prev, newToast]);

        setTimeout(() => {
            removeToast(id);
        }, duration);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto min-w-[300px] max-w-sm p-4 rounded-xl shadow-2xl backdrop-blur-md border border-white/10
                            transform transition-all duration-300 ease-out animate-slide-in-right
                            flex items-center gap-3
                            ${toast.type === 'success' ? 'bg-green-500/90 text-white' : ''}
                            ${toast.type === 'error' ? 'bg-red-500/90 text-white' : ''}
                            ${toast.type === 'warning' ? 'bg-yellow-500/90 text-black' : ''}
                            ${toast.type === 'info' ? 'bg-blue-500/90 text-white' : ''}
                        `}
                    >
                        <span className="material-symbols-outlined text-xl">
                            {toast.type === 'success' && 'check_circle'}
                            {toast.type === 'error' && 'error'}
                            {toast.type === 'warning' && 'warning'}
                            {toast.type === 'info' && 'info'}
                        </span>
                        <p className="text-sm font-semibold">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="ml-auto opacity-70 hover:opacity-100 transition-opacity"
                        >
                            <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};

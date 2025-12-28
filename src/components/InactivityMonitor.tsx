import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface InactivityMonitorProps {
    timeoutMinutes?: number; // Default: 30 minutes
    warningMinutes?: number; // Default: 2 minutes before timeout
}

export const InactivityMonitor: React.FC<InactivityMonitorProps> = ({
    timeoutMinutes = 30,
    warningMinutes = 2
}) => {
    const { isAuthenticated, logout, rememberMe } = useAuth();
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearTimers = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (warningRef.current) clearTimeout(warningRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
    }, []);

    const handleLogout = useCallback(() => {
        clearTimers();
        setShowWarning(false);
        logout();
        window.location.href = '/#/login?expired=true';
    }, [clearTimers, logout]);

    const extendSession = useCallback(() => {
        setShowWarning(false);
        clearTimers();
        startTimers();
    }, [clearTimers]);

    const startTimers = useCallback(() => {
        // Don't monitor if "Remember Me" is checked
        if (rememberMe) return;
        if (!isAuthenticated) return;

        const warningTime = (timeoutMinutes - warningMinutes) * 60 * 1000;
        const logoutTime = timeoutMinutes * 60 * 1000;

        // Warning timer
        warningRef.current = setTimeout(() => {
            setShowWarning(true);
            setCountdown(warningMinutes * 60);

            // Start countdown
            countdownRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        handleLogout();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, warningTime);

        // Logout timer
        timeoutRef.current = setTimeout(handleLogout, logoutTime);
    }, [isAuthenticated, rememberMe, timeoutMinutes, warningMinutes, handleLogout]);

    // Activity detection
    const handleActivity = useCallback(() => {
        if (!showWarning && isAuthenticated && !rememberMe) {
            clearTimers();
            startTimers();
        }
    }, [clearTimers, startTimers, showWarning, isAuthenticated, rememberMe]);

    useEffect(() => {
        if (!isAuthenticated || rememberMe) {
            clearTimers();
            return;
        }

        // Start monitoring
        startTimers();

        // Activity events
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, handleActivity));

        return () => {
            clearTimers();
            events.forEach(event => window.removeEventListener(event, handleActivity));
        };
    }, [isAuthenticated, rememberMe, startTimers, handleActivity, clearTimers]);

    // Format countdown
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!showWarning) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-surface-dark rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
                <div className="size-20 mx-auto mb-6 bg-yellow-500/10 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-yellow-500">schedule</span>
                </div>

                <h2 className="text-2xl font-bold mb-2">Sesión por expirar</h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark mb-4">
                    Tu sesión expirará por inactividad en:
                </p>

                <div className="text-5xl font-bold text-yellow-500 mb-6">
                    {formatTime(countdown)}
                </div>

                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-6">
                    Haz clic en el botón para continuar trabajando.
                </p>

                <div className="flex gap-4">
                    <button
                        onClick={handleLogout}
                        className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-surface-dark-elevated font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-all"
                    >
                        Cerrar Sesión
                    </button>
                    <button
                        onClick={extendSession}
                        className="flex-1 py-3 rounded-xl bg-primary text-black font-bold hover:bg-primary/90 transition-all"
                    >
                        Seguir Trabajando
                    </button>
                </div>
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ResetPasswordScreen: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { api } = useAuth();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (!token) {
            setError('Token inválido o faltante');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Using api from useAuth ensures proper baseURL (/api) and consistent error handling
            await api.post('/auth/reset-password', { token, newPassword });
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            console.error('Reset password error:', err);
            setError(err.response?.data?.error || err.message || 'Error al restablecer contraseña');
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <main className="flex flex-col items-center justify-center h-screen w-full bg-background-light dark:bg-background-dark p-4 md:p-6 relative overflow-hidden">
                <div className="flex flex-col bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl md:rounded-[3rem] shadow-2xl p-6 md:p-14 text-center max-w-md w-full mx-2">
                    <span className="material-symbols-outlined text-5xl md:text-6xl text-error mb-4">error_circle</span>
                    <h2 className="text-xl md:text-2xl font-bold mb-2 text-text-primary-light dark:text-text-primary-dark">Enlace Inválido</h2>
                    <p className="text-sm md:text-base text-text-secondary-light dark:text-text-secondary-dark mb-6">
                        El enlace de recuperación es inválido o ha expirado.
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-3 md:py-4 rounded-full bg-primary hover:bg-primary-dim text-black font-bold text-base md:text-lg transition-all"
                    >
                        Volver al Login
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="flex flex-col items-center justify-start md:justify-center min-h-screen w-full bg-background-light dark:bg-background-dark py-4 px-3 md:p-6 relative overflow-y-auto">
            {/* Background Blobs */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -mr-40 -mt-40"></div>
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent-blue/10 rounded-full blur-[100px] pointer-events-none -ml-30 -mb-30"></div>

            <div className="relative w-full max-w-lg z-10">
                <div className="flex flex-col bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl md:rounded-[3rem] shadow-2xl p-5 md:p-14 transition-all duration-300">

                    {/* Header / Logo */}
                    <div className="flex items-center gap-2 mb-4 md:mb-10">
                        <img
                            src="/pwa-192x192.png"
                            alt="Stocks Manager"
                            className="size-8 md:size-12 rounded-lg md:rounded-2xl shadow-lg"
                        />
                        <h1 className="text-lg md:text-2xl font-bold tracking-tight">Stocks Manager</h1>
                    </div>

                    <h2 className="text-xl md:text-4xl font-bold tracking-tight mb-1 md:mb-3">
                        Nueva Contraseña
                    </h2>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark mb-4 md:mb-10 text-xs md:text-lg">
                        Introduce tu nueva contraseña segura.
                    </p>

                    {success ? (
                        <div className="text-center animate-fade-in-up">
                            <div className="size-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <span className="material-symbols-outlined text-4xl text-green-500">check_circle</span>
                            </div>
                            <h3 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark mb-2">
                                ¡Contraseña Actualizada!
                            </h3>
                            <p className="text-text-secondary-light dark:text-text-secondary-dark mb-8">
                                Redirigiendo al login...
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-5 rounded-full bg-primary hover:bg-primary-dim text-black font-bold text-xl shadow-xl shadow-primary/20 transition-all active:scale-95"
                            >
                                Ir al Login Ahora
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            {error && (
                                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">error</span>
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-primary-light dark:text-white uppercase tracking-widest ml-1">
                                    Nueva Contraseña
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="block w-full px-5 py-4 bg-background-light dark:bg-background-dark border-none rounded-2xl text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary outline-none text-lg transition-all"
                                    placeholder="••••••••"
                                    minLength={8}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-primary-light dark:text-white uppercase tracking-widest ml-1">
                                    Confirmar Contraseña
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`block w-full px-5 py-4 bg-background-light dark:bg-background-dark border ${newPassword && confirmPassword && newPassword !== confirmPassword ? 'border-red-500' : 'border-transparent'} rounded-2xl text-text-primary-light dark:text-white focus:ring-2 focus:ring-primary outline-none text-lg transition-all`}
                                    placeholder="••••••••"
                                    minLength={8}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-4 w-full py-5 rounded-full bg-primary hover:bg-primary-dim text-black font-bold text-xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>{loading ? 'Actualizando...' : 'Actualizar Contraseña'}</span>
                                {!loading && <span className="material-symbols-outlined text-2xl">arrow_forward</span>}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
};

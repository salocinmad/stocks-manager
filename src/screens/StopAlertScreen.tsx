import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface AlertInfo {
    id: string;
    ticker: string;
    alert_type: string;
    target_price: number | null;
    percent_threshold: number | null;
    volume_multiplier: number | null;
    is_active: boolean;
}

export const StopAlertScreen: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [alertInfo, setAlertInfo] = useState<AlertInfo | null>(null);
    const [stopped, setStopped] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;

        // First fetch alert info
        fetch(`/api/public/alerts/info/${token}`)
            .then(res => res.json())
            .then(data => {
                if (data.found) {
                    setAlertInfo(data.alert);
                } else {
                    setError('Alerta no encontrada o ya fue desactivada');
                }
            })
            .catch(() => setError('Error al cargar información de la alerta'))
            .finally(() => setLoading(false));
    }, [token]);

    const handleStop = async () => {
        if (!token) return;
        setLoading(true);

        try {
            const res = await fetch(`/api/public/alerts/stop/${token}`);
            const data = await res.json();

            if (data.success) {
                setStopped(true);
            } else {
                setError(data.message || 'Error al desactivar la alerta');
            }
        } catch {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    const getAlertDescription = (alert: AlertInfo) => {
        if (alert.alert_type === 'price') {
            return `Precio objetivo: ${alert.target_price}€`;
        } else if (alert.alert_type === 'percent_change') {
            return `Umbral de cambio: ${alert.percent_threshold}%`;
        } else if (alert.alert_type === 'volume') {
            return `Multiplicador de volumen: ${alert.volume_multiplier}x`;
        }
        return '';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-3xl p-8 shadow-2xl">
                {loading ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-text-secondary-light">Cargando...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-6 py-8">
                        <div className="size-20 bg-red-500/10 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                        </div>
                        <h1 className="text-xl font-bold text-center">{error}</h1>
                        <button
                            onClick={() => navigate('/')}
                            className="px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/80 transition-all"
                        >
                            Ir a Stocks Manager
                        </button>
                    </div>
                ) : stopped ? (
                    <div className="flex flex-col items-center gap-6 py-8">
                        <div className="size-20 bg-green-500/10 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-green-500">check_circle</span>
                        </div>
                        <h1 className="text-2xl font-bold text-center">Alerta Desactivada</h1>
                        <p className="text-text-secondary-light text-center">
                            La alerta para <span className="font-bold text-primary">{alertInfo?.ticker}</span> ha sido desactivada correctamente.
                        </p>
                        <p className="text-sm text-text-secondary-light text-center">
                            No recibirás más notificaciones de esta alerta.
                        </p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 px-6 py-3 bg-primary text-black font-bold rounded-xl hover:bg-primary/80 transition-all"
                        >
                            Ir a Stocks Manager
                        </button>
                    </div>
                ) : alertInfo ? (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-4">
                            <div className="size-14 bg-red-500/10 rounded-2xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-3xl text-red-500">notifications_off</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold">Desactivar Alerta</h1>
                                <p className="text-sm text-text-secondary-light">¿Confirmar desactivación?</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-gray-100 dark:bg-background-dark">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <span className="text-sm font-bold text-primary">{alertInfo.ticker.slice(0, 2)}</span>
                                </div>
                                <div>
                                    <p className="font-bold">{alertInfo.ticker}</p>
                                    <p className="text-xs text-text-secondary-light capitalize">{alertInfo.alert_type.replace('_', ' ')}</p>
                                </div>
                                <div className={`ml-auto px-2 py-1 rounded text-xs font-bold ${alertInfo.is_active ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                    {alertInfo.is_active ? 'Activa' : 'Inactiva'}
                                </div>
                            </div>
                            <p className="text-sm">{getAlertDescription(alertInfo)}</p>
                        </div>

                        <p className="text-sm text-center text-text-secondary-light">
                            Al desactivar esta alerta, dejarás de recibir notificaciones.
                            Puedes reactivarla desde la aplicación en cualquier momento.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate('/')}
                                className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-surface-dark-elevated font-bold hover:bg-gray-300 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleStop}
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all disabled:opacity-50"
                            >
                                {loading ? 'Desactivando...' : 'Desactivar'}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

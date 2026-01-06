import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

// List of available indices (Global)
const AVAILABLE_INDICES = [
    // Americas
    { symbol: '^DJI', name: 'Dow Jones (USA)', region: 'Americas' },
    { symbol: '^IXIC', name: 'NASDAQ (USA)', region: 'Americas' },
    { symbol: '^NYA', name: 'NYSE Composite (USA)', region: 'Americas' },
    { symbol: '^GSPC', name: 'S&P 500 (USA)', region: 'Americas' },
    { symbol: '^MERV', name: 'Merval (Argentina)', region: 'Americas' },
    { symbol: '^BVSP', name: 'Bovespa (Brazil)', region: 'Americas' },
    { symbol: '^MXX', name: 'IPC (Mexico)', region: 'Americas' },

    // Europe
    { symbol: '^IBEX', name: 'IBEX 35 (Spain)', region: 'Europe' },
    { symbol: '^FTSE', name: 'FTSE 100 (UK)', region: 'Europe' },
    { symbol: '^GDAXI', name: 'DAX (Germany)', region: 'Europe' },
    { symbol: '^FCHI', name: 'CAC 40 (France)', region: 'Europe' },
    { symbol: '^STOXX50E', name: 'Euro Stoxx 50 (EU)', region: 'Europe' },
    { symbol: '^AEX', name: 'AEX (Netherlands)', region: 'Europe' },

    // Asia
    { symbol: '^N225', name: 'Nikkei 225 (Japan)', region: 'Asia' },
    { symbol: '^HSI', name: 'Hang Seng (Hong Kong)', region: 'Asia' },
    { symbol: '000001.SS', name: 'SSE Composite (China)', region: 'Asia' },
    { symbol: '^AXJO', name: 'ASX 200 (Australia)', region: 'Asia' },
    { symbol: '^BSESN', name: 'SENSEX (India)', region: 'Asia' }
];

export const MarketIndicesSelector: React.FC = () => {
    const { api } = useAuth();
    const { addToast } = useToast();
    const [selectedIndices, setSelectedIndices] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/admin/settings/market-display');
                if (data && data.indices) {
                    setSelectedIndices(data.indices);
                }
            } catch (error) {
                console.error('Error loading market display settings:', error);
                addToast('Error al cargar configuración de mercado', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [api, addToast]);

    const handleToggle = (symbol: string) => {
        setSelectedIndices(prev => {
            if (prev.includes(symbol)) {
                return prev.filter(s => s !== symbol);
            } else {
                if (prev.length >= 8) {
                    addToast('Máximo 8 índices recomendados para el encabezado', 'info');
                }
                return [...prev, symbol];
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/admin/settings/market-display', { indices: selectedIndices });
            addToast('Configuración de mercado actualizada', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            addToast('Error al guardar configuración', 'error');
        } finally {
            setSaving(false);
        }
    };

    const groupedIndices = AVAILABLE_INDICES.reduce((acc, curr) => {
        if (!acc[curr.region]) acc[curr.region] = [];
        acc[curr.region].push(curr);
        return acc;
    }, {} as Record<string, typeof AVAILABLE_INDICES>);

    if (loading) return <div className="p-8 text-center text-gray-400">Cargando configuración...</div>;

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-xl border border-border-light dark:border-border-dark">
            <h3 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark mb-4">
                Índices de Cabecera
            </h3>
            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-6">
                Selecciona los índices bursátiles que deseas visualizar en la barra superior. Se recomienda un máximo de 6-8 para evitar saturación.
            </p>

            <div className="space-y-6">
                {Object.entries(groupedIndices).map(([region, indices]) => (
                    <div key={region}>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">{region}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {indices.map((idx) => (
                                <div
                                    key={idx.symbol}
                                    onClick={() => handleToggle(idx.symbol)}
                                    className={`
                                        cursor-pointer flex items-center justify-between p-3 rounded-lg border transition-all duration-200
                                        ${selectedIndices.includes(idx.symbol)
                                            ? 'bg-primary/10 border-primary shadow-sm'
                                            : 'bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark hover:border-gray-400'}
                                    `}
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-text-primary-light dark:text-text-primary-dark">{idx.name}</span>
                                        <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{idx.symbol}</span>
                                    </div>
                                    <div className={`
                                        w-5 h-5 rounded-md flex items-center justify-center border
                                        ${selectedIndices.includes(idx.symbol)
                                            ? 'bg-primary border-primary text-black'
                                            : 'border-gray-400 text-transparent'}
                                    `}>
                                        <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                    {saving ? <span className="animate-spin material-symbols-outlined">sync</span> : <span className="material-symbols-outlined">save</span>}
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
};

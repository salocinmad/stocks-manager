import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface Exchange {
    code: string;
    name: string;
    country: string;
    currency: string;
}

export const MasterCatalogConfig: React.FC = () => {
    const { api } = useAuth();
    const { addToast } = useToast();

    const [availableExchanges, setAvailableExchanges] = useState<Exchange[]>([]);
    const [selectedExchanges, setSelectedExchanges] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchExchanges = async (forceRefresh = false) => {
        try {
            if (forceRefresh) setRefreshing(true);
            const url = forceRefresh ? '/admin/market/exchanges?refresh=true' : '/admin/market/exchanges';
            const { data } = await api.get(url);

            if (data.available) {
                setAvailableExchanges(data.available);
            }
            if (data.selected) {
                setSelectedExchanges(data.selected);
            }

            if (forceRefresh) {
                addToast(`Lista actualizada: ${data.available?.length || 0} bolsas disponibles`, 'success');
            }
        } catch (error) {
            console.error('Error loading exchanges:', error);
            addToast('Error al cargar lista de bolsas', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchExchanges();
    }, []);

    const handleToggle = (code: string) => {
        setSelectedExchanges(prev => {
            if (prev.includes(code)) {
                return prev.filter(c => c !== code);
            } else {
                return [...prev, code];
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data } = await api.post('/admin/market/exchanges', { exchanges: selectedExchanges });

            if (data.cleanup) {
                addToast(
                    `Guardado. Limpieza: ${data.cleanup.globalTickers} tickers, ${data.cleanup.tickerDetails} detalles, ${data.cleanup.discoveryCache} discovery`,
                    'success'
                );
            } else {
                addToast(data.message || 'Configuración guardada', 'success');
            }
        } catch (error: any) {
            console.error('Error saving exchanges:', error);
            addToast(error.response?.data?.message || 'Error al guardar', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Filter state
    const [showOnlySelected, setShowOnlySelected] = useState(false);

    // Group by country with filters
    const groupedExchanges = useMemo(() => {
        let filtered = availableExchanges;

        // Apply search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            filtered = filtered.filter(ex =>
                ex.code.toLowerCase().includes(search) ||
                ex.name.toLowerCase().includes(search) ||
                ex.country.toLowerCase().includes(search)
            );
        }

        // Apply "only selected" filter
        if (showOnlySelected) {
            filtered = filtered.filter(ex => selectedExchanges.includes(ex.code));
        }

        return filtered.reduce((acc, ex) => {
            const country = ex.country || 'Other';
            if (!acc[country]) acc[country] = [];
            acc[country].push(ex);
            return acc;
        }, {} as Record<string, Exchange[]>);
    }, [availableExchanges, searchTerm, showOnlySelected, selectedExchanges]);

    // Sort countries alphabetically
    const sortedCountries = Object.keys(groupedExchanges).sort();

    // Detect orphan exchanges (selected but not in available list)
    const availableCodes = availableExchanges.map(ex => ex.code);
    const orphanExchanges = selectedExchanges.filter(code => !availableCodes.includes(code));
    const [cleaningOrphans, setCleaningOrphans] = useState(false);

    // Global Sync State (Cosecha Mundial)
    const [globalSyncStatus, setGlobalSyncStatus] = useState({ running: false, message: 'IDLE', lastRun: null as string | null });

    // Poll sync status when component is mounted
    useEffect(() => {
        const pollStatus = async () => {
            try {
                const res = await api.get('/admin/market/sync-status');
                setGlobalSyncStatus(res.data);
            } catch (e) {
                console.error('Error polling sync status:', e);
            }
        };
        pollStatus();
        const interval = setInterval(pollStatus, 5000);
        return () => clearInterval(interval);
    }, [api]);

    // Iniciar Cosecha Mundial
    const handleSyncGlobalLibrary = async () => {
        if (!window.confirm('¿Iniciar sincronización mundial? Esto descargará miles de tickers con ISIN de las bolsas seleccionadas. El proceso toma ~1 minuto por bolsa para ahorrar créditos de tu plan EODHD.')) return;
        try {
            await api.post('/admin/market/sync-global-library');
            setGlobalSyncStatus(prev => ({ ...prev, running: true, message: 'Iniciando sincronización global...' }));
            addToast('Sincronización mundial iniciada', 'success');
        } catch (e: any) {
            addToast('Error al iniciar sincronización: ' + (e.response?.data?.message || e.message), 'error');
        }
    };

    // Clean orphan exchanges AND their associated data
    const cleanOrphans = async () => {
        setCleaningOrphans(true);
        try {
            const validSelected = selectedExchanges.filter(code => availableCodes.includes(code));

            // Call backend to save and trigger cleanup of orphan codes
            const { data } = await api.post('/admin/market/exchanges', { exchanges: validSelected });

            setSelectedExchanges(validSelected);

            if (data.cleanup) {
                addToast(
                    `Limpiados ${orphanExchanges.length} códigos: ${data.cleanup.globalTickers} tickers, ${data.cleanup.tickerDetails} detalles, ${data.cleanup.discoveryCache} discovery`,
                    'success'
                );
            } else {
                addToast(`Limpiados ${orphanExchanges.length} códigos inválidos: ${orphanExchanges.join(', ')}`, 'success');
            }
        } catch (error) {
            console.error('Error cleaning orphans:', error);
            addToast('Error al limpiar códigos inválidos', 'error');
        } finally {
            setCleaningOrphans(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-gray-400">
                <span className="material-symbols-outlined animate-spin text-4xl">sync</span>
                <p className="mt-2">Cargando bolsas mundiales...</p>
            </div>
        );
    }

    return (
        <div className="bg-surface-light dark:bg-surface-dark p-4 md:p-6 rounded-lg md:rounded-xl border border-border-light dark:border-border-dark">
            {/* Warning for orphan exchanges */}
            {orphanExchanges.length > 0 && (
                <div className="mb-3 md:mb-4 p-3 md:p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg md:rounded-xl">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-amber-500 text-xl">warning</span>
                        <div className="flex-1">
                            <p className="font-bold text-amber-500 mb-1">
                                {orphanExchanges.length} códigos guardados no existen en EODHD
                            </p>
                            <p className="text-sm text-gray-400 mb-2">
                                Códigos inválidos: <code className="bg-gray-700 px-1 rounded">{orphanExchanges.join(', ')}</code>
                            </p>
                            <button
                                onClick={cleanOrphans}
                                disabled={cleaningOrphans}
                                className="text-sm px-3 py-1 bg-amber-500 text-black font-bold rounded hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                                {cleaningOrphans && <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>}
                                {cleaningOrphans ? 'Limpiando...' : 'Limpiar códigos inválidos y datos'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base md:text-lg font-bold text-text-primary-light dark:text-text-primary-dark">
                    🌍 Catálogo Maestro - Bolsas Mundiales
                </h3>
                <button
                    onClick={() => fetchExchanges(true)}
                    disabled={refreshing}
                    className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    <span className={`material-symbols-outlined text-[18px] ${refreshing ? 'animate-spin' : ''}`}>
                        refresh
                    </span>
                    Actualizar Lista
                </button>
            </div>

            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mb-4">
                Selecciona las bolsas de valores que alimentarán tu catálogo de empresas.
                Al desmarcar una bolsa, se eliminarán sus empresas del Discovery Engine.
            </p>

            {/* Search & Stats */}
            <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="flex-1 relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por país, código o nombre..."
                        className="w-full pl-10 pr-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-text-primary-light dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <button
                        onClick={() => setShowOnlySelected(!showOnlySelected)}
                        className={`px-3 py-2 font-bold rounded-lg transition-colors flex items-center gap-1 ${showOnlySelected
                            ? 'bg-primary text-black'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {showOnlySelected ? 'filter_alt' : 'filter_alt_off'}
                        </span>
                        {selectedExchanges.length} seleccionadas
                    </button>
                    <span className="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg">
                        {availableExchanges.length} disponibles
                    </span>
                </div>
            </div>

            {/* Exchanges Grid by Country */}
            <div className="space-y-4 md:space-y-6 max-h-[400px] md:max-h-[500px] overflow-y-auto pr-2">
                {sortedCountries.map(country => (
                    <div key={country}>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2 sticky top-0 bg-surface-light dark:bg-surface-dark py-1">
                            {country} ({groupedExchanges[country].length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                            {groupedExchanges[country].map((ex) => (
                                <div
                                    key={ex.code}
                                    onClick={() => handleToggle(ex.code)}
                                    className={`
                                        cursor-pointer flex items-center justify-between p-3 rounded-lg border transition-all duration-200
                                        ${selectedExchanges.includes(ex.code)
                                            ? 'bg-primary/10 border-primary shadow-sm'
                                            : 'bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark hover:border-gray-400'}
                                    `}
                                >
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-bold text-sm text-text-primary-light dark:text-text-primary-dark truncate">
                                            {ex.code}
                                        </span>
                                        <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate">
                                            {ex.name}
                                        </span>
                                    </div>
                                    <div className={`
                                        w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 ml-2
                                        ${selectedExchanges.includes(ex.code)
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

            {/* Actions */}
            <div className="mt-6 md:mt-8 flex flex-col gap-3 md:gap-4">
                {/* Sync Status */}
                <div className="p-2 md:p-3 bg-background-light dark:bg-background-dark rounded-lg md:rounded-xl border border-border-light dark:border-border-dark flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <span className="text-xs font-bold text-text-secondary-light uppercase">Estado Sincronización</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${globalSyncStatus.running ? 'bg-amber-500/20 text-amber-500 animate-pulse' : 'bg-green-500/20 text-green-500'}`}>
                        {globalSyncStatus.message || (globalSyncStatus.running ? 'EJECUTANDO' : 'LISTO')}
                    </span>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <p className="text-xs text-gray-500">
                        💡 La lista se actualiza automáticamente cada 30 días para ahorrar créditos API.
                    </p>
                    <div className="flex gap-3 flex-wrap">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 md:px-6 py-2 bg-primary text-black font-bold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm md:text-base"
                        >
                            {saving
                                ? <span className="animate-spin material-symbols-outlined">sync</span>
                                : <span className="material-symbols-outlined">save</span>}
                            Guardar Configuración
                        </button>
                        <button
                            onClick={handleSyncGlobalLibrary}
                            disabled={globalSyncStatus.running}
                            className="flex items-center gap-2 px-4 md:px-6 py-2 bg-primary/80 hover:bg-primary text-black font-bold rounded-lg transition-all shadow-lg shadow-primary/20 disabled:opacity-50 text-sm md:text-base"
                        >
                            {globalSyncStatus.running
                                ? <span className="animate-spin material-symbols-outlined">sync</span>
                                : <span className="material-symbols-outlined">rocket_launch</span>}
                            {globalSyncStatus.running ? 'Sincronizando...' : 'Iniciar Cosecha Mundial'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

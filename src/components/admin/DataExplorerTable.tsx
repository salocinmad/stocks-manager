import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Search, ChevronLeft, ChevronRight, FileJson, Layers, Database, RefreshCw, X, Flame, Activity } from 'lucide-react';
import { SplitViewJsonModal } from './SplitViewJsonModal';
import { DiscoveryAnalysisModal } from '../DiscoveryAnalysisModal';

type ExplorerSource = 'catalog' | 'discovery';

interface DataExplorerTableProps {
    initialSource?: ExplorerSource;
    onBack?: () => void;
}

export const DataExplorerTable: React.FC<DataExplorerTableProps> = ({ initialSource, onBack }) => {
    const { api } = useAuth();
    const [source, setSource] = useState<ExplorerSource>(initialSource || 'catalog');
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('all');

    // New Filters
    const [isChicharros, setIsChicharros] = useState(false);
    const [marketFilter, setMarketFilter] = useState('all');

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [limit, setLimit] = useState(20);
    const [offset, setOffset] = useState(0);

    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [goToPage, setGoToPage] = useState('');

    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setOffset(0); // Reset pagination on search
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Load categories (kept for reference or future use, but we default to 'all')
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const { data } = await api.get('/admin/explorer/categories');
                const cats = Array.isArray(data) ? data : [];
                setCategories(cats);

                // Always default to 'all' per user request
                setSelectedCategory('all');
            } catch (err) {
                console.error('Error loading categories:', err);
                setCategories([]);
            }
        };
        loadCategories();
    }, [api]);



    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Helper to render sort icon
    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <div className="w-4 h-4" />;
        return <div className="text-primary">{sortConfig.direction === 'asc' ? '▲' : '▼'}</div>;
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            let res;
            if (source === 'catalog') {
                res = await api.get('/admin/explorer/catalog', {
                    params: { search: debouncedSearch, limit, offset }
                });
            } else {
                res = await api.get('/admin/explorer/discovery', {
                    params: {
                        category: selectedCategory,
                        filter: isChicharros ? 'chicharros' : 'all',
                        market: marketFilter,
                        search: debouncedSearch,
                        limit,
                        offset,
                        sortBy: sortConfig?.key || 't', // Default ticker
                        order: sortConfig?.direction || 'asc'
                    }
                });
            }
            setItems(Array.isArray(res.data?.items) ? res.data.items : []);
            setTotal(res.data?.total || 0);
        } catch (err) {
            console.error('Error fetching explorer data:', err);
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [api, source, selectedCategory, isChicharros, marketFilter, debouncedSearch, limit, offset, sortConfig]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSourceChange = (newSource: ExplorerSource) => {
        setSource(newSource);
        setOffset(0);
        setSearch('');
        setSortConfig(null);
    };

    const handlePageChange = (newOffset: number) => {
        if (newOffset >= 0 && newOffset < total) {
            setOffset(newOffset);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in">
            {/* Controls Header */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl p-6 shadow-sm border border-border-light dark:border-border-dark">
                <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">

                    {/* Source Selector */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex bg-background-light dark:bg-surface-dark-elevated p-1.5 rounded-2xl border border-border-light dark:border-border-dark">
                            <button
                                onClick={() => handleSourceChange('catalog')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${source === 'catalog'
                                    ? 'bg-primary text-black shadow-md'
                                    : 'text-text-secondary-light hover:text-text-primary'}`}
                            >
                                <Layers className="w-4 h-4" />
                                Catálogo Maestro
                            </button>
                            <button
                                onClick={() => handleSourceChange('discovery')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${source === 'discovery'
                                    ? 'bg-cyan-500 text-black shadow-md'
                                    : 'text-text-secondary-light hover:text-text-primary'}`}
                            >
                                <Database className="w-4 h-4" />
                                Discovery Engine
                            </button>
                        </div>

                        {/* Botón Posibles Chicharros (Solo visible en Discovery) */}
                        {source === 'discovery' && (
                            <div className="flex bg-background-light dark:bg-surface-dark-elevated p-1.5 rounded-2xl border border-border-light dark:border-border-dark gap-2">
                                <select
                                    value={marketFilter}
                                    onChange={(e) => { setMarketFilter(e.target.value); setOffset(0); }}
                                    className="px-3 py-1 bg-transparent text-sm font-bold outline-none cursor-pointer hover:text-primary transition-colors text-text-primary appearance-none pr-8 relative z-10"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                        backgroundPosition: `right 0.1rem center`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundSize: '1.25em 1.25em'
                                    }}
                                >
                                    <option value="all" className="bg-background-light dark:bg-surface-dark-elevated text-text-primary py-2">🌍 Todos</option>
                                    <option value="es" className="bg-background-light dark:bg-surface-dark-elevated text-text-primary py-2">🇪🇸 España</option>
                                    <option value="us" className="bg-background-light dark:bg-surface-dark-elevated text-text-primary py-2">🇺🇸 EE.UU</option>
                                    <option value="eu" className="bg-background-light dark:bg-surface-dark-elevated text-text-primary py-2">🇪🇺 Europa</option>
                                </select>

                                <div className="w-px bg-border-light dark:bg-border-dark self-stretch my-1"></div>

                                <button
                                    onClick={() => {
                                        setIsChicharros(prev => !prev);
                                        setOffset(0);
                                    }}
                                    className={`flex items-center gap-2 px-3 py-1 rounded-xl text-sm font-bold transition-all ${isChicharros
                                        ? 'bg-orange-500/20 text-orange-500 shadow-sm'
                                        : 'text-text-secondary-light hover:text-orange-500'}`}
                                >
                                    <Flame className={`w-4 h-4 ${isChicharros ? 'fill-orange-500' : ''}`} />
                                    <span className="hidden sm:inline">Chicharros</span>
                                </button>
                            </div>
                        )}

                        {/* Botón Forzar Actualización Eliminado por Seguridad API */}
                    </div>

                    {/* Filters & Search */}
                    <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">

                        {/* Filter removed as requested by user */}
                        {/* source === 'discovery' && (
                            <select ... />
                        ) */}

                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary-light" />
                            <input
                                type="text"
                                placeholder="Buscar ticker o nombre..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-background-light dark:bg-surface-dark-elevated rounded-xl border border-border-light dark:border-border-dark text-sm focus:ring-2 focus:ring-primary outline-none"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary-light hover:text-text-primary"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <select
                            value={limit}
                            onChange={(e) => { setLimit(Number(e.target.value)); setOffset(0); }}
                            className="px-3 py-2 bg-background-light dark:bg-surface-dark-elevated rounded-xl border border-border-light dark:border-border-dark text-sm font-semibold focus:ring-2 focus:ring-primary outline-none"
                        >
                            <option value={20}>20 filas</option>
                            <option value={50}>50 filas</option>
                            <option value={100}>100 filas</option>
                            <option value={200}>200 filas</option>
                            <option value={500}>500 filas</option>
                        </select>

                        <button
                            onClick={fetchData}
                            className="p-2 bg-background-light dark:bg-surface-dark-elevated rounded-xl border border-border-light dark:border-border-dark hover:bg-primary/10 hover:text-primary transition-all"
                            title="Refrescar"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-3xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden flex flex-col min-h-[500px]">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-background-light dark:bg-black/20 text-xs font-bold uppercase text-text-secondary-light">
                                <th className="px-6 py-4 text-left">Ticker</th>
                                <th className="px-6 py-4 text-left">Nombre / Empresa</th>
                                {source === 'catalog' || selectedCategory === 'catalog_global' ? (
                                    <>
                                        <th className="px-6 py-4 text-center">Bolsa</th>
                                        <th className="px-6 py-4 text-center">ISIN</th>
                                        <th className="px-6 py-4 text-center">Tipo</th>
                                        <th className="px-6 py-4 text-center">Últ. Proc.</th>
                                    </>
                                ) : (
                                    <>
                                        <th
                                            className="px-6 py-4 text-center cursor-pointer hover:text-primary select-none group/th"
                                            onClick={() => handleSort('p')}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                Precio
                                                <SortIcon columnKey="p" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-center cursor-pointer hover:text-primary select-none group/th"
                                            onClick={() => handleSort('chg_1d')}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                Cambio %
                                                <SortIcon columnKey="chg_1d" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-center cursor-pointer hover:text-primary select-none group/th"
                                            onClick={() => handleSort('tp')}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                Precio Obj
                                                <SortIcon columnKey="tp" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-center">Fair Value</th>
                                        <th className="px-6 py-4 text-center">Mkt Cap</th>
                                        <th
                                            className="px-6 py-4 text-center cursor-pointer hover:text-primary select-none group/th"
                                            onClick={() => handleSort('s')}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                Sector
                                                <SortIcon columnKey="s" />
                                            </div>
                                        </th>
                                    </>
                                )}
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                            {loading && (!items || items.length === 0) ? (
                                <tr>
                                    <td colSpan={source === 'catalog' ? 7 : 6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm font-semibold text-text-secondary-light">Cargando datos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (!items || items.length === 0) ? (
                                <tr>
                                    <td colSpan={source === 'catalog' ? 7 : 6} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                            <Search className="w-12 h-12" />
                                            <span className="text-lg font-bold">No se encontraron resultados</span>
                                            <p className="text-sm">Prueba con otro término de búsqueda o categoría.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                Array.isArray(items) && items.map((item, idx) => {
                                    const d = item;
                                    return (
                                        <tr key={d.t || idx} className="hover:bg-background-light dark:hover:bg-surface-dark-elevated/40 transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-primary">{d.t || d.symbol}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-sm line-clamp-1">{d.n || d.name}</span>
                                                    {(d.sector || d.industry) && (
                                                        <span className="text-[10px] text-text-secondary-light uppercase">{d.sector || d.industry}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {source === 'catalog' || d.isin || d.currency ? (
                                                <>
                                                    <td className="px-6 py-4 text-center text-xs text-text-secondary-light">
                                                        {d.e || d.exchange || '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-xs font-mono">
                                                        {d.isin || '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-2 py-0.5 rounded-md bg-background-light dark:bg-black/20 text-[10px] font-bold">
                                                            {d.type || 'N/A'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-[10px] text-text-secondary-light whitespace-nowrap">
                                                        {d.last_processed_at ? new Date(d.last_processed_at).toLocaleDateString() : 'NUNCA'}
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-6 py-4 text-center text-sm font-mono">
                                                        {typeof d.p === 'number' ? `${d.p.toFixed(2)} ${d.currency || ''}` : 'N/A'}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {(d.chg_1d !== undefined && d.chg_1d !== null) || (d.change !== undefined && d.change !== null) ? (
                                                            (() => {
                                                                const val = d.chg_1d ?? d.change;
                                                                return (
                                                                    <span className={`text-xs font-bold ${val >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                        {val >= 0 ? '+' : ''}{val.toFixed(2)}%
                                                                    </span>
                                                                );
                                                            })()
                                                        ) : '—'}
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-text-primary">
                                                        {(() => {
                                                            const target = d.targetPrice ?? d.valuation?.targetPrice ?? d.fund?.target;
                                                            if (!target) return '-';
                                                            return (
                                                                <span className={`${target > (d.p || 0) ? 'text-green-400' : 'text-text-secondary'}`}>
                                                                    {target.toFixed(2)}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {(() => {
                                                            const fv = d.fairValue;
                                                            if (!fv) return '-';
                                                            return (
                                                                <span className={`text-xs font-bold ${fv > (d.p || 0) ? 'text-green-400' : 'text-text-secondary-light'}`}>
                                                                    {fv.toFixed(2)}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-xs font-mono">
                                                        {d.mkt_cap ? `${(d.mkt_cap / 1e9).toFixed(1)}B` : (d.fund?.mcap || '—')}
                                                    </td>
                                                    <td className="px-6 py-4 text-center text-xs">
                                                        {d.sector || d.s || '—'}
                                                    </td>
                                                </>
                                            )}

                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => setSelectedItem(d)}
                                                    className="p-2 rounded-lg hover:bg-primary/20 text-text-secondary-light hover:text-primary transition-all opacity-0 group-hover:opacity-100"
                                                    title={source === 'discovery' ? 'Ver Análisis Detallado' : 'Ver JSON completo'}
                                                >
                                                    {source === 'discovery' ? <Activity className="w-5 h-5" /> : <FileJson className="w-5 h-5" />}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 bg-background-light dark:bg-black/20 border-t border-border-light dark:border-border-dark flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <p className="text-sm text-text-secondary-light">
                            Mostrando <span className="font-bold text-text-primary">{Math.min(items.length, limit)}</span> de <span className="font-bold text-text-primary">{total.toLocaleString()}</span> resultados
                        </p>
                        <div className="h-4 w-px bg-border-light dark:bg-border-dark hidden sm:block" />
                        <p className="text-sm text-text-secondary-light">
                            Página <span className="font-bold text-text-primary">{currentPage}</span> de <span className="font-bold text-text-primary">{totalPages}</span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        {/* Go to page */}
                        <div className="flex items-center gap-2 bg-background-light dark:bg-surface-dark-elevated p-1 rounded-xl border border-border-light dark:border-border-dark">
                            <input
                                type="text"
                                placeholder="#"
                                value={goToPage}
                                onChange={(e) => setGoToPage(e.target.value.replace(/\D/g, ''))}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const p = parseInt(goToPage);
                                        if (p > 0 && p <= totalPages) {
                                            handlePageChange((p - 1) * limit);
                                            setGoToPage('');
                                        }
                                    }
                                }}
                                className="w-12 text-center bg-transparent text-sm font-bold outline-none"
                            />
                            <button
                                onClick={() => {
                                    const p = parseInt(goToPage);
                                    if (p > 0 && p <= totalPages) {
                                        handlePageChange((p - 1) * limit);
                                        setGoToPage('');
                                    }
                                }}
                                className="px-3 py-1 bg-primary text-black text-xs font-bold rounded-lg hover:opacity-90 transition-all"
                            >
                                Ir
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(offset - limit)}
                                disabled={offset === 0 || loading}
                                className="p-2 rounded-xl bg-surface-light dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="flex items-center gap-1 overflow-hidden">
                                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                                    // Simple sliding window for pagination
                                    let startPage = Math.max(0, Math.min(totalPages - 5, currentPage - 3));
                                    const pageIdx = startPage + i;
                                    const isCurrent = currentPage === (pageIdx + 1);

                                    if (pageIdx >= totalPages) return null;

                                    return (
                                        <button
                                            key={pageIdx}
                                            onClick={() => handlePageChange(pageIdx * limit)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${isCurrent
                                                ? 'bg-primary text-black'
                                                : 'hover:bg-primary/10 text-text-secondary-light'}`}
                                        >
                                            {pageIdx + 1}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => handlePageChange(offset + limit)}
                                disabled={offset + limit >= total || loading}
                                className="p-2 rounded-xl bg-surface-light dark:bg-surface-dark-elevated border border-border-light dark:border-border-dark hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Auditoría / Análisis */}
            {source === 'discovery' ? (
                <DiscoveryAnalysisModal
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    ticker={selectedItem?.t || selectedItem?.symbol}
                    companyName={selectedItem?.n || selectedItem?.name}
                />
            ) : (
                <SplitViewJsonModal
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    data={selectedItem || {}}
                    title={`Datos de ${selectedItem?.t || selectedItem?.symbol || 'Empresa'}`}
                />
            )}
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { FileText, Download, Trash2, RefreshCw, Calendar } from 'lucide-react';

interface LogsInfo {
    level: number;
    levelName: string;
    storage: { files: number; bytes: number };
    availableDates: { date: string; size: number }[];
}

const LOG_LEVELS = [
    { value: 0, name: 'PRODUCTION', description: 'Solo errores críticos y resúmenes de jobs' },
    { value: 1, name: 'STANDARD', description: 'Errores + warnings + inicio/fin de operaciones' },
    { value: 2, name: 'VERBOSE', description: 'Incluye detalles de progreso y procesamiento' },
    { value: 3, name: 'DEBUG', description: 'Todo (verbose + datos internos)' }
];

export function LogsManager() {
    const { api } = useAuth();
    const { addToast } = useToast();

    const [logsInfo, setLogsInfo] = useState<LogsInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentLevel, setCurrentLevel] = useState(1);

    // Date range for download/delete
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [levelFilter, setLevelFilter] = useState('ALL');

    const loadLogsInfo = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/settings/logs');
            setLogsInfo(res.data);
            setCurrentLevel(res.data.level);
        } catch (e: any) {
            addToast('Error cargando info de logs', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogsInfo();
    }, []);

    const changeLevel = async (newLevel: number) => {
        try {
            const res = await api.post('/admin/settings/logs/level', { level: newLevel });
            if (res.data.success) {
                setCurrentLevel(newLevel);
                addToast(res.data.message, 'success');
            }
        } catch (e: any) {
            addToast(e.response?.data?.message || 'Error cambiando nivel', 'error');
        }
    };

    const downloadLogs = async () => {
        try {
            const params = new URLSearchParams({
                startDate,
                endDate,
                levelFilter
            });

            const res = await api.get(`/admin/settings/logs/download?${params}`, {
                responseType: 'blob'
            });

            const blob = new Blob([res.data], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `logs_${startDate}_to_${endDate}.log`;
            a.click();
            window.URL.revokeObjectURL(url);

            addToast('Logs descargados', 'success');
        } catch (e: any) {
            addToast('Error descargando logs', 'error');
        }
    };

    const deleteLogs = async () => {
        if (!confirm(`¿Eliminar logs desde ${startDate} hasta ${endDate}?`)) return;

        try {
            const res = await api.delete('/admin/settings/logs', {
                data: { startDate, endDate }
            });

            if (res.data.success) {
                addToast(res.data.message, 'success');
                loadLogsInfo();
            }
        } catch (e: any) {
            addToast(e.response?.data?.message || 'Error eliminando logs', 'error');
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (loading) {
        return (
            <div className="bg-secondary/30 rounded-xl p-6 border border-white/5">
                <div className="animate-pulse h-32 bg-white/5 rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className="bg-secondary/30 rounded-lg md:rounded-xl p-4 md:p-6 border border-white/5 space-y-4 md:space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    <h3 className="text-lg md:text-xl font-semibold text-white">Gestión de Logs</h3>
                </div>
                <button
                    onClick={loadLogsInfo}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
                    title="Refrescar"
                >
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Storage Stats */}
            {logsInfo && (
                <div className="flex flex-wrap gap-3 md:gap-6 text-xs md:text-sm text-gray-400">
                    <span>📁 {logsInfo.storage.files} archivos</span>
                    <span>💾 {formatBytes(logsInfo.storage.bytes)} total</span>
                </div>
            )}

            {/* Log Level Selector */}
            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-400">Nivel de Log Activo</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                    {LOG_LEVELS.map((level) => (
                        <button
                            key={level.value}
                            onClick={() => changeLevel(level.value)}
                            className={`p-3 md:p-4 rounded-lg border text-left transition ${currentLevel === level.value
                                ? 'bg-primary/20 border-primary text-primary'
                                : 'bg-white/5 border-white/10 text-gray-300 hover:border-white/20'
                                }`}
                        >
                            <div className="font-medium text-sm md:text-base">{level.name}</div>
                            <div className="text-[10px] md:text-xs text-gray-400 mt-1">{level.description}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Date Range Selectors */}
            <div className="border-t border-white/10 pt-6 space-y-4">
                <h4 className="text-base md:text-lg font-medium text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Descargar / Limpiar por Fechas
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Desde</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Hasta</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                        />
                    </div>
                    <div>
                        <label className="text-sm text-gray-400 block mb-1">Filtrar Nivel</label>
                        <select
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
                        >
                            <option value="ALL">Todos</option>
                            <option value="ERROR">Solo Errores</option>
                            <option value="WARN">Warnings</option>
                            <option value="INFO">Info</option>
                            <option value="SUMMARY">Resúmenes</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={downloadLogs}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition font-medium"
                    >
                        <Download className="w-5 h-5" />
                        Descargar Logs
                    </button>
                    <button
                        onClick={deleteLogs}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition font-medium"
                    >
                        <Trash2 className="w-5 h-5" />
                        Eliminar Logs
                    </button>
                </div>
            </div>

            {/* Available Log Files */}
            {logsInfo && logsInfo.availableDates.length > 0 && (
                <div className="border-t border-white/10 pt-6">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Archivos Disponibles</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {logsInfo.availableDates.slice(0, 10).map(({ date, size }) => (
                            <div key={date} className="flex justify-between text-sm py-1 px-2 rounded bg-white/5">
                                <span className="text-gray-300">{date}</span>
                                <span className="text-gray-500">{formatBytes(size)}</span>
                            </div>
                        ))}
                        {logsInfo.availableDates.length > 10 && (
                            <div className="text-xs text-gray-500 text-center py-1">
                                +{logsInfo.availableDates.length - 10} más...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

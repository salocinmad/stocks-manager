
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export const MyInvestorImport: React.FC = () => {
    const { api } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [portfolios, setPortfolios] = useState<any[]>([]);
    const [selectedPortfolio, setSelectedPortfolio] = useState<string>('');
    const [step, setStep] = useState(1); // 1: Upload, 2: Preview

    useEffect(() => {
        loadPortfolios();
    }, []);

    const loadPortfolios = async () => {
        try {
            const { data } = await api.get('/portfolios');
            setPortfolios(data);
            if (data.length > 0) setSelectedPortfolio(data[0].id);
        } catch (error) {
            console.error('Error loading portfolios:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handlePreview = async () => {
        if (!file) return;
        setLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data } = await api.post('/importers/myinvestor/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPreviewData(data.data);
            setStep(2);
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error al leer el archivo Excel. Asegúrate de que es el formato correcto de MyInvestor.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!selectedPortfolio || previewData.length === 0) return;
        setImporting(true);
        try {
            const { data } = await api.post('/importers/myinvestor/confirm', {
                portfolioId: selectedPortfolio,
                operations: previewData
            });
            alert(`Importación completada. ${data.imported} operaciones guardadas.`);
            setStep(1);
            setFile(null);
            setPreviewData([]);
        } catch (error) {
            console.error('Import error:', error);
            alert('Error al guardar datos.');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="w-full flex flex-col gap-6 animate-fade-in">
            {/* Step 1: Upload - Centered Area inside the tab */}
            {step === 1 && (
                <div className="bg-white dark:bg-surface-dark rounded-3xl border border-border-light dark:border-border-dark p-8 md:p-12 text-center shadow-sm">
                    <div className="max-w-3xl mx-auto">
                        <div className="size-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-4xl">upload_file</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-4">Sube tu Excel de MyInvestor</h2>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark mb-8 text-lg">
                            Sube el archivo "Informe de Movimientos" descargado de MyInvestor (.xlsx).
                            El sistema detectará automáticamente las operaciones y las convertirá cronológicamente.
                        </p>

                        {/* Selector de Cartera Destino - Paso 1 */}
                        <div className="mb-10 flex justify-center w-full">
                            <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl flex flex-col md:flex-row items-center gap-4 border border-border-light dark:border-border-dark">
                                <div className="flex items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark">
                                    <span className="material-symbols-outlined">wallet</span>
                                    <span className="font-bold">Cartera Destino:</span>
                                </div>
                                <select
                                    value={selectedPortfolio}
                                    onChange={(e) => setSelectedPortfolio(e.target.value)}
                                    className="bg-transparent font-bold text-lg text-primary focus:outline-none cursor-pointer border-b-2 border-transparent hover:border-primary transition-colors text-center md:text-left py-1"
                                >
                                    {portfolios.length > 0 ? (
                                        portfolios.map(p => (
                                            <option key={p.id} value={p.id} className="text-black dark:text-black">{p.name}</option>
                                        ))
                                    ) : (
                                        <option value="">Cargando carteras...</option>
                                    )}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-6">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="fileInput"
                            />
                            <label
                                htmlFor="fileInput"
                                className="cursor-pointer group relative w-full max-w-md"
                            >
                                <div className={`border-3 border-dashed rounded-2xl p-10 transition-all ${file ? 'border-primary bg-primary/5' : 'border-gray-300 dark:border-gray-700 hover:border-primary hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                    {file ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="material-symbols-outlined text-4xl text-green-500">check_circle</span>
                                            <span className="font-bold text-lg">{file.name}</span>
                                            <span className="text-xs opacity-50">Click para cambiar</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark group-hover:text-primary transition-colors">
                                            <span className="material-symbols-outlined text-4xl mb-2">description</span>
                                            <span className="font-medium text-lg">Click para seleccionar archivo</span>
                                            <span className="text-xs opacity-50">Soporta .xlsx y .xls</span>
                                        </div>
                                    )}
                                </div>
                            </label>

                            <button
                                onClick={handlePreview}
                                disabled={!file || loading}
                                className="bg-primary text-black font-extrabold text-lg py-4 px-12 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-primary/20"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="animate-spin material-symbols-outlined">progress_activity</span>
                                        Analizando...
                                    </span>
                                ) : 'Analizar Archivo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Preview - Full Width Table */}
            {step === 2 && (
                <div className="flex flex-col gap-6 animate-fade-in-up">
                    <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center">
                                <span className="material-symbols-outlined">fact_check</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">Vista Previa</h3>
                                <p className="text-sm opacity-60">{previewData.length} operaciones encontradas</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-gray-50 dark:bg-black/20 px-4 py-2 rounded-xl">
                            <span className="text-sm font-bold opacity-70">Destino:</span>
                            <select
                                className="bg-transparent font-bold text-primary focus:outline-none cursor-pointer"
                                value={selectedPortfolio}
                                onChange={(e) => setSelectedPortfolio(e.target.value)}
                            >
                                {portfolios.map(p => (
                                    <option key={p.id} value={p.id} className="text-black">{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-surface-dark rounded-3xl border border-border-light dark:border-border-dark overflow-hidden shadow-sm">
                        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 dark:bg-black/20 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr className="text-xs uppercase tracking-wider font-bold opacity-70">
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Ticker (ISIN)</th>
                                        <th className="p-4 text-right">Cant.</th>
                                        <th className="p-4 text-right">Precio</th>
                                        <th className="p-4 text-right">Total</th>
                                        <th className="p-4">Divisa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="p-4 whitespace-nowrap font-medium">{new Date(row.date).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-lg text-xs font-bold ${row.type === 'BUY' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {row.type === 'BUY' ? 'COMPRA' : 'VENTA'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-base">{row.ticker}</span>
                                                    <span className="text-xs opacity-50 font-mono">{row.isin}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-mono text-base">{row.shares}</td>
                                            <td className="p-4 text-right font-mono opacity-80">{row.price.toFixed(2)}</td>
                                            <td className="p-4 text-right font-bold text-base">{row.total.toFixed(2)}</td>
                                            <td className="p-4 opacity-60 font-medium">{row.currency}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex gap-4 justify-end pt-4">
                        <button
                            onClick={() => { setStep(1); setFile(null); setPreviewData([]); }}
                            className="px-6 py-4 rounded-xl font-bold text-text-secondary-light hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmImport}
                            disabled={importing}
                            className="px-8 py-4 rounded-xl font-bold bg-primary text-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center gap-3"
                        >
                            {importing ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">sync</span>
                                    Importando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">cloud_upload</span>
                                    Confirmar Importación
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

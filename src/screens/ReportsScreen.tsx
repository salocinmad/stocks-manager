import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';

interface Portfolio {
  id: string;
  name: string;
  is_favorite: boolean;
}

export const ReportsScreen: React.FC = () => {
  const { api } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Carteras y Años
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

  // Cargar carteras al montar
  useEffect(() => {
    const fetchPortfolios = async () => {
      try {
        const { data } = await api.get<Portfolio[]>('/portfolios');
        setPortfolios(data);

        // Seleccionar favorita o la primera
        if (data.length > 0) {
          const favorite = data.find(p => p.is_favorite);
          setSelectedPortfolioId(favorite ? favorite.id : data[0].id);
        }
      } catch (err) {
        console.error("Error loading portfolios:", err);
      }
    };
    fetchPortfolios();
  }, [api]);

  // Cargar años disponibles al cambiar de cartera
  useEffect(() => {
    const fetchYears = async () => {
      if (!selectedPortfolioId) return;
      try {
        const { data } = await api.get<number[]>(`/reports/years?portfolioId=${selectedPortfolioId}`);
        setAvailableYears(data);

        // Si el año seleccionado actualmente no está en la lista disponible, cambiar al más reciente
        if (!data.includes(selectedYear)) {
          setSelectedYear(data[0]);
        }
      } catch (err) {
        console.error("Error loading fiscal years:", err);
      }
    };
    fetchYears();
  }, [selectedPortfolioId, api, selectedYear]); // Added selectedYear to dependencies to re-evaluate if it's still valid

  const loadReport = async () => {
    if (!selectedPortfolioId) return; // Esperar a tener cartera seleccionada

    setLoading(true);
    try {
      const { data } = await api.get(`/reports/aeat/${selectedYear}?portfolioId=${selectedPortfolioId}`);
      setReportData(data);
    } catch (error) {
      console.error('Error loading report:', error);
      // alert('Error al cargar el informe. Revisa la consola.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPortfolioId) {
      loadReport();
    }
  }, [selectedYear, selectedPortfolioId]);

  const downloadExcel = () => {
    if (!reportData?.operations) return;

    // Headers
    let csv = 'Ticker;Fecha Compra (Origen);Fecha Venta;Cantidad;Precio Venta (Orig);Divisa;Tasa Venta;Precio Compra (Orig);Tasa Compra;Ganancia/Pérdida (EUR)\n';

    // Rows
    reportData.operations.forEach((op: any) => {
      const row = [
        op.ticker,
        typeof op.buyDate === 'string' && op.buyDate.startsWith('N/A') ? op.buyDate : new Date(op.buyDate).toLocaleDateString(),
        new Date(op.saleDate).toLocaleDateString(),
        Number(op.qty).toLocaleString('es-ES', { maximumFractionDigits: 6, useGrouping: false }),
        op.salePriceOrig.toFixed(4).replace('.', ','),
        op.currency,
        op.saleRate.toFixed(6).replace('.', ','),
        op.buyPriceOrig.toFixed(4).replace('.', ','),
        op.buyRate.toFixed(6).replace('.', ','),
        op.gainLossEur.toFixed(2).replace('.', ',')
      ];
      csv += row.join(';') + '\n';
    });

    // Totales al final
    csv += `\n;;;;;;TOTAL;${reportData.summary.totalGainLoss.toFixed(2).replace('.', ',')}`;

    // Download logic
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Informe_AEAT_${selectedYear}_${portfolios.find(p => p.id === selectedPortfolioId)?.name || 'Cartera'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPDF = () => {
    window.print();
  };

  return (
    <main className="flex-1 overflow-y-auto w-full p-6 md:p-10 lg:px-16 flex flex-col gap-10 bg-background-light dark:bg-background-dark print:p-0 print:bg-white print:block print:h-auto print:overflow-visible">
      <div className="print:hidden">

      </div>

      <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">

        {/* Controls Area (Hidden on Print) */}
        <div className="flex flex-col xl:flex-row gap-6 items-center justify-between bg-white dark:bg-surface-dark p-6 rounded-3xl border border-border-light dark:border-border-dark print:hidden">

          <div className="flex flex-col md:flex-row items-center gap-6 w-full xl:w-auto">
            {/* Selector Año */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="font-bold text-lg whitespace-nowrap">Año Fiscal:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full md:w-auto bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Selector Cartera */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="font-bold text-lg whitespace-nowrap">Cartera:</span>
              <select
                value={selectedPortfolioId}
                onChange={(e) => setSelectedPortfolioId(e.target.value)}
                className="w-full md:w-auto bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={portfolios.length === 0}
              >
                {portfolios.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_favorite ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4 w-full xl:w-auto justify-end">
            <button
              onClick={downloadExcel}
              disabled={!reportData || reportData.operations.length === 0}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="material-symbols-outlined">table_view</span>
              Excel
            </button>
            <button
              onClick={printPDF}
              disabled={!reportData}
              className="flex items-center gap-2 bg-primary text-black font-bold py-3 px-6 rounded-xl transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="material-symbols-outlined">print</span>
              PDF
            </button>
          </div>
        </div>

        {/* Report Content */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin size-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-xl font-bold">Calculando informe FIFO...</p>
          </div>
        ) : reportData ? (
          <div id="printable-report" className="bg-white dark:bg-surface-dark rounded-3xl border border-border-light dark:border-border-dark p-8 print:border-none print:pt-10 print:px-10 print:pb-0 print:text-black print:dark:bg-white print:dark:text-black">

            {/* Header Report (Print styled) */}
            <div className="mb-8 border-b pb-6 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-bold mb-2">Informe Fiscal de Operaciones {selectedYear}</h1>
                <p className="opacity-60">Calculado bajo método FIFO (First-In, First-Out)</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-60">Fecha de emisión</p>
                <p className="font-bold">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 print:grid-cols-4">
              <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl print:bg-gray-100">
                <p className="text-sm opacity-60 mb-1">Resultado Neto</p>
                <p className={`text-2xl font-bold ${reportData.summary.totalGainLoss >= 0 ? 'text-green-500' : 'text-red-500'} print:text-black`}>
                  {reportData.summary.totalGainLoss.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-black/20 rounded-2xl print:bg-gray-100">
                <p className="text-sm opacity-60 mb-1">Total Operaciones</p>
                <p className="text-2xl font-bold">{reportData.summary.totalOperations}</p>
              </div>
            </div>

            {/* Transactions Table */}
            {reportData.operations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-primary text-sm uppercase tracking-wider opacity-60">
                      <th className="py-3 px-2">Ticker</th>
                      <th className="py-3 px-2">Fecha Compra</th>
                      <th className="py-3 px-2">Fecha Venta</th>
                      <th className="py-3 px-2 text-right">Cant.</th>
                      <th className="py-3 px-2 text-right">Precio Venta</th>
                      <th className="py-3 px-2 text-right">Coste Base</th>
                      <th className="py-3 px-2 text-right">Resultado (EUR)</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-border-light dark:divide-border-dark">
                    {reportData.operations.map((op: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="py-3 px-2 font-bold">{op.ticker}</td>
                        <td className="py-3 px-2 opacity-70">
                          {typeof op.buyDate === 'string' && op.buyDate.startsWith('N/A') ? op.buyDate : new Date(op.buyDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2">{new Date(op.saleDate).toLocaleDateString()}</td>
                        <td className="py-3 px-2 text-right">
                          {Number(op.qty).toLocaleString('es-ES', { maximumFractionDigits: 6 })}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="font-bold">{op.salePriceEur.toFixed(2)} €</div>
                          {op.currency !== 'EUR' && (
                            <div className="text-[10px] opacity-50">{op.salePriceOrig.toFixed(2)} {op.currency} (@{op.saleRate.toFixed(4)})</div>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <div className="font-bold">{op.buyPriceEur.toFixed(2)} €</div>
                          {op.currency !== 'EUR' && (
                            <div className="text-[10px] opacity-50">{op.buyPriceOrig.toFixed(2)} {op.currency} (@{op.buyRate.toFixed(4)})</div>
                          )}
                        </td>
                        <td className={`py-3 px-2 text-right font-bold ${op.gainLossEur >= 0 ? 'text-green-500' : 'text-red-500'} print:text-black`}>
                          {op.gainLossEur >= 0 ? '+' : ''}{op.gainLossEur.toFixed(2)} €
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center opacity-50 border-2 border-dashed border-border-light dark:border-border-dark rounded-3xl">
                <span className="material-symbols-outlined text-4xl mb-2">history_edu</span>
                <p>No hay operaciones fiscales registradas para el año {selectedYear}.</p>
              </div>
            )}

            <div className="mt-12 pt-8 border-t text-xs text-center opacity-40 print:block hidden">
              <p>Informe generado automáticamente por Stocks Manager. Validez informativa para declaración AEAT.</p>
            </div>

          </div>
        ) : null}

      </div>
    </main>
  );
};

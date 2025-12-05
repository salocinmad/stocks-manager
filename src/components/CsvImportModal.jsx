import React, { useState } from 'react';
import { authenticatedFetch } from '../services/auth.js';

export default function CsvImportModal({ isOpen, onClose, onSuccess, theme, portfolioId }) {
    const [csvText, setCsvText] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [step, setStep] = useState(1); // 1: Input, 2: Review/Edit
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const parseCsv = () => {
        try {
            setError(null);
            const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);

            // Assuming format from image:
            // Line 0: FECHAS... (Header 1)
            // Line 1: FECHA OPERACION, LIQUIDACION... (Header 2)
            // Line 2+: DATA
            // AND Reversed order (oldest at bottom)

            // Skip first 2 lines
            const dataLines = lines.slice(2);

            // Reverse to get chronological order (Oldest first? Or newest first?)
            // DB doesn't care about insert order for ID mostly, but logically we want chronological
            // If the file has newest at top (Line 2), and oldest at bottom.
            // We usually process chronological. So we reverse it.
            const chronologicalLines = [...dataLines].reverse();

            const initialParsed = chronologicalLines.map((line, index) => {
                // CSV parsing can be tricky with quotes. Assuming simple tab/semicolon/comma split?
                // Image looks like spreadsheet copy-paste, likely Tab-separated if pasted, or specific CSV.
                // Let's assume Tab separated if pasted from Excel/Web, or semicolon.
                // Let's try auto-detect.

                let delimiter = '\t';
                if (line.includes(';') && !line.includes('\t')) delimiter = ';';
                else if (line.includes(',') && !line.includes('\t')) delimiter = ',';

                const cols = line.split(delimiter);

                // Mapping based on image columns (0-indexed)
                // 0: Fecha Operación
                // 1: Fecha Liquidación
                // 2: Operación ID?
                // 3: Mercado (NASDAQ, NYSE)
                // 4: Tipo (COMPRA/VENTA)
                // 5: ISIN
                // 6: Valor (Nombre)
                // 7: Títulos
                // 8: Divisa
                // 9: Precio Neto
                // 10: Importe neto

                if (cols.length < 8) return null; // Skip invalid lines

                const typeRaw = cols[4]?.toUpperCase() || '';
                const type = typeRaw.includes('COMPRA') ? 'purchase' : typeRaw.includes('VENTA') ? 'sale' : 'unknown';

                // Parse number helper
                const parseNum = (str) => {
                    if (!str) return 0;
                    // Replace dots with nothing (thousands) and commas with dots (decimals) if european
                    // If standard, just parseFloat.
                    // Example in image: "148,24" -> 148.24
                    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
                };

                return {
                    id: index, // Temp ID
                    date: cols[0],
                    type: type,
                    isin: cols[5],
                    companyName: cols[6],
                    shares: parseNum(cols[7]),
                    currency: cols[8],
                    price: parseNum(cols[9]),
                    commission: 0, // Not explicitly in simple columns, maybe diff between price*shares and amount?
                    // Let's assume 0 for now.
                    symbol: '', // To be filled manually or by backend
                    status: 'pending' // pending, valid, error
                };
            }).filter(item => item !== null && item.type !== 'unknown');

            // Trigger identification
            identifySymbols(initialParsed);

        } catch (err) {
            setError('Error al procesar el texto: ' + err.message);
        }
    };

    const identifySymbols = async (items) => {
        setLoading(true);
        try {
            const response = await authenticatedFetch('/api/operations/identify-symbols', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: items.map(i => ({ isin: i.isin, companyName: i.companyName })) })
            });

            if (response.ok) {
                const data = await response.json();
                // Merge results back
                const merged = items.map((item, idx) => {
                    // Assuming order is preserved, which it should be in simple array map
                    const res = data.results[idx];
                    return {
                        ...item,
                        symbol: res?.symbol || '',
                        detectedSymbol: res?.symbol,
                        detectedCurrency: res?.currency,
                        detectedName: res?.name
                    };
                });
                setParsedData(merged);
            } else {
                // Fallback if endpoint fails
                setParsedData(items);
            }
        } catch (e) {
            console.error('Identification failed', e);
            setParsedData(items);
        } finally {
            setLoading(false);
            setStep(2);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        setError(null);
        try {
            const validOps = parsedData.filter(op => op.status !== 'ignore').map(op => ({
                ...op,
                portfolioId: parseInt(portfolioId)
            }));

            // Basic validation
            if (validOps.some(op => !op.symbol && !op.isin)) {
                throw new Error('Hay operaciones sin Ticker ni ISIN verificado.');
            }

            const response = await authenticatedFetch('/api/operations/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operations: validOps })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error en la importación');
            }

            const result = await response.json();
            alert(`Importado: ${result.stats.imported}. Fallos: ${result.stats.failed}`);
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateRow = (index, field, value) => {
        const newData = [...parsedData];
        newData[index] = { ...newData[index], [field]: value };
        setParsedData(newData);
    };

    const modalStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 1000
    };

    const contentStyle = {
        backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
        color: theme === 'dark' ? '#fff' : '#000',
        padding: '20px', borderRadius: '8px',
        width: '90%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto'
    };

    return (
        <div style={modalStyle}>
            <div style={contentStyle}>
                <h2>📥 Importar Operaciones (CSV/Texto)</h2>

                {error && <div style={{ backgroundColor: '#ffcccc', color: '#cc0000', padding: '10px', marginBottom: '10px' }}>{error}</div>}

                {step === 1 && (
                    <>
                        <p>Copia y pega el contenido de tu archivo (incluyendo encabezados) aquí:</p>
                        <textarea
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                            style={{ width: '100%', height: '300px', fontFamily: 'monospace', padding: '8px' }}
                            placeholder={"Fechas\t\tOperación\tMercado...\n2025-12-03\t2025-12-04..."}
                        />
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button className="button" onClick={onClose}>Cancelar</button>
                            <button className="button primary" onClick={parseCsv} disabled={!csvText.trim()}>Analizar Texto</button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '15px' }}>
                            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Tipo</th>
                                        <th>ISIN / Empresa (CSV)</th>
                                        <th>Detectado</th>
                                        <th>Ticker (Manual)</th>
                                        <th>Acciones</th>
                                        <th>Precio</th>
                                        <th>Divisa</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedData.map((row, idx) => {
                                        const currencyMismatch = row.detectedCurrency && row.currency && row.detectedCurrency !== row.currency;
                                        return (
                                            <tr key={idx} style={{ backgroundColor: row.status === 'ignore' ? '#333' : 'transparent', opacity: row.status === 'ignore' ? 0.5 : 1 }}>
                                                <td>{row.date}</td>
                                                <td style={{ color: row.type === 'purchase' ? '#4caf50' : '#f44336' }}>
                                                    {row.type === 'purchase' ? 'COMPRA' : 'VENTA'}
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '11px', color: '#888' }}>{row.isin}</div>
                                                    {row.companyName}
                                                </td>
                                                <td>
                                                    {row.detectedName ? (
                                                        <div style={{ fontSize: '12px' }}>
                                                            <div style={{ fontWeight: 'bold' }}>{row.detectedName}</div>
                                                            <div style={{ fontSize: '10px', color: currencyMismatch ? '#f44336' : '#888' }}>
                                                                {row.detectedSymbol} ({row.detectedCurrency})
                                                                {currencyMismatch && <span style={{ marginLeft: '4px' }}>⚠ Divisa Distinta</span>}
                                                            </div>
                                                        </div>
                                                    ) : <span style={{ color: '#666', fontSize: '11px' }}>-</span>}
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={row.symbol}
                                                        onChange={(e) => updateRow(idx, 'symbol', e.target.value.toUpperCase())}
                                                        placeholder="Ticker..."
                                                        style={{ width: '80px', padding: '4px', border: currencyMismatch ? '1px solid #f44336' : '1px solid #444' }}
                                                    />
                                                </td>
                                                <td>{row.shares}</td>
                                                <td>{row.price}</td>
                                                <td>
                                                    {row.currency}
                                                    {row.currency !== 'EUR' && <span style={{ fontSize: '10px', marginLeft: '4px', color: '#ffa726' }}>⚠ FX Auto</span>}
                                                </td>
                                                <td>
                                                    <button
                                                        className="button danger"
                                                        style={{ padding: '2px 6px', fontSize: '11px' }}
                                                        onClick={() => updateRow(idx, 'status', row.status === 'ignore' ? 'pending' : 'ignore')}
                                                    >
                                                        {row.status === 'ignore' ? 'Restaurar' : 'Ignorar'}
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '12px', color: '#888' }}>
                                * Si el Ticker se deja vacío, se intentará resolver automáticamente por ISIN/Nombre en el backend.
                                <br />* Tasas de cambio (FX) se obtendrán automáticamente de Yahoo Finance para la fecha indicada.
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="button" onClick={() => setStep(1)}>Atrás</button>
                                <button className="button primary" onClick={handleImport} disabled={loading}>
                                    {loading ? 'Importando...' : `Confirmar Importación (${parsedData.filter(d => d.status !== 'ignore').length})`}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

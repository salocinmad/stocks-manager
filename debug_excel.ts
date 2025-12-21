
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

try {
    const buf = readFileSync('./salida.xls');
    // Forzar lectura, a veces xls viejos necesitan type:'buffer' o 'binary'
    const wb = XLSX.read(buf, { type: 'buffer' });

    const sheetName = wb.SheetNames[0];
    console.log(`Hoja encontrada: ${sheetName}`);

    const sheet = wb.Sheets[sheetName];

    // Ver rango
    console.log(`Rango: ${sheet['!ref']}`);

    // Convertir a JSON crudo (array de arrays) para ver estructura
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log("--- PRIMERAS 10 FILAS ---");
    data.slice(0, 10).forEach((row, idx) => {
        console.log(`Fila ${idx}:`, JSON.stringify(row));
    });

} catch (e) {
    console.error("Error leyendo excel:", e);
}

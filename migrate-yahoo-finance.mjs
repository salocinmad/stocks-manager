import fs from 'fs';
import path from 'path';

const files = [
    './server/services/scheduler.js',
    './server/services/dailyClose.js',
    './server/routes/yahoo.js',
    './server/routes/admin.js'
];

function migrateFile(filePath) {
    console.log(`\n🔄 Migrando ${filePath}...`);

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 1. Cambiar el import
    if (content.includes("import yahooFinance from 'yahoo-finance2'")) {
        content = content.replace(
            "import yahooFinance from 'yahoo-finance2'",
            "import YahooFinance from 'yahoo-finance2'"
        );
        modified = true;
        console.log('  ✅ Import statement actualizado');
    }

    // 2. Agregar instancia después del último import
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1 && !content.includes('const yahooFinance = new YahooFinance')) {
        const endOfLineIndex = content.indexOf('\n', lastImportIndex);
        const before = content.substring(0, endOfLineIndex + 1);
        const after = content.substring(endOfLineIndex + 1);

        content = before +
            '\n// Instancia de Yahoo Finance v3\n' +
            'const yahooFinance = new YahooFinance({\n' +
            '  suppressNotices: [\'yahooSurvey\'],\n' +
            '  queue: {\n' +
            '    concurrency: 1,\n' +
            '    timeout: 300\n' +
            '  }\n' +
            '});\n' +
            after;

        modified = true;
        console.log('  ✅ Instancia de YahooFinance creada');
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`  💾 Archivo guardado`);
    } else {
        console.log('  ℹ️  No requiere cambios');
    }
}

console.log('🚀 Iniciando migración de yahoo-finance2 a v3...\n');

files.forEach(file => {
    try {
        if (fs.existsSync(file)) {
            migrateFile(file);
        } else {
            console.log(`⚠️  Archivo no encontrado: ${file}`);
        }
    } catch (error) {
        console.error(`❌ Error procesando ${file}:`, error.message);
    }
});

console.log('\n✅ Migración completada');
console.log('\n📝 Próximos pasos:');
console.log('1. Verificar sintaxis: node --check server/services/scheduler.js');
console.log('2. Verificar sintaxis: node --check server/services/dailyClose.js');
console.log('3. Verificar sintaxis: node --check server/routes/yahoo.js');
console.log('4. Verificar sintaxis: node --check server/routes/admin.js');
console.log('5. Actualizar package.json: "yahoo-finance2": "^3.0.0"');
console.log('6. Rebuild Docker: docker compose build --no-cache');

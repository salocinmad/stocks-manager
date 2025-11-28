import fs from 'fs';

const filePath = './server/routes/admin.js';
let content = fs.readFileSync(filePath, 'utf8');

// Modelos que deben estar importados
const requiredImports = [
    { name: 'User', path: '../models/User.js' },
    { name: 'Portfolio', path: '../models/Portfolio.js' },
    { name: 'PortfolioReport', path: '../models/PortfolioReport.js' },
    { name: 'Config', path: '../models/Config.js' },
    { name: 'Operation', path: '../models/Operation.js' },
    { name: 'PriceCache', path: '../models/PriceCache.js' },
    { name: 'DailyPortfolioStats', path: '../models/DailyPortfolioStats.js' },
    { name: 'DailyPrice', path: '../models/DailyPrice.js' },
    { name: 'Note', path: '../models/Note.js' },
    { name: 'PositionOrder', path: '../models/PositionOrder.js' },
    { name: 'ProfilePicture', path: '../models/ProfilePicture.js' },
    { name: 'ExternalLinkButton', path: '../models/ExternalLinkButton.js' }
];

// Verificar e imprimir estado
console.log('📋 Verificación de Modelos en Backup:\n');
console.log('Modelos en /server/models:');
const modelsInDir = [
    'Config', 'DailyPortfolioStats', 'DailyPrice', 'ExternalLinkButton',
    'Note', 'Operation', 'Portfolio', 'PortfolioReport',
    'PositionOrder', 'PriceCache', 'ProfilePicture', 'User'
];
modelsInDir.forEach(m => console.log(`  - ${m}`));

console.log('\nModelos en backup (admin.js):');
const backupMatch = content.match(/const models = \[(.*?)\]/);
if (backupMatch) {
    const modelsInBackup = backupMatch[1].split(',').map(m => m.trim());
    modelsInBackup.forEach(m => console.log(`  - ${m}`));

    console.log('\n✅ Estado:');
    modelsInDir.forEach(modelName => {
        const isIncluded = modelsInBackup.includes(modelName);
        console.log(`  ${isIncluded ? '✅' : '❌'} ${modelName}`);
    });
}

// Agregar imports faltantes
requiredImports.forEach(({ name, path }) => {
    const importLine = `import ${name} from '${path}'`;
    if (!content.includes(importLine)) {
        // Insertar después del último import
        const lastImportIndex = content.lastIndexOf('import');
        const nextLineIndex = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, nextLineIndex + 1) + importLine + '\n' + content.slice(nextLineIndex + 1);
        console.log(`\n➕ Agregado import: ${name}`);
    }
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Verificación completada');

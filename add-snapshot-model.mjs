import fs from 'fs';

const adminPath = './server/routes/admin.js';
let adminContent = fs.readFileSync(adminPath, 'utf8');

// 1. Add DailyPositionSnapshot import
if (!adminContent.includes('DailyPositionSnapshot')) {
    adminContent = adminContent.replace(
        "import DailyPrice from '../models/DailyPrice.js'",
        "import DailyPrice from '../models/DailyPrice.js'\nimport DailyPositionSnapshot from '../models/DailyPositionSnapshot.js'"
    );
}

// 2. Add DailyPositionSnapshot to both models arrays (after DailyPrice)
adminContent = adminContent.replace(
    /DailyPrice, Note/g,
    'DailyPrice, DailyPositionSnapshot, Note'
);

fs.writeFileSync(adminPath, adminContent, 'utf8');
console.log('✅ DailyPositionSnapshot agregado al backup');

// Also update database.js to import the new model
const dbPath = './server/config/database.js';
let dbContent = fs.readFileSync(dbPath, 'utf8');

if (!dbContent.includes('DailyPositionSnapshot')) {
    // Find the models import section and add it
    const importMatch = dbContent.match(/(import.*DailyPrice.*\n)/);
    if (importMatch) {
        dbContent = dbContent.replace(
            importMatch[0],
            importMatch[0] + "import DailyPositionSnapshot from '../models/DailyPositionSnapshot.js';\n"
        );
        fs.writeFileSync(dbPath, dbContent, 'utf8');
        console.log('✅ DailyPositionSnapshot agregado a database.js');
    }
}

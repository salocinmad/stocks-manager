/**
 * Script de diagnóstico para verificar AssetProfile
 * Ejecutar con: node server/scripts/checkAssetProfiles.js
 */

import sequelize from '../config/database.js';
import AssetProfile from '../models/AssetProfile.js';

async function checkProfiles() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos establecida');

        // Contar registros
        const count = await AssetProfile.count();
        console.log(`\n📊 Total de perfiles en AssetProfile: ${count}`);

        // Obtener todos los perfiles
        const profiles = await AssetProfile.findAll({
            limit: 20,
            order: [['updatedAt', 'DESC']]
        });

        console.log('\n📋 Últimos 20 perfiles:');
        profiles.forEach(p => {
            console.log(`\n  Symbol: ${p.symbol}`);
            console.log(`  Sector: ${p.sector}`);
            console.log(`  Industry: ${p.industry}`);
            console.log(`  Beta: ${p.beta}`);
            console.log(`  Dividend Yield: ${p.dividendYield}%`);
            console.log(`  Market Cap: ${p.marketCap}`);
            console.log(`  Updated: ${p.updatedAt}`);
        });

        // Verificar cuántos son "Unknown"
        const unknownCount = await AssetProfile.count({
            where: { sector: 'Unknown' }
        });
        console.log(`\n⚠️  Perfiles con sector "Unknown": ${unknownCount}`);

        await sequelize.close();
        console.log('\n✅ Diagnóstico completado');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkProfiles();


import sql from './db';

async function cleanData() {
    console.log('🧹 Cleaning transaction history and positions...');
    try {
        // Borrar transacciones y posiciones (tablas dependientes de portfolios)
        // No borramos portfolios ni usuarios, solo el contenido financiero.
        await sql`TRUNCATE TABLE transactions, positions, watchlist_items CASCADE`;

        console.log('✅ Data cleaned successfully. History is empty.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error cleaning data:', error);
        process.exit(1);
    }
}

cleanData();

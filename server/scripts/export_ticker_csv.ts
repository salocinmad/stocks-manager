import sql from '../db';
import fs from 'fs';
import path from 'path';

const TICKER = (process.argv[2] || 'AMD').toUpperCase();
// Save to project root
const OUTPUT_FILE = path.resolve(process.cwd(), `${TICKER}_operations.csv`);

async function main() {
    console.log(`Exporting operations for ${TICKER}...`);

    try {
        const ops = await sql`
            SELECT 
                id, 
                date, 
                type, 
                ticker, 
                amount, 
                price_per_unit, 
                fees, 
                currency, 
                exchange_rate_to_eur,
                created_at,
                portfolio_id
            FROM transactions 
            WHERE ticker = ${TICKER}
            ORDER BY date DESC, created_at DESC
        `;

        if (ops.length === 0) {
            console.log(`No operations found for ticker ${TICKER}.`);
            process.exit(0);
        }

        const headers = [
            'ID', 
            'Date', 
            'Type', 
            'Ticker', 
            'Amount', 
            'Price', 
            'Currency', 
            'Commission', 
            'ExchangeRateToEUR',
            'PortfolioID',
            'CreatedAt'
        ];
        
        const rows = ops.map(op => [
            op.id,
            op.date ? new Date(op.date).toISOString().split('T')[0] : 'N/A',
            op.type,
            op.ticker,
            op.amount,
            op.price_per_unit,
            op.currency,
            op.fees,
            op.exchange_rate_to_eur || '1.0',
            op.portfolio_id,
            op.created_at
        ].map(val => val === null || val === undefined ? '' : String(val)).join(';'));

        const csvContent = [headers.join(';'), ...rows].join('\n');
        
        fs.writeFileSync(OUTPUT_FILE, csvContent);
        console.log(`✅ Successfully exported ${ops.length} operations to:`);
        console.log(OUTPUT_FILE);

    } catch (error) {
        console.error('Error exporting CSV:', error);
    } finally {
        process.exit(0);
    }
}

main();

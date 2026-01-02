
import yahooFinance from 'yahoo-finance2';

async function main() {
    try {
        const ticker = 'AAPL';
        console.log(`Fetching quoteSummary for ${ticker}...`);

        // Modules currently used: 'financialData', 'defaultKeyStatistics', 'summaryDetail', 'calendarEvents', 'price'
        const modules = [
            'financialData',
            'defaultKeyStatistics',
            'summaryDetail',
            'calendarEvents',
            'price',
            'earnings',
            'upgradeDowngradeHistory',
            'assetProfile'
        ];

        // The library instance is the default export in some versions or needs 'new'
        // In this project it seems to be 'new YahooFinance()'
        // But let's try just calling it on the default export if it's an instance, OR as the error suggested.

        // Based on error: Call `const yahooFinance = new YahooFinance()` first.
        // It seems the default export IS the class in this build

        const yf = new yahooFinance();

        const summary = await yf.quoteSummary(ticker, { modules: modules as any });

        console.log("=== Financial Data ===");
        console.dir(summary.financialData, { depth: null });

        console.log("\n=== Key Statistics ===");
        console.dir(summary.defaultKeyStatistics, { depth: null });

        console.log("\n=== Summary Detail ===");
        console.dir(summary.summaryDetail, { depth: null });

        console.log("\n=== Earnings ===");
        console.dir(summary.earnings, { depth: null });

    } catch (e) {
        console.error("Error:", e);
    }
}

main();

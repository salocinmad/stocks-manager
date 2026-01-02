
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function checkFundamentals() {
    try {
        const ticker = 'AAPL'; // Usar una empresa grande como ejemplo
        console.log(`Fetching fundamentals for ${ticker}...`);

        const result = await yahooFinance.quoteSummary(ticker, {
            modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'incomeStatementHistory']
        });

        console.log('\n--- Financial Data ---');
        console.log(JSON.stringify(result.financialData, null, 2));

        console.log('\n--- Key Statistics ---');
        console.log(JSON.stringify(result.defaultKeyStatistics, null, 2));

        console.log('\n--- Summary Detail ---');
        console.log(JSON.stringify(result.summaryDetail, null, 2));

    } catch (e) {
        console.error('Error:', e);
    }
}

checkFundamentals();

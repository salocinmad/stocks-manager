import yahooFinance from 'yahoo-finance2';

const yf = new yahooFinance();

async function researchCalendar() {
    const ticker = 'AAPL'; // Use a major stock
    try {
        console.log(`Fetching calendar data for ${ticker}...`);

        // 1. Check quoteSummary -> calendarEvents
        const summary = await yf.quoteSummary(ticker, {
            modules: ['calendarEvents', 'earnings']
        });

        console.log('\n--- Calendar Events (quoteSummary) ---');
        await Bun.write('server/scripts/calendar_output.json', JSON.stringify(summary, null, 2));
        console.log('Output written to server/scripts/calendar_output.json');

        // 2. Check if there are other distinct queries (fetching historical is easy, future is harder)
        // options like 'earningsHistory' might be useful but usually are past.

    } catch (error) {
        console.error('Error fetching calendar data:', error);
    }
}

researchCalendar();

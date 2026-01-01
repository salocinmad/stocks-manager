
async function exploreYahooModules() {
    const ticker = 'ASTS';
    const modules = [
        'financialData',
        'defaultKeyStatistics',
        'calendarEvents', // Next earnings
        'recommendationTrend', // Analyst ratings
        'summaryDetail' // Market Cap, Beta
    ];

    console.log(`Fetching Modules for ${ticker}: ${modules.join(', ')}`);

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules.join(',')}`;
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) throw new Error(res.statusText);

        const data = await res.json();
        const result = data.quoteSummary?.result?.[0];

        if (!result) return console.log('No result found.');

        console.log('\n--- FINANCIAL DATA ---');
        console.log({
            currentPrice: result.financialData?.currentPrice?.fmt,
            targetHigh: result.financialData?.targetHighPrice?.fmt,
            targetMean: result.financialData?.targetMeanPrice?.fmt,
            recommendation: result.financialData?.recommendationKey
        });

        console.log('\n--- KEY STATISTICS ---');
        console.log({
            forwardPE: result.defaultKeyStatistics?.forwardPE?.fmt,
            beta: result.defaultKeyStatistics?.beta?.fmt,
            shortRatio: result.defaultKeyStatistics?.shortRatio?.fmt, // Short interest!
            sharesShort: result.defaultKeyStatistics?.sharesShort?.fmt
        });

        console.log('\n--- EARNINGS ---');
        console.log({
            nextEarningsDate: result.calendarEvents?.earnings?.earningsDate
        });

        console.log('\n--- SUMMARY DETAIL ---');
        console.log({
            marketCap: result.summaryDetail?.marketCap?.fmt,
            fiftyDayAverage: result.summaryDetail?.fiftyDayAverage?.fmt,
            twoHundredDayAverage: result.summaryDetail?.twoHundredDayAverage?.fmt
        });

    } catch (e) {
        console.error(e);
    }
}

exploreYahooModules();

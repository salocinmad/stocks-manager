
async function exploreAdvancedYahoo() {
    const ticker = 'ASTS';
    const modules = [
        'insiderTransactions',
        'earningsHistory', // Surprises
        'upgradeDowngradeHistory', // Analyst changes
        'majorHoldersBreakdown', // % Institutional
        'netSharePurchaseActivity' // Net insider buying?
    ];

    console.log(`Fetching Advanced Modules for ${ticker}: ${modules.join(', ')}`);

    // Using V10 quoteSummary
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules.join(',')}`;
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            }
        });

        if (!res.ok) throw new Error(res.statusText + ' ' + res.status);

        const data = await res.json();
        const result = data.quoteSummary?.result?.[0];

        if (!result) return console.log('No result found.');

        console.log('\n--- INSIDER TRANSACTIONS ---');
        const transactions = result.insiderTransactions?.transactions?.slice(0, 3) || [];
        transactions.forEach((t: any) => {
            console.log(`- ${t.startDates?.[0]?.fmt}: ${t.filerName} (${t.filerRelation}) ${t.transactionText} ${t.shares?.fmt} shares`);
        });

        console.log('\n--- EARNINGS SURPRISE HISTORY ---');
        const history = result.earningsHistory?.history?.slice(0, 4) || [];
        history.forEach((h: any) => {
            console.log(`- ${h.quarter?.fmt}: Est ${h.epsEstimate?.fmt} vs Actual ${h.epsActual?.fmt} (Surprise: ${h.surprisePercent?.fmt})`);
        });

        console.log('\n--- UPGRADE/DOWNGRADE HISTORY ---');
        const upgrades = result.upgradeDowngradeHistory?.history?.slice(0, 3) || [];
        upgrades.forEach((u: any) => {
            console.log(`- ${u.epochGradeDate ? new Date(u.epochGradeDate * 1000).toISOString().split('T')[0] : 'N/A'}: ${u.firm} -> ${u.toGrade} (${u.action})`);
        });

        console.log('\n--- OWNERSHIP ---');
        console.log({
            insidersPercentHeld: result.majorHoldersBreakdown?.insidersPercentHeld?.fmt,
            institutionsPercentHeld: result.majorHoldersBreakdown?.institutionsPercentHeld?.fmt
        });

    } catch (e) {
        console.error(e);
    }
}

exploreAdvancedYahoo();

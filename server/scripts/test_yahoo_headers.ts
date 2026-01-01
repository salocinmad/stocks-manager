// Test script to check Yahoo API with Browser Headers
async function testYahooHeaders() {
    const ticker = 'DIA.MC';
    console.log(`Testing Yahoo API for ${ticker} with Browser Headers...\n`);

    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryProfile,price`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });

        console.log(`Status: ${response.status} ${response.statusText}`);

        if (response.ok) {
            const data = await response.json();
            const profile = data.quoteSummary?.result?.[0]?.summaryProfile;

            if (profile) {
                console.log('✅ Success! Data received:');
                console.log(`   Sector: ${profile.sector}`);
                console.log(`   Industry: ${profile.industry}`);
                console.log(`   Country: ${profile.country}`);
            } else {
                console.log('⚠️  Response OK but no profile data found.');
                console.log(JSON.stringify(data, null, 2));
            }
        } else {
            console.log('❌ Request failed.');
            const text = await response.text();
            console.log(`   Body: ${text.substring(0, 200)}...`);
        }

    } catch (e: any) {
        console.log(`❌ Network Error: ${e.message}`);
    }
}

testYahooHeaders();

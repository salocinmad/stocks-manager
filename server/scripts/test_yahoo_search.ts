
const run = async () => {
    const query = 'Apple';
    console.log(`--- SEARCHING ${query} DIRECTLY ---`);
    try {
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
        const res = await fetch(url);

        if (!res.ok) {
            console.log(`❌ Status: ${res.status}`);
            return;
        }

        const data = await res.json();
        const quotes = data.quotes || [];

        console.log(`Found ${quotes.length} results.`);
        quotes.slice(0, 3).forEach((q: any) => {
            console.log(`[${q.symbol}] ${q.shortname} Exch:${q.exchange} Type:${q.quoteType}`);
        });

    } catch (e: any) {
        console.log(`❌ Search Error: ${e.message}`);
    }
};

run();

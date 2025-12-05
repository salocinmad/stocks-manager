
import yahooFinance from 'yahoo-finance2';

const run = async () => {
    const isin = 'US70438V1061'; // Paylocity
    const name = 'PAYLOCITY HOLDING';

    console.log(`--- DEBUGGING ISIN: ${isin} ---`);
    try {
        const result = await yahooFinance.search(isin);
        console.log(`Search result for ISIN '${isin}':`);
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error searching ISIN:', e);
    }

    console.log(`\n--- DEBUGGING NAME: ${name} ---`);
    try {
        const result = await yahooFinance.search(name);
        console.log(`Search result for Name '${name}':`);
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error searching Name:', e);
    }
};

run();

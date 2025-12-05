
import yahooFinance from 'yahoo-finance2';

const test = async () => {
    const isin = 'US70438V1061';
    const name = 'PAYLOCITY HOLDING';

    console.log(`Searching for ISIN: ${isin}`);
    try {
        const result = await yahooFinance.search(isin);
        console.log('Result ISIN:', JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error searching ISIN:', e);
    }

    console.log(`Searching for Name: ${name}`);
    try {
        const result2 = await yahooFinance.search(name);
        console.log('Result Name:', JSON.stringify(result2, null, 2));
    } catch (e) {
        console.error('Error searching Name:', e);
    }
}

test();


// @ts-ignore
import * as yfNavbar from 'yahoo-finance2';
// @ts-ignore
import yfDefault from 'yahoo-finance2';

const run = async () => {
    console.log('--- IMPORT STRUCTURE ---');

    console.log('1. Namespace Import (* as yfNavbar):');
    console.log('   Keys:', Object.keys(yfNavbar));
    // @ts-ignore
    console.log('   default export present?', !!yfNavbar.default);

    console.log('\n2. Default Import (yfDefault):');
    console.log('   Type:', typeof yfDefault);
    console.log('   Keys:', Object.keys(yfDefault || {}));

    try {
        // @ts-ignore
        if (yfDefault && typeof yfDefault.quote === 'function') {
            console.log('\n3. Testing yfDefault.quote("AAPL")...');
            const res = await yfDefault.quote("AAPL");
            console.log('   ✅ Success:', res.regularMarketPrice);
        } else if (yfDefault && yfDefault.default && typeof yfDefault.default.quote === 'function') {
            console.log('\n3. Testing yfDefault.default.quote("AAPL")...');
            const res = await yfDefault.default.quote("AAPL");
            console.log('   ✅ Success:', res.regularMarketPrice);
        } else {
            console.log('\n3. Could not find quote function on default import.');
        }

    } catch (e: any) {
        console.log('   ❌ Execution Error:', e.message);
    }
};

run();

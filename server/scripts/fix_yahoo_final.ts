
const fs = require('fs');

const log = (msg: string) => {
    console.log(msg);
    try {
        fs.appendFileSync('server/yahoo_debug_v2.log', msg + '\n');
    } catch (e) { }
};

const run = async () => {
    log('--- BRUTE FORCE YAHOO V2 (CLEAN) ---');
    let pkg = require('yahoo-finance2');

    let depth = 0;
    while (pkg && depth < 5) {

        if (typeof pkg.quote === 'function') {
            log(`[D${depth}] Found .quote(). Calling...`);
            try {
                const res = await pkg.quote('AAPL');
                log(`[D${depth}] ✅ SUCCESS! Price=${res.regularMarketPrice}`);
                process.exit(0);
            } catch (e: any) {
                log(`[D${depth}] ❌ FAILED: ${e.message}`);
            }
        } else {
            log(`[D${depth}] No .quote() function.`);
        }

        if (pkg.default) {
            log(`[D${depth}] Descending to .default`);
            pkg = pkg.default;
            depth++;
        } else {
            log(`[D${depth}] No .default. Stopping.`);
            break;
        }
    }
};

run();

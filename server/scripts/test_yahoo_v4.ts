
const run = async () => {
    console.log('--- TESTING YAHOO FINANCE V4 (INSPECT) ---');
    try {
        const pkg = require('yahoo-finance2');
        console.log('Type of pkg:', typeof pkg);
        console.log('Keys of pkg:', Object.keys(pkg));

        if (pkg.default) {
            console.log('Type of pkg.default:', typeof pkg.default);
            console.log('Keys of pkg.default:', Object.keys(pkg.default));
        }

        // Try to find the one that has 'quote'
        if (pkg.quote) console.log('pkg has quote()');
        if (pkg.default && pkg.default.quote) console.log('pkg.default has quote()');

    } catch (e: any) {
        console.error('❌ Error:', e.message);
    }
};

run();

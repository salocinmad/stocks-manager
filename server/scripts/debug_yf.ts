
import * as yf from 'yahoo-finance2';
import defaultYf from 'yahoo-finance2';

console.log('--- Debug Yahoo Finance Exports ---');
console.log('Keys:', Object.keys(yf));
console.log('Default export type:', typeof defaultYf);
console.log('Default export constructor name:', defaultYf?.constructor?.name);

if (defaultYf) {
    try {
        console.log('Trying to access default export property...');
        console.log('Result:', defaultYf.search);
    } catch (e) {
        console.log('Access error:', e.message);
    }
}

try {
    const instance = new defaultYf();
    console.log('Success: new defaultYf() worked');
} catch (e) {
    console.log('Error: new defaultYf() failed:', e.message);
}

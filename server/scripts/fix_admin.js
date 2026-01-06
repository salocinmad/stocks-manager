
const fs = require('fs');
const path = 'i:/dev/stocks-manager/src/screens/AdminScreen.tsx';

try {
    const content = fs.readFileSync(path, 'utf8');
    const lines = content.split(/\r?\n/);

    // We want to keep lines 1-1000 (indices 0-999)
    // And keep lines 1134-end (indices 1133-end)
    // Dropping indices 1000-1132 (Lines 1001-1133)

    console.log(`Total lines before: ${lines.length}`);
    console.log(`Line 1000 (should be space-y-8): ${lines[999]}`);
    console.log(`Line 1001 (should be corruption start): ${lines[1000]}`);
    console.log(`Line 1133 (should be corruption end): ${lines[1132]}`);
    console.log(`Line 1134 (should be empty): ${lines[1133]}`);

    const newLines = [...lines.slice(0, 1000), ...lines.slice(1133)];

    console.log(`Total lines after: ${newLines.length}`);

    fs.writeFileSync(path, newLines.join('\r\n'));
    console.log('File updated successfully.');
} catch (e) {
    console.error('Error:', e);
}


const testOpenFigi = async () => {
    const isin = 'US70438V1061'; // Paylocity
    console.log(`Testing OpenFIGI for ISIN: ${isin}`);

    try {
        const response = await fetch('https://api.openfigi.com/v3/mapping', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }])
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data[0] && data[0].data && data[0].data.length > 0) {
            console.log('Ticker found:', data[0].data[0].ticker);
        }

    } catch (error) {
        console.error('OpenFIGI Test Failed:', error);
    }
};

testOpenFigi();

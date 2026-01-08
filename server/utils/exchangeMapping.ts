/**
 * Exchange Mapping Utility
 * 
 * Maps EODHD exchange codes to Yahoo Finance ticker suffixes.
 * EODHD and Yahoo use different conventions for the same exchanges.
 * 
 * Based on EODHD official exchange list:
 * https://eodhd.com/api/exchanges-list/
 */

// EODHD Code -> Yahoo Suffix
// Empty string means no suffix needed (US stocks)
export const EODHD_TO_YAHOO: Record<string, string> = {
    // USA (multiple codes, all without Yahoo suffix)
    'US': '',         // US stocks unified code - no suffix in Yahoo
    'NYSE': '',       // New York Stock Exchange - no suffix
    'NASDAQ': '',     // NASDAQ - no suffix
    'AMEX': '',       // NYSE American (AMEX) - no suffix

    // Europe
    'LSE': 'L',       // London Stock Exchange -> .L
    'XETRA': 'DE',    // Frankfurt Xetra -> .DE
    'F': 'F',         // Frankfurt -> .F
    'BE': 'BE',       // Berlin -> .BE
    'HM': 'HM',       // Hamburg -> .HM
    'DU': 'DU',       // Dusseldorf -> .DU
    'MU': 'MU',       // Munich -> .MU
    'HA': 'HA',       // Hanover -> .HA
    'STU': 'SG',      // Stuttgart -> .SG
    'PA': 'PA',       // Euronext Paris -> .PA
    'BR': 'BR',       // Euronext Brussels -> .BR
    'MC': 'MC',       // Madrid Exchange -> .MC
    'AS': 'AS',       // Euronext Amsterdam -> .AS
    'LS': 'LS',       // Euronext Lisbon -> .LS
    'MI': 'MI',       // Milan/Borsa Italiana -> .MI
    'SW': 'SW',       // SIX Swiss Exchange -> .SW
    'VI': 'VI',       // Vienna Exchange -> .VI
    'ST': 'ST',       // Stockholm Exchange -> .ST
    'OL': 'OL',       // Oslo Stock Exchange -> .OL
    'CO': 'CO',       // Copenhagen Exchange -> .CO
    'HE': 'HE',       // Helsinki -> .HE
    'IC': 'IC',       // Iceland Exchange -> .IC
    'IR': 'IR',       // Irish Exchange -> .IR
    'LU': 'LU',       // Luxembourg -> .LU
    'AT': 'AT',       // Athens -> .AT
    'WAR': 'WA',      // Warsaw -> .WA
    'BUD': 'BD',      // Budapest -> .BD
    'PSE': 'PR',      // Prague -> .PR

    // Asia Pacific
    'HK': 'HK',       // Hong Kong -> .HK (EODHD uses HK too!)
    'TSE': 'T',       // Tokyo Stock Exchange -> .T
    'TW': 'TW',       // Taiwan -> .TW
    'KO': 'KS',       // Korea -> .KS
    'KQ': 'KQ',       // Korea KOSDAQ -> .KQ
    'SG': 'SI',       // Singapore -> .SI
    'AU': 'AX',       // Australia -> .AX
    'NZ': 'NZ',       // New Zealand -> .NZ
    'NSE': 'NS',      // India NSE -> .NS (EODHD uses NSE!)
    'BSE': 'BO',      // India BSE -> .BO
    'SHG': 'SS',      // Shanghai -> .SS
    'SHE': 'SZ',      // Shenzhen -> .SZ
    'JK': 'JK',       // Jakarta -> .JK
    'BK': 'BK',       // Bangkok -> .BK
    'KL': 'KL',       // Kuala Lumpur -> .KL
    'VN': 'VN',       // Vietnam -> .VN
    'PH': 'PS',       // Philippines -> .PS

    // Americas (non-US)
    'TO': 'TO',       // Toronto -> .TO
    'V': 'V',         // TSX Venture -> .V
    'NEO': 'NE',      // NEO Exchange -> .NE
    'SA': 'SA',       // Sao Paulo -> .SA
    'MX': 'MX',       // Mexico -> .MX
    'BA': 'BA',       // Buenos Aires -> .BA
    'SN': 'SN',       // Santiago Chile -> .SN

    // Middle East & Africa
    'TA': 'TA',       // Tel Aviv -> .TA
    'QA': 'QA',       // Qatar -> .QA
    'SR': 'SR',       // Saudi -> .SR
    'JO': 'JO',       // Johannesburg -> .JO
    'TADAWUL': 'SR',  // Saudi Tadawul alias
};

// Yahoo Suffix -> EODHD Code (reverse mapping)
export const YAHOO_TO_EODHD: Record<string, string> = Object.entries(EODHD_TO_YAHOO)
    .reduce((acc, [eodhd, yahoo]) => {
        if (yahoo) acc[yahoo] = eodhd;
        return acc;
    }, {} as Record<string, string>);

// EODHD Code -> Country/Region Code (for Discovery Job)
export const EODHD_TO_REGION: Record<string, string> = {
    // Europe
    'LSE': 'GB',
    'XETRA': 'DE',
    'F': 'DE',
    'BE': 'DE',
    'PA': 'FR',
    'BR': 'BE',
    'MC': 'ES',
    'AS': 'NL',
    'LS': 'PT',
    'MI': 'IT',
    'SW': 'CH',
    'VI': 'AT',
    'ST': 'SE',
    'OL': 'NO',
    'CO': 'DK',
    'HE': 'FI',
    'IR': 'IE',
    // Asia
    'HK': 'HK',
    'TSE': 'JP',
    'AU': 'AU',
    'NSE': 'IN',
    'SG': 'SG',
    'KO': 'KR',
    'TW': 'TW',
    'SHG': 'CN',
    // Americas
    'US': 'US',
    'NYSE': 'US',
    'NASDAQ': 'US',
    'AMEX': 'US',
    'TO': 'CA',
};

/**
 * Convert a ticker from EODHD format to Yahoo format
 * @example convertToYahooTicker('LLOY', 'LSE') -> 'LLOY.L'
 */
export function convertToYahooTicker(symbol: string, eodhdExchange: string): string {
    const yahooSuffix = EODHD_TO_YAHOO[eodhdExchange];
    if (!yahooSuffix) return symbol; // US stocks or unknown
    return `${symbol}.${yahooSuffix}`;
}

/**
 * Get the Yahoo suffix for an EODHD exchange code
 * Returns empty string for US (no suffix) or the exchange code if unknown
 * @example getYahooSuffix('LSE') -> 'L'
 * @example getYahooSuffix('US') -> '' (empty = no suffix)
 */
export function getYahooSuffix(eodhdExchange: string): string {
    const mapped = EODHD_TO_YAHOO[eodhdExchange];
    // Return mapped value if exists (including empty string for US)
    // Return exchange code only if not in mapping at all
    return mapped !== undefined ? mapped : eodhdExchange;
}

/**
 * Get region code for Discovery Job from EODHD exchange
 */
export function getRegionFromExchange(eodhdExchange: string): string | undefined {
    return EODHD_TO_REGION[eodhdExchange];
}

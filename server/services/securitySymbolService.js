import AssetProfile from '../models/AssetProfile.js';
import yahooFinance from 'yahoo-finance2';
import { Op } from 'sequelize';

/**
 * Service to resolve Ticker symbols from ISIN or Name.
 */

// Simple in-memory cache to avoid repeated lookups during the same import session
const symbolCache = new Map();

export const resolveSymbol = async (isin, name) => {
    // 1. Check cache
    const cacheKey = `${isin}|${name}`;
    if (symbolCache.has(cacheKey)) {
        return symbolCache.get(cacheKey);
    }

    let result = { symbol: null, currency: null, name: null, source: null };
    let detectedSymbol = null;

    // 2. Try to find by ISIN in AssetProfile
    if (isin) {
        const profile = await AssetProfile.findOne({ where: { isin } });
        if (profile) {
            detectedSymbol = profile.symbol;
            result.source = 'db';
        }
    }

    // 2.5 Try search using OpenFIGI (Reliable for US ISINs)
    if (!detectedSymbol && isin) {
        try {
            console.log(`🔎 [DEBUG] Buscando en OpenFIGI por ISIN: ${isin}`);
            const response = await fetch('https://api.openfigi.com/v3/mapping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }])
            });

            if (response.ok) {
                const data = await response.json();
                if (data[0] && data[0].data && data[0].data.length > 0) {
                    const matches = data[0].data;
                    let bestMatch;
                    // Prioritize US Exchange for US ISINs
                    if (isin.startsWith('US')) {
                        bestMatch = matches.find(m => m.exchCode === 'US' && m.marketSector === 'Equity');
                    }
                    if (!bestMatch) {
                        bestMatch = matches.find(m => m.marketSector === 'Equity' && (m.securityType === 'Common Stock' || m.securityType === 'ADR'));
                    }

                    if (bestMatch && bestMatch.ticker) {
                        detectedSymbol = bestMatch.ticker;
                        result.source = 'openfigi';
                        console.log(`   ✅ [SUCCESS] OpenFIGI encontró: ${detectedSymbol}`);
                    }
                }
            }
        } catch (e) {
            console.warn(`OpenFIGI search failed:`, e.message);
        }
    }

    // 3. Yahoo Finance ISIN fallback
    if (!detectedSymbol && isin) {
        try {
            const searchResult = await yahooFinance.search(isin);
            if (searchResult.quotes && searchResult.quotes.length > 0) {
                detectedSymbol = searchResult.quotes[0].symbol;
                result.source = 'yahoo_isin';
            }
        } catch (e) { /* ignore */ }
    }

    // 4. Name fallback
    if (!detectedSymbol && name) {
        try {
            let cleanName = name.replace(/\b(INC|CORP|LTD|PLC|AG|SA|NV|SE|HOLDING|HOLDINGS|GROUP|COMPANY|LIMITED|S\.A\.|N\.V\.)\b/gi, ' ');
            cleanName = cleanName.replace(/\b(CL|CLASS|SERIES)\s?[-.]?[A-Z]\b/gi, ' ');
            cleanName = cleanName.replace(/\b(ADR|SP|REIT)\b/gi, ' ');
            cleanName = cleanName.replace(/\s+/g, ' ').trim();

            const searchResult = await yahooFinance.search(cleanName);
            if (searchResult.quotes && searchResult.quotes.length > 0) {
                const bestMatch = searchResult.quotes.find(q => q.quoteType === 'EQUITY') || searchResult.quotes[0];
                detectedSymbol = bestMatch.symbol;
                result.source = 'yahoo_name';
            }
        } catch (e) { /* ignore */ }
    }

    // 5. If symbol found, fetch details (Currency & Clean Name) via Yahoo Quote
    if (detectedSymbol) {
        try {
            const quote = await yahooFinance.quote(detectedSymbol);
            if (quote) {
                result.symbol = detectedSymbol;
                result.currency = quote.currency;
                result.name = quote.shortName || quote.longName;
            } else {
                // If quote fails but symbol found (rare), return symbol at least
                result.symbol = detectedSymbol;
            }
        } catch (e) {
            console.warn(`Could not validate symbol ${detectedSymbol}:`, e.message);
            result.symbol = detectedSymbol; // Trust the search result anyway
        }
    }

    // Cache the FULL result
    symbolCache.set(cacheKey, result);

    // Update DB if found and isin available
    if (result.symbol && isin) {
        try {
            const [profile, created] = await AssetProfile.findOrCreate({
                where: { symbol: result.symbol },
                defaults: { isin }
            });
            if (!created && !profile.isin) {
                profile.isin = isin;
                await profile.save();
            }
        } catch (err) { }
    }

    return result;
};

export default { resolveSymbol };

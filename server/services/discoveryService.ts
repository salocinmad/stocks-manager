
import sql from '../db';

export interface DiscoveryItem {
    t: string;       // Ticker
    n: string;       // Name
    s: string;       // Sector
    p: number;       // Price
    chg_1d: number;  // Change 1 Day
    chg_1w?: number; // Change 1 Week
    vol_rel?: number;// Relative Volume
    source?: string; // Source of data (e.g. 'Finnhub', 'Yahoo')
    tech?: {
        rsi: number;
        trend: string;
        sma50_diff: number;
    };
    fund?: {
        mcap: string;
        recs: string;
        target: number;
    };
    meta?: {
        earn?: string;
        tag?: string;
        updated_at?: string;
    };
    extended?: any; // New field for deep persistence
    // Normalized Fields (v2.3.0)
    targetPrice?: number;
    recommendationKey?: string;
    fairValue?: number; // Graham Number
}

export class DiscoveryService {

    /**
     * Save discovery data for a specific category (e.g., 'trending_us', 'sector_tech')
     */
    static async saveDiscoveryData(category: string, data: DiscoveryItem[]) {
        try {
            await sql`
                INSERT INTO market_discovery_cache (category, data, updated_at)
                VALUES (${category}, ${sql.json(data as any)}, NOW())
                ON CONFLICT (category) 
                DO UPDATE SET data = ${sql.json(data as any)}, updated_at = NOW()
            `;
            // console.log(`[Discovery] Saved ${data.length} items to category: ${category}`);
            return true;
        } catch (error) {
            console.error(`[Discovery] Error saving data for ${category}:`, error);
            return false;
        }
    }

    /**
     * Append discovery data to an existing category, merging by ticker
     */
    static async appendDiscoveryData(category: string, newData: DiscoveryItem[]) {
        try {
            // 1. Get existing data
            const existing = await this.getDiscoveryData(category);

            // 2. Merge by ticker (t)
            const dataMap = new Map<string, DiscoveryItem>();
            existing.forEach(item => dataMap.set(item.t, item));
            newData.forEach(item => dataMap.set(item.t, item));

            const mergedData = Array.from(dataMap.values());

            // 3. Save merged result
            await sql`
                INSERT INTO market_discovery_cache (category, data, updated_at)
                VALUES (${category}, ${sql.json(mergedData as any)}, NOW())
                ON CONFLICT (category) 
                DO UPDATE SET data = ${sql.json(mergedData as any)}, updated_at = NOW()
            `;

            // console.log(`[Discovery] Appended ${newData.length} items to ${category}. Total items: ${mergedData.length}`);
            return true;
        } catch (error) {
            console.error(`[Discovery] Error appending data for ${category}:`, error);
            return false;
        }
    }

    /**
     * Get discovery data for a specific category
     */
    static async getDiscoveryData(category: string): Promise<DiscoveryItem[]> {
        try {
            const result = await sql`
                SELECT data FROM market_discovery_cache WHERE category = ${category}
            `;
            if (result.length > 0) {
                return result[0].data as DiscoveryItem[];
            }
            return [];
        } catch (error) {
            console.error(`[Discovery] Error fetching data for ${category}:`, error);
            return [];
        }
    }

    /**
     * Get all discovery data for AI context
     */
    static async getAllDiscoveryData(): Promise<Record<string, DiscoveryItem[]>> {
        try {
            const result = await sql`SELECT category, data FROM market_discovery_cache`;
            const map: Record<string, DiscoveryItem[]> = {};
            for (const row of result) {
                map[row.category] = row.data as DiscoveryItem[];
            }
            return map;
        } catch (error) {
            console.error('[Discovery] Error fetching all data:', error);
            return {};
        }
    }

    /**
     * Get statistics for the Admin Dashboard
     */
    static async getStats() {
        try {
            // Count total items across all categories (sum of array lengths)
            // Note: This relies on Postgres JSONB functions to sum array lengths
            const result = await sql`
                SELECT 
                    COUNT(*) as total_sectors,
                    COALESCE(SUM(jsonb_array_length(data)), 0) as total_companies,
                    MAX(updated_at) as last_update
                FROM market_discovery_cache
            `;

            return {
                sectors: parseInt(result[0].total_sectors || '0'),
                companies: parseInt(result[0].total_companies || '0'),
                lastUpdate: result[0].last_update
            };
        } catch (error) {
            console.error('[Discovery] Error fetching stats:', error);
            return { sectors: 0, companies: 0, lastUpdate: null };
        }
    }

    /**
     * Get all categories (keys)
     */
    static async getCategories(): Promise<string[]> {
        try {
            const result = await sql`SELECT category FROM market_discovery_cache`;
            const cats = result.map(r => r.category);
            console.log(`[Discovery] getCategories found ${cats.length} categories`);
            return cats;
        } catch (error) {
            console.error('[Discovery] Error in getCategories:', error);
            return [];
        }
    }

    /**
     * Paginated search for Master Catalog (global_tickers)
     */
    static async getPaginatedCatalog(search: string = '', limit: number = 20, offset: number = 0) {
        try {
            const searchQuery = `%${search}%`;
            console.log(`[Discovery] getPaginatedCatalog: search="${search}", limit=${limit}, offset=${offset}`);

            const totalResult = await sql`
                SELECT COUNT(*) FROM global_tickers 
                WHERE symbol ILIKE ${searchQuery} OR name ILIKE ${searchQuery}
            `;
            const total = parseInt(totalResult[0].count);

            const items = await sql`
                SELECT symbol as t, name as n, exchange as e, isin, type, last_processed_at
                FROM global_tickers
                WHERE symbol ILIKE ${searchQuery} OR name ILIKE ${searchQuery}
                ORDER BY symbol
                LIMIT ${limit} OFFSET ${offset}
            `;

            console.log(`[Discovery] getPaginatedCatalog found ${items.length} items of ${total} total`);
            return { items, total };
        } catch (error) {
            console.error('[Discovery] Error in getPaginatedCatalog:', error);
            return { items: [], total: 0 };
        }
    }

    /**
     * Paginated search for Discovery Engine (market_discovery_cache)
     */
    static async getPaginatedDiscovery(category: string, search: string = '', limit: number = 20, offset: number = 0, filter: string = 'all', sortBy: string = 't', order: string = 'asc', market: string = 'all') {
        try {
            const searchQuery = `%${search}%`;

            // If category is 'all', we select from all rows
            const categoryFilter = category === 'all'
                ? sql``
                : sql`WHERE category = ${category}`;

            // Filter logic for "Posibles Chicharros" (High Potential & Good Ratings)
            // SQL simplified to use Normalized Fields from v2.3.0
            // Fallback to old paths with COALESCE only if normalized field is missing (backward compatibility)

            const targetSql = sql`COALESCE((item->>'targetPrice')::numeric, (item->'fund'->>'target')::numeric, 0)`;
            const priceSql = sql`COALESCE((item->>'p')::numeric, (item->'price'->>'regularMarketPrice')::numeric, 1)`;
            const recsSql = sql`COALESCE((item->>'recommendationKey'), (item->'fund'->>'recs'), '')`;

            const chicharroFilter = filter === 'chicharros'
                ? sql`
                    AND (
                        -- 1. High Potential (Upside > 10% + Analyst Support)
                        (
                            (${targetSql} - ${priceSql}) / ${priceSql} >= 0.10
                            AND ${targetSql} > 0
                            AND (${recsSql} ILIKE '%Buy%' OR ${recsSql} ILIKE '%strong%')
                        )
                        OR
                        -- 2. Classic Chicharros / Penny Stocks (Low Price)
                        (
                            ${priceSql} < 5.0
                            AND ${priceSql} > 0
                        )
                    )
                `
                : sql``;

            // Market Filter Logic
            let marketFilterSql = sql``;
            if (market === 'es') {
                marketFilterSql = sql`AND item->>'t' LIKE '%.MC'`;
            } else if (market === 'us') {
                // Heuristic: US tickers usually don't have dots (except BRK.B) or are numeric (check length?)
                // Better heuristic: Exclude common suffixes? 
                // Simple approach: Tickers without dots (mostly US) OR explicit US suffixes if any.
                // For now, assuming "No Dot" = US is a safe-ish bet for major interactions which are US.
                // However, BRK.B exists.
                // Let's use negative logic against known non-US suffixes if we had them.
                // Or simplified: just don't filter for US specifically if hard, or use regex.
                // Let's rely on suffix .MC for Spain, and 'all' for everything.
                // User asked for "Spanish" specifically.
                marketFilterSql = sql`AND item->>'t' NOT LIKE '%.%'`; // Basic US assumption
            } else if (market === 'eu') {
                // Common EU suffixes: .PA, .DE, .L, .AS, .MC (if grouping EU)
                marketFilterSql = sql`AND (item->>'t' LIKE '%.PA' OR item->>'t' LIKE '%.DE' OR item->>'t' LIKE '%.L' OR item->>'t' LIKE '%.AS')`;
            }

            // Sorting Logic
            // Map frontend sort keys to JSON keys
            // Default sort by Ticker ('t')
            // Sorting Logic
            // Default sort by Ticker ('t')
            let sortSql = sql`ORDER BY item->>'t' ASC`;

            if (sortBy === 'p') {
                // Numeric sort for Price
                sortSql = order === 'desc'
                    ? sql`ORDER BY (item->>'p')::numeric DESC NULLS LAST`
                    : sql`ORDER BY (item->>'p')::numeric ASC NULLS LAST`;
            } else if (sortBy === 'chg_1d') {
                // Numeric sort for Change
                sortSql = order === 'desc'
                    ? sql`ORDER BY (item->>'chg_1d')::numeric DESC NULLS LAST`
                    : sql`ORDER BY (item->>'chg_1d')::numeric ASC NULLS LAST`;
            } else if (sortBy === 'tp') {
                // Numeric sort for Target Price
                sortSql = order === 'desc'
                    ? sql`ORDER BY ${targetSql} DESC NULLS LAST`
                    : sql`ORDER BY ${targetSql} ASC NULLS LAST`;
            } else if (sortBy === 's') {
                // Text sort for Sector
                sortSql = order === 'desc'
                    ? sql`ORDER BY item->>'s' DESC NULLS LAST`
                    : sql`ORDER BY item->>'s' ASC NULLS LAST`;
            } else if (sortBy === 'mkt_cap') { // Added extra just in case
                // We stored 'mkt_cap' or 'fund.mcap' possibly as string "1.2B". Needs extraction logic or simplified sort.
                // For now, let's stick to requested columns.
            } else if (sortBy === 't') {
                // Default Sort: If Chicharros mode, sort by Upside Potential DESC
                if (filter === 'chicharros') {
                    sortSql = sql`ORDER BY ((${targetSql} - ${priceSql}) / ${priceSql}) DESC NULLS LAST`;
                } else {
                    sortSql = order === 'desc'
                        ? sql`ORDER BY item->>'t' DESC`
                        : sql`ORDER BY item->>'t' ASC`;
                }
            }

            const result = await sql`
                WITH expanded AS (
                    SELECT jsonb_array_elements(data) as item
                    FROM market_discovery_cache
                    ${categoryFilter}
                ),
                filtered AS (
                    SELECT item FROM expanded
                    WHERE (item->>'t' ILIKE ${searchQuery} OR item->>'n' ILIKE ${searchQuery})
                    ${chicharroFilter}
                    ${marketFilterSql}
                )
                SELECT item, (SELECT COUNT(*) FROM filtered) as total_count
                FROM filtered
                ${sortSql}
                LIMIT ${limit} OFFSET ${offset}
            `;

            const items = result.map(r => r.item);
            const total = result.length > 0 ? parseInt(result[0].total_count) : 0;

            return { items, total };
        } catch (error) {
            console.error('[Discovery] Error in getPaginatedDiscovery:', error);
            return { items: [], total: 0 };
        }
    }

    /**
     * Get detailed ticker data from cache (72h validity check should be done by caller or here)
     */
    static async getTickerDetails(ticker: string) {
        try {
            const result = await sql`
                SELECT data, updated_at 
                FROM ticker_details_cache 
                WHERE ticker = ${ticker}
            `;
            if (result.length > 0) {
                return {
                    data: result[0].data,
                    updated_at: result[0].updated_at
                };
            }
            return null;
        } catch (error) {
            console.error(`[Discovery] Error fetching details for ${ticker}:`, error);
            return null;
        }
    }

    /**
     * Save detailed ticker data to cache
     */
    static async saveTickerDetails(ticker: string, data: any) {
        try {
            await sql`
                INSERT INTO ticker_details_cache (ticker, data, updated_at)
                VALUES (${ticker}, ${data}, NOW())
                ON CONFLICT (ticker) 
                DO UPDATE SET data = ${data}, updated_at = NOW()
            `;
            return true;
        } catch (error) {
            console.error(`[Discovery] Error saving details for ${ticker}:`, error);
            return false;
        }
    }

    /**
     * Bulk save detailed ticker data (Optimization for Crawler)
     */
    static async saveTickerDetailsBatch(items: { ticker: string, data: any }[]) {
        if (items.length === 0) return true;

        try {
            // Postgres.js supports bulk insert naturally with arrays of objects if keys match
            // But here we have jsonb 'data' and 'ticker'.
            // Constructing the values array manually for clarity and safety with JSONB.

            // We use a transaction for cleanliness, though efficient singular insert is fine.
            await sql.begin(async sql => {
                for (const item of items) {
                    await sql`
                        INSERT INTO ticker_details_cache (ticker, data, updated_at)
                        VALUES (${item.ticker}, ${item.data}, NOW())
                        ON CONFLICT (ticker) 
                        DO UPDATE SET data = ${item.data}, updated_at = NOW()
                    `;
                }
            });

            // NOTE: A true SINGLE SQL statement for upserting multiple rows with JSONB 
            // is complex in current postgres.js helper syntax without raw string manipulation. 
            // The Transaction wrapper here at least ensures connection reuse efficiency 
            // and atomicity, reducing overhead vs separate function calls.

            return true;
        } catch (error) {
            console.error(`[Discovery] Error in batch save details (${items.length} items):`, error);
            return false;
        }
    }
}

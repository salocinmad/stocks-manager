
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
    }
}

export class DiscoveryService {

    /**
     * Save discovery data for a specific category (e.g., 'trending_us', 'sector_tech')
     */
    static async saveDiscoveryData(category: string, data: DiscoveryItem[]) {
        try {
            await sql`
                INSERT INTO market_discovery_cache (category, data, updated_at)
                VALUES (${category}, ${sql.json(data)}, NOW())
                ON CONFLICT (category) 
                DO UPDATE SET data = ${sql.json(data)}, updated_at = NOW()
            `;
            console.log(`[Discovery] Saved ${data.length} items to category: ${category}`);
            return true;
        } catch (error) {
            console.error(`[Discovery] Error saving data for ${category}:`, error);
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
            return result.map(r => r.category);
        } catch (error) {
            return [];
        }
    }
}

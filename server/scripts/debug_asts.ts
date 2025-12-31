
import { MarketDataService } from '../services/marketData';

async function debugASTS() {
    console.log('--- Debugging ASTS News (Service Check) ---');

    // We expect the Service to handle date conversion correctly now
    // Queries to test
    const queries = ['ASTS', 'AST SpaceMobile'];

    for (const q of queries) {
        console.log(`\n>>> Testing Service.getCompanyNews("${q}")`);
        const news = await MarketDataService.getCompanyNews(q);
        console.log(`Found ${news.length} items.`);
        if (news.length > 0) {
            news.slice(0, 5).forEach((n: any) => {
                // n.time is ms, n.timeStr is formatted string
                console.log(`   - [${n.timeStr}] ${n.title} (Raw: ${n.time})`);
            });
        }
    }
}

debugASTS().catch(console.error);

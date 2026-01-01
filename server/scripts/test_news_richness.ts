
import { NewsService } from '../services/newsService';

async function testRichness() {
    console.log('--- CHECKING RSS RICHNESS (ASTS) ---');
    // Call the raw fetch method or inspect getNews output if we can't easily access raw XML here.
    // Since fetchGoogleNewsRSS is private/protected depending on implementation, 
    // I'll use getNews but request a console log in the service or just inspect what we get.
    // Actually, I'll essentially replicate the fetch logic here to see the RAW XML.

    const query = 'ASTS';
    // Replicating the logic from newsService
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-ES&gl=ES&ceid=ES:es`;

    const resp = await fetch(rssUrl);
    const xml = await resp.text();

    console.log('--- RAW XML SNIPPET (First 500 chars) ---');
    console.log(xml.substring(0, 500));

    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const matches = xml.match(itemRegex);

    if (matches && matches.length > 0) {
        console.log(`\n--- FIRST ITEM ANALYSIS ---`);
        const item = matches[0];
        console.log(item);

        console.log('\n--- DOES IT HAVE DESCRIPTION? ---');
        const desc = item.match(/<description>([\s\S]*?)<\/description>/);
        if (desc) console.log('YES:', desc[1]);
        else console.log('NO');

        console.log('\n--- DOES IT HAVE FULL CONTENT? ---');
        if (item.includes('content:encoded')) console.log('YES');
        else console.log('NO');
    }
}

testRichness();

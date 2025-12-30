
import { fetch } from 'bun';

async function checkNews() {
    const feeds = [
        { url: 'https://es.investing.com/rss/news_25.rss', label: 'Bolsa' },
        { url: 'https://es.investing.com/rss/news.rss', label: 'Titulares' },
        { url: 'https://es.investing.com/rss/news_288.rss', label: 'Tecnología' }
    ];

    console.log("Descargando feeds...");

    const allItems: any[] = [];

    for (const feed of feeds) {
        try {
            const response = await fetch(feed.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const xmlText = await response.text();

            const itemRegex = /<item>([\s\S]*?)<\/item>/g;
            const matches = xmlText.match(itemRegex);

            if (matches) {
                console.log(`- ${feed.label}: ${matches.length} noticias encontradas.`);
                for (const itemXml of matches) {
                    const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
                    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
                    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

                    let title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '') : '';
                    const url = linkMatch ? linkMatch[1] : '';
                    const pubDateStr = pubDateMatch ? pubDateMatch[1] : '';

                    if (title && url) {
                        allItems.push({
                            headline: title,
                            url: url,
                            rawDate: pubDateStr,
                            source: feed.label
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`Error en ${feed.label}:`, e);
        }
    }

    // Deduplicate
    const seenUrls = new Set();
    const uniqueItems: any[] = [];
    for (const item of allItems) {
        if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            uniqueItems.push(item);
        }
    }

    console.log(`\nTotal noticias únicas: ${uniqueItems.length}`);

    // Sort
    uniqueItems.sort((a, b) => {
        if (!a.rawDate) return 1;
        if (!b.rawDate) return -1;
        return b.rawDate.localeCompare(a.rawDate);
    });

    console.log("\n--- TOP 15 NOTICIAS (ORDEN REAL) ---");
    uniqueItems.slice(0, 15).forEach((item, i) => {
        console.log(`${i + 1}. [${item.rawDate}] [${item.source}] ${item.headline.substring(0, 80)}...`);
    });
}

checkNews();

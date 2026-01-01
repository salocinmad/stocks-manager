
import { SettingsService } from '../services/settingsService';

async function listModels() {
    console.log('--- LISTING AVAILABLE MODELS ---');

    const apiKey = await SettingsService.get('GOOGLE_GENAI_API_KEY');
    if (!apiKey) {
        console.error('No API Key');
        process.exit(1);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log('Fetching from:', url.replace(apiKey, 'HIDDEN_KEY'));

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`HTTP Error: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            process.exit(1);
        }

        const data = await response.json();
        const models = (data.models || [])
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => ({
                id: m.name.replace('models/', ''),
                name: m.displayName,
                version: m.version,
                rawName: m.name
            }));

        console.table(models);
        console.log(`\nTotal Models Found: ${models.length}`);

        // Check specifically for gemini-1.5-flash
        const flash = models.find((m: any) => m.id === 'gemini-1.5-flash');
        if (flash) {
            console.log('✅ gemini-1.5-flash IS available.');
        } else {
            console.error('❌ gemini-1.5-flash IS NOT in the list.');
        }

    } catch (e: any) {
        console.error('Fetch Error:', e.message);
    }
}

listModels();

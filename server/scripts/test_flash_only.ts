
import { SettingsService } from '../services/settingsService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sql from '../db';

async function testFlash() {
    console.log('--- TESTING GEMINI 1.5 FLASH ONLY ---');

    const apiKey = await SettingsService.get('GOOGLE_GENAI_API_KEY');
    if (!apiKey) {
        console.error('No API Key');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('API Key loaded. Testing gemini-1.5-flash...');

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent("Say 'System Operational'");
        console.log('✅ RESPONSE:', result.response.text());
    } catch (e: any) {
        console.error('❌ FAILED:', e.message);
    }
}

testFlash();

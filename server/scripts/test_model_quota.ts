
import { SettingsService } from '../services/settingsService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sql from '../db';

async function testQuota() {
    console.log('--- DIAGNOSING AI MODEL QUOTA ---');

    // 1. Get Config
    const apiKey = await SettingsService.get('GOOGLE_GENAI_API_KEY');
    const dbModel = await SettingsService.get('AI_MODEL');

    console.log('API Key configured:', !!apiKey);
    console.log('Target Model (DB):', dbModel);

    if (!apiKey) {
        console.error('CRITICAL: No API Key found!');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // 2. Test User's Selected Model
    if (dbModel) {
        console.log(`\n[TEST 1] Testing selected model: ${dbModel}...`);
        try {
            const model = genAI.getGenerativeModel({ model: dbModel });
            const result = await model.generateContent("Hello, are you working?");
            console.log('✅ SUCCESS! Response:', result.response.text());
        } catch (e: any) {
            console.error('❌ FAILED:', e.message);
            if (e.message.includes('Quota') || e.message.includes('429')) {
                console.log('>>> CONFIRMED: Model Quota/Rate Limit Exceeded for', dbModel);
            }
        }
    }

    // 3. Test Fallback/Safe Model (Gemini 1.5 Flash)
    console.log(`\n[TEST 2] Testing SAFE model: gemini-1.5-flash...`);
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent("Hello, just checking connectivity.");
        console.log('✅ SUCCESS! Response:', result.response.text());
        console.log('>>> CONCLUSION: API Key is VALID. The issue is likely the specific model limits.');
    } catch (e: any) {
        console.error('❌ FAILED with gemini-1.5-flash:', e.message);
        console.log('>>> CONCLUSION: API Key might be invalid or global quota exceeded.');
    }

    process.exit(0);
}

testQuota();

import sql from '../db';

async function verify() {
    console.log('Verifying AI Prompts...');
    const prompts = await sql`SELECT name, prompt_type, is_active, is_system FROM ai_prompts ORDER BY prompt_type, name`;

    console.table(prompts);

    if (prompts.length === 0) {
        console.error('FAIL: No prompts found.');
        process.exit(1);
    }

    const activeAnalysis = prompts.find(p => p.prompt_type === 'ANALYSIS' && p.is_active);
    const activeChat = prompts.find(p => p.prompt_type === 'CHATBOT' && p.is_active);

    if (!activeAnalysis) console.error('FAIL: No active ANALYSIS prompt.');
    else console.log('PASS: Active Analysis:', activeAnalysis.name);

    if (!activeChat) console.error('FAIL: No active CHATBOT prompt.');
    else console.log('PASS: Active Chatbot:', activeChat.name);

    process.exit(0);
}

verify();

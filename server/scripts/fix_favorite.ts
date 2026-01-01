
import sql from '../db';

const run = async () => {
    console.log('--- FIXING FAVORITE PORTFOLIO ---');

    // Find portfolio with most positions
    const portfolios = await sql`
        SELECT p.id, p.name, count(pos.id) as pos_count 
        FROM portfolios p
        LEFT JOIN positions pos ON p.id = pos.portfolio_id
        GROUP BY p.id
        ORDER BY pos_count DESC
        LIMIT 1
    `;

    if (portfolios.length === 0) return;
    const target = portfolios[0];
    console.log(`Targeting: ${target.name} (Pos: ${target.pos_count})`);

    // Mark all as non-favorite
    await sql`UPDATE portfolios SET is_favorite = false WHERE user_id = (SELECT user_id FROM portfolios WHERE id = ${target.id})`;

    // Mark target as favorite
    await sql`UPDATE portfolios SET is_favorite = true WHERE id = ${target.id}`;
    console.log('Updated successfully.');
};

run();

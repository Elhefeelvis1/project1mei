// Searching for a drug
export async function searchDb(name, category, startPrice, stopPrice, db){
    const queryParts = [];
    const params = [];
    let paramCounter = 1; // Used for $1, $2, $3...

    if (name) {
        queryParts.push(`ast.name ILIKE $${paramCounter} `);
        params.push(`%${name}%`);
        paramCounter++;
    }

    if (category) {
        queryParts.push(`categories.name ILIKE $${paramCounter}`);
        params.push(`%${category}%`);
        paramCounter++;
    }

    const parsedStartPrice = parseFloat(startPrice);
    if (!isNaN(parsedStartPrice)) { // Check if it's a valid number
        queryParts.push(`ast.unit_selling_price >= $${paramCounter}`);
        params.push(parsedStartPrice);
        paramCounter++;
    } else if (startPrice !== null && startPrice !== undefined && startPrice !== '') {
        // Log a warning if it's provided but not a valid number (e.g., "abc")
        console.warn(`searchDb: Invalid startPrice input ignored: ${startPrice}`);
    }

    const parsedStopPrice = parseFloat(stopPrice);
    if (!isNaN(parsedStopPrice)) { // Check if it's a valid number
        queryParts.push(`ast.unit_selling_price <= $${paramCounter}`);
        params.push(parsedStopPrice);
        paramCounter++;
    } else if (stopPrice !== null && stopPrice !== undefined && stopPrice !== '') {
        // Log a warning if it's provided but not a valid number
        console.warn(`searchDb: Invalid stopPrice input ignored: ${stopPrice}`);
    }

    let sqlQuery = 'SELECT ast.id AS item_id, ast.name AS item_name, ast.unit_selling_price, ast.total_quantity_in_stock, categories.name AS category_name, units.name AS unit_name FROM all_stocks ast JOIN units ON ast.unit_id = units.id JOIN categories ON ast.category_id = categories.id';

    if (queryParts.length > 0) {
        sqlQuery += ' WHERE ' + queryParts.join(' AND ');
    }

    // console.log('Generated SQL Query:', sqlQuery);
    // console.log('Parameters:', params);

    try {
        const result = await db.query(sqlQuery, params);
        return result.rows;
    } catch (err) {
        console.error('Database query error:', err);
        throw new Error(`Failed to perform database search: ${err.message}`);
    }
}

export async function saveSale(userId, saleList, db){
    try {
        await client.query('BEGIN'); // Start a transaction

        const userId = userId;
        const items = saleList

        if (!userId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Invalid sale data provided. User ID and items array are required.' });
        }
    }catch(err){
        console.error(err)
    }    
}
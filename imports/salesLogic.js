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

export async function saveSale(user_id, saleList, db, res){
    try {
        await db.query('BEGIN'); // Start a transaction

        const userId = user_id;
        const items = saleList;

        if (!userId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Invalid sale data provided. User ID and items array are required.' });
        }

        let totalSaleAmount = 0; // Initialize totalSaleAmount to calculate it during item processing

        // 1. Create the main sales record (the sale header) with a temporary total_amount of 0.00
        const saleResult = await db.query(
            `INSERT INTO sales (user_id, total_amount) VALUES ($1, $2) RETURNING id;`,
            [userId, 0.00] // Provide an initial value for total_amount
        );
        const saleId = saleResult.rows[0].id;

        // Loop through each item (product and its total quantity to sell) received from the db
        for (const item of items) {
            // Destructure the item object with your provided keys
            const { productId, quantity, sellPrice } = item;

            // Basic validation for the received item data
            if (quantity <= 0 || sellPrice < 0 || !productId) {
                throw new Error(`Invalid data for sale item. Product ID: ${productId}, Quantity: ${quantity}, Price: ${sellPrice}.`);
            }

            // --- Inventory Allocation Strategy (FEFO: First Expired, First Out) ---
            const availableLotsResult = await db.query(
                `SELECT lot_id, quantity_in_lot, cost_per_unit, expiry_date
                 FROM stock_lots
                 WHERE product_id = $1 AND quantity_in_lot > 0
                 ORDER BY expiry_date ASC, entry_date ASC;
                `,
                [productId]
            );

            let remainingToSell = quantity; // Use 'quantity' from your itemObject
            let soldFromLots = [];

            for (const lot of availableLotsResult.rows) {
                if (remainingToSell <= 0) break;

                const quantityToSellFromLot = Math.min(remainingToSell, lot.quantity_in_lot);

                if (quantityToSellFromLot > 0) {
                    await db.query(
                        `UPDATE stock_lots SET quantity_in_lot = quantity_in_lot - $1 WHERE lot_id = $2;`,
                        [quantityToSellFromLot, lot.lot_id]
                    );

                    soldFromLots.push({
                        lotId: lot.lot_id,
                        quantity: quantityToSellFromLot,
                        costPerUnit: lot.cost_per_unit,
                    });

                    remainingToSell -= quantityToSellFromLot;
                }
            }

            if (remainingToSell > 0) {
                // Use 'quantity' from your itemObject in the error message
                throw new Error(`Insufficient stock for Product ID: ${productId}. Requested: ${quantity}, Remaining unfulfilled: ${remainingToSell}.`);
            }

            // 2. Create `sale_line_items` records and accumulate `totalSaleAmount`
            for (const soldLot of soldFromLots) {
                const lineItemCost = soldLot.quantity * soldLot.costPerUnit;
                const lineItemSellingPrice = soldLot.quantity * sellPrice; // Use 'sellPrice' from your itemObject
                totalSaleAmount += lineItemSellingPrice; // Accumulate total sale amount

                await db.query(
                    `INSERT INTO sale_line_items (sale_id, product_id, lot_id, quantity_sold, selling_price_per_unit, cost_at_sale)
                     VALUES ($1, $2, $3, $4, $5, $6);`,
                    [saleId, productId, soldLot.lotId, soldLot.quantity, sellPrice, lineItemCost] // Use 'sellPrice'
                );

                // 3. Record `stock_changes`
                await db.query(
                    `INSERT INTO stock_changes (product_id, lot_id, change_type, quantity_change, cost_impact, user_id)
                     VALUES ($1, $2, $3, $4, $5, $6);`,
                    [productId, soldLot.lotId, 'Sales', -soldLot.quantity, -lineItemCost, userId]
                );
            }
        }

        // 4. Update the `total_amount` in the main `sales` header record with the final calculated value
        await db.query(
            `UPDATE sales SET total_amount = $1 WHERE id = $2;`,
            [totalSaleAmount, saleId]
        );

        await db.query('COMMIT');
        res.status(200).json({ message: 'Sale processed successfully!', saleId: saleId });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error processing sale:', error.message || error);
        res.status(500).json({ message: 'Failed to process sale', error: error.message || 'Unknown error' });
    }
}
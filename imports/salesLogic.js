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

// Function to record a sale
export async function saveSale(userId, saleData, db, res){
    try {
        await db.query('BEGIN');

        const items = saleData.items;
        const totalDiscountValue = parseFloat(saleData.totalDiscount) || 0; 
        
        // --- Initial Validation ---
        if (!userId || !Array.isArray(items) || items.length === 0) {
            await db.query('ROLLBACK'); 

            return res.status(400).json({ message: 'Invalid sale data provided. User ID and items array are required.' });
        }
        
        // Check for valid discount: it must not be negative.
        if (totalDiscountValue < 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid discount value provided (cannot be negative).' });
        }
        
        // --- Sale Header Creation ---
        let totalSaleAmount = 0;

        const saleResult = await db.query(
            `INSERT INTO sales (user_id, total_amount, discount_applied) VALUES ($1, $2, $3) RETURNING id;`,
            [userId, 0.00, 0.00] // Temporary 0.00 values
        );
        const saleId = saleResult.rows[0].id;

        // --- Line Item Processing and Stock Update (FEFO) ---
        for (const item of items) {
            const { productId, quantity, sellPrice } = item;

            if (quantity <= 0 || sellPrice < 0 || !productId) {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: `Invalid data for sale item. Product ID: ${productId}, Quantity: ${quantity}, Price: ${sellPrice}.` });
            }

            // FEFO logic to retrieve stock lots
            const availableLotsResult = await db.query(
                `SELECT lot_id, quantity_in_lot, cost_per_unit, expiry_date
                 FROM stock_lots
                 WHERE product_id = $1 AND quantity_in_lot > 0
                 ORDER BY expiry_date ASC, entry_date ASC;
                `,
                [productId]
            );
            // Calculate total available stock for the product
            let currentTotalStock = 0;
            availableLotsResult.rows.forEach(lot => {
                currentTotalStock += lot.quantity_in_lot;
            });

            let remainingToSell = quantity;
            let soldFromLots = [];

            // Array to collect lot IDs and quantities for the SINGLE batched UPDATE query
            const lotUpdates = []; 

            for (const lot of availableLotsResult.rows) {
                if (remainingToSell <= 0) break;

                const quantityToSellFromLot = Math.min(remainingToSell, lot.quantity_in_lot);

                if (quantityToSellFromLot > 0) {
                    // 1. COLLECT: Store the required update details for later execution
                    lotUpdates.push({
                        lotId: lot.lot_id,
                        quantity: quantityToSellFromLot,
                    });

                    // 2. TRACE: Populate soldFromLots for sale_line_items insertion
                    soldFromLots.push({
                        lotId: lot.lot_id,
                        quantity: quantityToSellFromLot,
                        costPerUnit: lot.cost_per_unit,
                    });

                    remainingToSell -= quantityToSellFromLot;
                }
            }

            if (remainingToSell > 0) {
                // Insufficient stock rollback logic remains the same
                await db.query('ROLLBACK');
                return res.status(400).json({ 
                    message: `Insufficient stock for Product ID: ${productId}. Requested: ${quantity}, Remaining unfulfilled: ${remainingToSell}.` 
                });
            }

            // Perform a single, batched update for ALL affected lots for this product.

            // 1. Build the dynamic CASE statement and WHERE clause list
            const lotIds = lotUpdates.map(u => u.lotId);
            let caseStatement = `CASE lot_id `;
            
            lotUpdates.forEach(update => {
                caseStatement += `WHEN ${update.lotId} THEN quantity_in_lot - ${update.quantity} `;
            });
            caseStatement += `ELSE quantity_in_lot END`;
            
            // 2. Execute the single batched query
            if (lotIds.length > 0) {
                await db.query(
                    `UPDATE stock_lots
                    SET quantity_in_lot = ${caseStatement}
                    WHERE lot_id = ANY($1::int[]);`, // $1 is the array of lot IDs
                    [lotIds] 
                );
            }
            
            // Insert into sale_line_items and stock_changes for each lot used
            for (const soldLot of soldFromLots) {
                const lineItemCost = soldLot.quantity * soldLot.costPerUnit;
                const lineItemSellingPrice = soldLot.quantity * sellPrice;
                // Accumulate the Gross Total before any discount
                totalSaleAmount += lineItemSellingPrice;

                await db.query(
                    `INSERT INTO sale_line_items (sale_id, product_id, lot_id, quantity_sold, selling_price_per_unit, cost_at_sale)
                     VALUES ($1, $2, $3, $4, $5, $6);`,
                    [saleId, productId, soldLot.lotId, soldLot.quantity, sellPrice, lineItemCost]
                );
            }
            const newQuantity = currentTotalStock - quantity;
            const lineItemCost = quantity * soldFromLots[0].costPerUnit; // Approximate cost impact using the first lot's cost
            await db.query(
                `INSERT INTO stock_changes (product_id, change_type, quantity_change, new_quantity_on_hand, cost_impact, user_id, sale_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7);`,
                [productId, 'Sales', -quantity, newQuantity, -lineItemCost, userId, saleId]
            );
        }
        // --- Discount Application ---
        let discountToApply = totalDiscountValue;

        // Ensure the applied discount doesn't exceed the gross total amount
        if (discountToApply > totalSaleAmount) {
             discountToApply = totalSaleAmount;
        }

        // Calculate the final net total
        const finalNetSaleAmount = totalSaleAmount - discountToApply;

        // 4. Update the `total_amount` (NET) and `discount_applied` in the main `sales` header record
        await db.query(
            `UPDATE sales SET total_amount = $1, discount_applied = $2 WHERE id = $3;`,
            [finalNetSaleAmount, discountToApply, saleId] 
        );

        await db.query('COMMIT');
        
        // Return only the necessary successful data.
        return { saleId: saleId }; 

    } catch (error) {
        // This catch block is now primarily for unexpected DB errors
        await db.query('ROLLBACK');
        console.error('Error processing sale (unexpected):', error.message || error);
        
        throw new Error(`Failed to process sale due to an internal error, error: ${error.message || 'Unknown error'}`);
    }
}
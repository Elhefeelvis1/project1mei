import logStockTransaction from './updateStockChanges.js';

async function saveReturn(client, userId, data) {
    const items = data.items;
    if (!Array.isArray(items) || items.length === 0) throw new Error('Items array is required.');

    for (const item of items) {
        const { productId, quantity, expiryDate } = item;
        
        // 1. Find Closest Lot
        const lotRes = await client.query(`
            SELECT lot_id, quantity, cost_per_unit,
                   ABS(expiry_date::date - $2::date) AS diff
            FROM stock_lots WHERE product_id = $1
            ORDER BY diff ASC, expiry_date ASC LIMIT 1`, 
            [productId, expiryDate]
        );

        if (lotRes.rows.length === 0 || lotRes.rows[0].diff > 30) {
            throw new Error(`Item ${productId} mismatch: No lot found within 30 days of provided expiry.`);
        }

        const lot = lotRes.rows[0];

        // 2. Update Lot Quantity
        const updateRes = await client.query(
            `UPDATE stock_lots SET quantity = quantity + $1 WHERE lot_id = $2 RETURNING quantity`,
            [quantity, lot.lot_id]
        );

        // 3. Log Transaction
        // We fetch current all_stocks total to get accurate snapshot
        const stockRes = await client.query('SELECT total_quantity_in_stock FROM all_stocks WHERE id = $1', [productId]);
        const newTotal = stockRes.rows[0].total_quantity_in_stock;

        await logStockTransaction(client, {
            productId,
            changeAmount: quantity,
            oldQty: newTotal - quantity,
            newQty: newTotal,
            changeType: 'Return',
            costImpact: quantity * lot.cost_per_unit, // Value added back to stock
            userId,
            lotId: lot.lot_id
        });
    }
}

async function removeStock(client, userId, data, type) {
    const items = data.items;
    
    for (const item of items) {
        const { productId, quantity } = item;
        let remainingToRemove = quantity;

        // Find lots using FEFO (First Expired First Out)
        const lotsRes = await client.query(
            `SELECT lot_id, quantity, cost_per_unit FROM stock_lots 
             WHERE product_id = $1 AND quantity > 0 ORDER BY expiry_date ASC`,
            [productId]
        );

        for (const lot of lotsRes.rows) {
            if (remainingToRemove <= 0) break;

            const take = Math.min(remainingToRemove, lot.quantity);
            
            // Update Lot
            const upd = await client.query(
                `UPDATE stock_lots SET quantity = quantity - $1, 
                 status = CASE WHEN (quantity - $1) = 0 THEN 'CLEARED' ELSE status END
                 WHERE lot_id = $2 RETURNING quantity`,
                [take, lot.lot_id]
            );

            // Fetch snapshot for audit log
            const stockRes = await client.query('SELECT total_quantity_in_stock FROM all_stocks WHERE id = $1', [productId]);
            const newTotal = stockRes.rows[0].total_quantity_in_stock;

            await logStockTransaction(client, {
                productId,
                changeAmount: -take,
                oldQty: newTotal + take,
                newQty: newTotal,
                changeType: type,
                costImpact: -(take * lot.cost_per_unit),
                userId,
                lotId: lot.lot_id
            });

            remainingToRemove -= take;
        }

        if (remainingToRemove > 0) {
            throw new Error(`Insufficient stock for product ${productId}. Shortfall: ${remainingToRemove}`);
        }
    }
}

export { saveReturn, removeStock };
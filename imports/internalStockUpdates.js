async function saveReturn(db, res, userId, requestData) {
    try {
        await db.query('BEGIN'); // Start transaction

        const items = requestData.items;

        // --- Initial Validation ---
        if (!userId || !Array.isArray(items) || items.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid request data. User ID and items array are required.' });
        }

        const MAX_EXPIRY_DIFFERENCE_DAYS = 30;

        // --- Core Logic: Process Each Returned Item ---
        for (const item of items) {
            const { product_id, returned_quantity, expiry_date } = item;
            
            // Basic item validation
            if (!product_id || !returned_quantity || !expiry_date) {
                throw new Error('Missing required fields for one or more return items.');
            }
            
            // 1. Find the Closest stock_lots Match (Nearest to Expiration)
            // This query runs first, assuming the product already exists due to a prior sale.
            const closestLotQuery = `
                SELECT 
                    lot_id, 
                    expiry_date,
                    -- Calculate the difference in days
                    ABS(expiry_date::date - $2::date) AS date_difference
                FROM stock_lots
                WHERE product_id = $1
                -- Order by absolute date difference, then by closest to expiration (ASC)
                ORDER BY 
                    ABS(EXTRACT(EPOCH FROM (expiry_date::date - $2::date))), 
                    expiry_date ASC
                LIMIT 1;
            `;

            const lotResult = await db.query(closestLotQuery, [product_id, expiry_date]);
            
            // 2. Check for existence AND enforce 30-day limit
            if (lotResult.rows.length === 0) {
                // If the product doesn't exist at all, roll back.
                await db.query('ROLLBACK');
                return res.status(400).json({ 
                    message: `Product ID ${product_id} is not currently in stock. Please add it via a purchase order.` 
                });
            }

            const { lot_id, date_difference } = lotResult.rows[0];

            if (date_difference > MAX_EXPIRY_DIFFERENCE_DAYS) {
                // If the closest existing lot's date is too far from the returned item's date
                await db.query('ROLLBACK');
                return res.status(400).json({
                    message: `Return for Product ID ${product_id} rejected: Expiry date difference exceeds the ${MAX_EXPIRY_DIFFERENCE_DAYS}-day limit. Must be added via purchase.`
                });
            }


            // 3. Update the stock_lots table (Add quantity)
            const updateStockQuery = `
                UPDATE stock_lots
                SET quantity = quantity + $1
                WHERE lot_id = $2
                RETURNING quantity;
            `;
            const updateResult = await db.query(updateStockQuery, [returned_quantity, lot_id]);
            
            if (updateResult.rowCount === 0) {
                 throw new Error(`Failed to update stock_lots for lot_id: ${lot_id}`);
            }

            const newQuantity = updateResult.rows[0].quantity;
            
            // NOTE: A database TRIGGER is assumed to handle the update of the 'all_stocks' table here.
            
            // 4. Save the Stock Change in the stock_changes table
            const insertChangeQuery = `
                INSERT INTO stock_changes (
                    lot_id, 
                    product_id, 
                    change_type, 
                    quantity_changed, 
                    user_id,
                    new_quantity_after_change
                )
                VALUES ($1, $2, 'RETURN', $3, $4, $5);
            `;
            
            await db.query(insertChangeQuery, [
                lot_id,
                product_id,
                returned_quantity,
                userId,
                newQuantity
            ]);

            console.log(`Processed return for Lot ${lot_id}: added ${returned_quantity}. New stock: ${newQuantity}`);
        }
        
        // --- Transaction Success ---
        await db.query('COMMIT'); 
        return res.status(200).json({ message: 'Return processed successfully, and stock updated.' });

    } catch (error) {
        // --- Transaction Failure (Catches general errors like missing fields) ---
        await db.query('ROLLBACK');
        console.error('Error processing purchase (unexpected):', error.message || error);
        
        return res.status(500).json({ message: `Internal server error during return process: ${error.message || 'Unknown error'}` });
    }
}

async function removeExpiredStock(db, res, userId, requestData) {
    try {
        await db.query('BEGIN');

        const items = requestData.items;

        if (!userId || !Array.isArray(items) || items.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid request data. User ID and items array (product_id, quantity, expiry_date) are required.' });
        }

        for (const item of items) {
            const { product_id, removed_quantity, expiry_date } = item;
            let quantity_to_remove = removed_quantity;

            if (!product_id || !removed_quantity || removed_quantity <= 0 || !expiry_date) {
                throw new Error('Missing or invalid product_id, removed_quantity, or expiry_date for one or more items.');
            }

            // 1. Find relevant expired stock lots, prioritized by proximity to the user's provided expiry_date (closest first).
            const expiredLotsQuery = `
                SELECT lot_id, quantity
                FROM stock_lots
                WHERE 
                    product_id = $1 
                    AND quantity > 0
                    AND expiry_date < CURRENT_DATE -- Crucial: Only target lots that are actually expired
                ORDER BY 
                    ABS(EXTRACT(EPOCH FROM (expiry_date::date - $2::date))), -- Closest date match
                    expiry_date ASC -- Secondary: If dates are equidistant, choose the one that expired sooner
                LIMIT 100; -- Limit batch size for safety, although the loop handles consumption
            `;

            const expiredLotsResult = await db.query(expiredLotsQuery, [product_id, expiry_date]);

            if (expiredLotsResult.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ 
                    message: `No expired stock found for Product ID ${product_id} matching the removal criteria.` 
                });
            }

            // 2. Iterate through matched expired lots and deduct the quantity (FEFO/Closest-Date approach)
            for (const lot of expiredLotsResult.rows) {
                if (quantity_to_remove <= 0) break;

                const { lot_id, quantity: lot_quantity } = lot;
                const quantity_taken_from_lot = Math.min(quantity_to_remove, lot_quantity);

                // 3. Update stock_lots
                const updateStockQuery = `
                    UPDATE stock_lots
                    SET quantity = quantity - $1,
                        status = CASE WHEN (quantity - $1) = 0 THEN 'CLEARED' ELSE status END
                    WHERE lot_id = $2
                    RETURNING quantity AS new_quantity;
                `;
                const updateResult = await db.query(updateStockQuery, [quantity_taken_from_lot, lot_id]);

                if (updateResult.rowCount === 0) throw new Error(`Failed to update stock_lots for lot_id: ${lot_id}`);
                const new_quantity = updateResult.rows[0].new_quantity;
                
                // 4. Save the Stock Change
                const insertChangeQuery = `
                    INSERT INTO stock_changes (lot_id, product_id, change_type, quantity_changed, user_id, new_quantity_after_change)
                    VALUES ($1, $2, 'DISPOSAL', -$3, $4, $5);
                `;
                await db.query(insertChangeQuery, [lot_id, product_id, quantity_taken_from_lot, userId, new_quantity]);

                quantity_to_remove -= quantity_taken_from_lot;
            }
            
            // 5. Check for fulfillment
            if (quantity_to_remove > 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({
                    message: `Insufficient stock among expired lots for Product ID ${product_id}. Remaining quantity needed: ${quantity_to_remove}.`
                });
            }
        }
        
        await db.query('COMMIT'); 
        return res.status(200).json({ message: 'Expired stock removed successfully.' });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error processing expired stock removal:', error.message || error);
        return res.status(500).json({ message: `Internal server error during expired stock removal: ${error.message || 'Unknown error'}` });
    }
}

async function saveOfficeUse(db, res, userId, requestData) {
    try {
        await db.query('BEGIN'); // Start transaction

        const items = requestData.items;

        // --- Initial Validation ---
        if (!userId || !Array.isArray(items) || items.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid request data. User ID and items array (product_id, quantity) are required.' });
        }

        // --- Core Logic: Process Each Item Used ---
        for (const item of items) {
            const { product_id, consumed_quantity } = item;
            let quantity_to_consume = consumed_quantity;

            // Basic item validation
            if (!product_id || !consumed_quantity || consumed_quantity <= 0) {
                throw new Error('Missing or invalid product_id or consumed_quantity for one or more items.');
            }

            // 1. Find all available stock lots for the product, ordered by expiry date (FEFO)
            const availableLotsQuery = `
                SELECT lot_id, quantity
                FROM stock_lots
                WHERE product_id = $1 AND quantity > 0
                ORDER BY expiry_date ASC, lot_id ASC;
            `;

            const availableLotsResult = await db.query(availableLotsQuery, [product_id]);

            if (availableLotsResult.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ 
                    message: `Product ID ${product_id} has no available stock to be used by the office.` 
                });
            }

            // 2. Iterate through lots (FEFO) and deduct the quantity
            for (const lot of availableLotsResult.rows) {
                const { lot_id, quantity: lot_quantity } = lot;

                if (quantity_to_consume <= 0) {
                    break; // All requested quantity has been consumed
                }

                // Determine how much to take from this specific lot
                const quantity_taken_from_lot = Math.min(quantity_to_consume, lot_quantity);

                if (quantity_taken_from_lot > 0) {
                    // 3. Update the stock_lots table (Subtract quantity)
                    const updateStockQuery = `
                        UPDATE stock_lots
                        SET quantity = quantity - $1,
                            status = CASE WHEN (quantity - $1) = 0 THEN 'CLEARED' ELSE status END
                        WHERE lot_id = $2
                        RETURNING quantity AS new_quantity;
                    `;
                    const updateResult = await db.query(updateStockQuery, [quantity_taken_from_lot, lot_id]);

                    if (updateResult.rowCount === 0) {
                        throw new Error(`Failed to update stock_lots for lot_id: ${lot_id}`);
                    }
                    
                    const new_quantity = updateResult.rows[0].new_quantity;
                    
                    // NOTE: A database TRIGGER is assumed to handle the update of the 'all_stocks' table here.

                    // 4. Save the Stock Change in the stock_changes table
                    const insertChangeQuery = `
                        INSERT INTO stock_changes (
                            lot_id, 
                            product_id, 
                            change_type, 
                            quantity_changed, 
                            user_id,
                            new_quantity_after_change
                        )
                        VALUES ($1, $2, 'OFFICE_USE', -$3, $4, $5);
                    `;
                    
                    // The quantity_changed is negative to represent the removal
                    await db.query(insertChangeQuery, [
                        lot_id,
                        product_id,
                        quantity_taken_from_lot,
                        userId,
                        new_quantity
                    ]);

                    // Reduce the remaining quantity needed for consumption
                    quantity_to_consume -= quantity_taken_from_lot;
                    console.log(`Deducted ${quantity_taken_from_lot} from Lot ${lot_id} for office use.`);
                }
            }
            
            // 5. Check if the full quantity was consumed
            if (quantity_to_consume > 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({
                    message: `Insufficient stock for Product ID ${product_id}. Remaining quantity needed: ${quantity_to_consume}.`
                });
            }
        }
        
        // --- Transaction Success ---
        await db.query('COMMIT'); 
        return res.status(200).json({ message: 'Office consumption recorded successfully, and inventory updated.' });

    } catch (error) {
        // --- Transaction Failure ---
        await db.query('ROLLBACK');
        console.error('Error processing office consumption:', error.message || error);
        
        return res.status(500).json({ message: `Internal server error during office consumption: ${error.message || 'Unknown error'}` });
    }
}

async function removeDamagedStock(db, res, userId, requestData) {
    try {
        await db.query('BEGIN'); // Start transaction

        const items = requestData.items;

        // --- Initial Validation ---
        if (!userId || !Array.isArray(items) || items.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid request data. User ID and items array (product_id, quantity, expiry_date) are required.' });
        }

        // --- Core Logic: Process Each Damaged Item ---
        for (const item of items) {
            const { product_id, damaged_quantity, expiry_date } = item;
            let quantity_to_remove = damaged_quantity;

            // Basic item validation
            if (!product_id || !damaged_quantity || damaged_quantity <= 0 || !expiry_date) {
                throw new Error('Missing or invalid product_id, damaged_quantity, or expiry_date for one or more items.');
            }

            // 1. Find all available stock lots for the product, prioritized by closest expiry date match.
            const availableLotsQuery = `
                SELECT lot_id, quantity
                FROM stock_lots
                WHERE product_id = $1 AND quantity > 0
                -- Order by absolute date difference, then by closest to expiration (FEFO) as a tie-breaker
                ORDER BY 
                    ABS(EXTRACT(EPOCH FROM (expiry_date::date - $2::date))), 
                    expiry_date ASC 
                LIMIT 100; -- Limit batch size for safety/performance
            `;

            const availableLotsResult = await db.query(availableLotsQuery, [product_id, expiry_date]);

            if (availableLotsResult.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({ 
                    message: `Product ID ${product_id} has no available stock matching the provided expiry date criteria.` 
                });
            }

            // 2. Iterate through matched lots and deduct the quantity (Closest-Date / Partial FEFO approach)
            for (const lot of availableLotsResult.rows) {
                if (quantity_to_remove <= 0) break;

                const { lot_id, quantity: lot_quantity } = lot;
                const quantity_taken_from_lot = Math.min(quantity_to_remove, lot_quantity);

                // 3. Update the stock_lots table (Subtract quantity)
                const updateStockQuery = `
                    UPDATE stock_lots
                    SET quantity = quantity - $1,
                        status = CASE WHEN (quantity - $1) = 0 THEN 'CLEARED' ELSE status END
                    WHERE lot_id = $2
                    RETURNING quantity AS new_quantity;
                `;
                const updateResult = await db.query(updateStockQuery, [quantity_taken_from_lot, lot_id]);

                if (updateResult.rowCount === 0) {
                    // This error indicates a race condition or stale data, rollback everything.
                    throw new Error(`Failed to update stock_lots for lot_id: ${lot_id}`);
                }
                
                const new_quantity = updateResult.rows[0].new_quantity;
                
                // 4. Save the Stock Change in the stock_changes table
                const insertChangeQuery = `
                    INSERT INTO stock_changes (
                        lot_id, 
                        product_id, 
                        change_type, 
                        quantity_changed, 
                        user_id,
                        new_quantity_after_change
                    )
                    VALUES ($1, $2, 'DAMAGED', -$3, $4, $5);
                `;
                
                // The quantity_changed is negative to represent the removal
                await db.query(insertChangeQuery, [
                    lot_id,
                    product_id,
                    quantity_taken_from_lot,
                    userId,
                    new_quantity
                ]);

                // Reduce the remaining quantity needed for removal
                quantity_to_remove -= quantity_taken_from_lot;
                console.log(`Deducted ${quantity_taken_from_lot} from Lot ${lot_id} for damaged disposal.`);
            }
            
            // 5. Check if the full quantity was removed
            if (quantity_to_remove > 0) {
                await db.query('ROLLBACK');
                return res.status(400).json({
                    message: `Insufficient total stock matching the closest expiry dates for Product ID ${product_id}. Remaining quantity needed: ${quantity_to_remove}.`
                });
            }
        }
        
        // --- Transaction Success ---
        await db.query('COMMIT'); 
        return res.status(200).json({ message: 'Damaged stock removed successfully, and inventory updated.' });

    } catch (error) {
        // --- Transaction Failure ---
        await db.query('ROLLBACK');
        console.error('Error processing damaged stock removal:', error.message || error);
        
        return res.status(500).json({ message: `Internal server error during damaged stock removal: ${error.message || 'Unknown error'}` });
    }
}

export {saveReturn, removeExpiredStock, saveOfficeUse, removeDamagedStock};
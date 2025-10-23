// Function to record a purchase
export default async function savePurchase(userId, purchaseData, db, res) {
    try {
        await db.query('BEGIN');

        const items = purchaseData.items;
        const supplierId = purchaseData.supplierId;
        
        // --- Initial Validation ---
        if (!userId || !Array.isArray(items) || items.length === 0) {
            await db.query('ROLLBACK');
            return res.status(400).json({ message: 'Invalid purchase data provided. User ID and items array are required.' });
        }

        // --- Purchase Header Creation ---
        let totalPurchaseAmount = 0;

        // Use a dedicated 'purchases' table (assuming one exists)
        const purchaseResult = await db.query(
            `INSERT INTO purchases (user_id, total_amount) VALUES ($1, $2) RETURNING id;`,
            [userId, 0.00] // Temporary 0.00 value
        );
        const purchaseId = purchaseResult.rows[0].id;

        // --- Line Item Processing and Stock Update (LOT Creation) ---
        
        // We will collect all product updates (last cost, selling price) into a batch
        const productUpdates = [];
        
        for (const item of items) {
            const { productId, quantity, unitCost, unitSellPrice, expiryDate } = item;

            // 1. Line Item Validation (Strict for purchase data)
            if (quantity <= 0 || unitCost <= 0 || unitSellPrice < 0 || !productId || !expiryDate) {
                await db.query('ROLLBACK');
                return res.status(400).json({ message: `Invalid data for purchase item. Ensure quantity, unit cost, selling price, and expiry date are valid. Product ID: ${productId}.` });
            }

            const lineTotalCost = quantity * unitCost;
            totalPurchaseAmount += lineTotalCost; // Accumulate the total purchase cost (before any supplier discount)

            // 2. Insert into purchase_line_items
            const purchaseLineResult = await db.query(
                `INSERT INTO purchase_line_items (purchase_id, product_id, quantity_purchased, cost_per_unit)
                 VALUES ($1, $2, $3, $4) RETURNING id;`,
                [purchaseId, productId, quantity, unitCost]
            );
            const purchaseLineItemId = purchaseLineResult.rows[0].id;

            // 3. Create a NEW Stock Lot
            const lotResult = await db.query(
                `INSERT INTO stock_lots (product_id, quantity_in_lot, cost_per_unit, expiry_date, purchase_line_item_id)
                 VALUES ($1, $2, $3, $4, $5) RETURNING lot_id;`,
                [productId, quantity, unitCost, expiryDate, purchaseLineItemId]
            );
            const newLotId = lotResult.rows[0].lot_id;
            
            // 4. Record Stock Change (Inflow)
            // Get current total stock for the product (needed for new_quantity_on_hand)
            const currentStockResult = await db.query(
                `SELECT COALESCE(SUM(quantity_in_lot), 0) AS total_quantity FROM stock_lots WHERE product_id = $1;`,
                [productId]
            );
            const currentTotalStock = parseFloat(currentStockResult.rows[0].total_quantity) + quantity;
            
            await db.query(
                `INSERT INTO stock_changes (product_id, change_type, quantity_change, new_quantity_on_hand, cost_impact, user_id, purchase_id, lot_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
                [productId, 'Purchase', quantity, currentTotalStock, lineTotalCost, userId, purchaseId, newLotId]
            );

            await db.query(
                'UPDATE purchase_line_items SET lot_id = $1 WHERE id = $2',
                [newLotId, purchaseLineItemId]
            );

            // 5. Update Product Metadata (Last Cost and Selling Price)
            productUpdates.push({
                productId: productId,
                unitCost: unitCost,
                unitSellPrice: unitSellPrice
            });
        }
        
        // --- Product Metadata Update (Single Transaction for all products) ---

        // This is simplified: in reality, you might use a sophisticated batch update
        // (like the CASE statement in the sale function) or a dedicated function.
        // For simplicity here, we iterate and update:
        for (const update of productUpdates) {
             await db.query(
                `UPDATE all_stocks SET 
                 last_updated_date = NOW(), 
                 unit_selling_price = $1 
                 WHERE id = $2;`,
                [update.unitSellPrice, update.productId]
            );
        }

        // --- Finalize Purchase Header ---
        await db.query(
            `UPDATE purchases SET total_amount = $1, supplier_id = $2 WHERE id = $3;`,
            [totalPurchaseAmount, supplierId, purchaseId]
        );

        await db.query('COMMIT');
        
        // Return only the necessary successful data.
        return { purchaseId: purchaseId }; 

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error processing purchase (unexpected):', error.message || error);
        
        // Use a specific error message for purchase
        throw new Error(`Failed to process purchase due to an internal error: ${error.message || 'Unknown error'}`);
    }
}
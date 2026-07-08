import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy } from "passport-local";
import env from "dotenv";
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Importing database login from another file(ignored on git)
import db from "./imports/dbConn.js";
// Importing login and register from imports folder
import * as userAuth from "./imports/login_register.js";
// Importing add/edit labels functions
import * as addEdit from "./imports/add_edit_labels.js";
// Importing add/edit labels functions
import * as sales from "./imports/salesLogic.js";
// Importing checkTransaction function
import checkTransaction from './imports/checkTransaction.js';
// importing addPurchase function
import savePurchase from './imports/addPurchase.js';
// importing internal stock updates
import { saveReturn, removeStock } from './imports/internalStockUpdates.js';
// import analytics module
import * as analytics from './imports/analytics.js';
// import dashboard data module
import * as dashboardData from './imports/dashboardData.js';
// Importing adjustment logic
import adjustment from './imports/adjustmentLogic.js';

const app = express();
const port = 3000;
const saltRounds = 5;
env.config();

app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Express Session
app.use(session({
    secret: process.env.SECRET_SESSION || 'fallback-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    } //24hrs cookie
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Global functions
function addLabel(name, tableName, req, res) {
    if (addEdit.addNew(name, tableName, db)) {
        res.status(201).json({ success: true, message: `New ${name} successfully added to ${tableName}` });
    } else {
        res.status(400).json({ success: false, message: `${name} not added, try again!` });
    }
}

function editLabel(name, id, tableName, req, res) {
    if (addEdit.addNew(name, id, tableName, db)) {
        res.status(200).json({ success: true, message: `${name} successfully edited in ${tableName}` });
    } else {
        res.status(400).json({ success: false, message: `${name} not edited, try again!` });
    }
}

//Starting database connection
db.connect();

// API ROUTES

app.get("/api/shopDetails", async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'imports', 'shopDetails.js');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        // Extract the object part using regex
        const match = fileContent.match(/const\s+shopDetails\s*=\s*({[\s\S]*?})/);
        if (match && match[1]) {
            // Using a safe eval (new Function) to parse the string object
            const shopDetails = new Function(`return ${match[1]}`)();
            res.json(shopDetails);
        } else {
            res.status(500).json({ error: "Could not parse shopDetails.js" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/shopDetails", async (req, res) => {
    try {
        const newDetails = req.body;
        const filePath = path.join(__dirname, 'imports', 'shopDetails.js');
        const content = `const shopDetails = {
    shopName: ${JSON.stringify(newDetails.shopName || '')},
    shopAddress: ${JSON.stringify(newDetails.shopAddress || '')},
    shopPhone: ${JSON.stringify(newDetails.shopPhone || '')},
    shopEmail: ${JSON.stringify(newDetails.shopEmail || '')},
    shopLogo: ${JSON.stringify(newDetails.shopLogo || '')},
}

export default shopDetails;`;
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ success: true, message: "Shop details updated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get("/api/me", (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

app.post('/api/change-password', async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Both old and new passwords are required' });
    }

    try {
        const result = await userAuth.changeUserPassword(req.user.id, oldPassword, newPassword, db);
        if (result.success) {
            res.status(200).json({ message: 'Password updated successfully' });
        } else {
            res.status(400).json({ message: result.message });
        }
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get("/api/salesPage", async (req, res) => {
    try {
        const categories = await db.query('SELECT name FROM categories');
        const banks = await db.query('SELECT * FROM banks');
        const customers = await db.query('SELECT id, name FROM customers');

        let shopDetails = {};
        try {
            const filePath = path.join(__dirname, 'imports', 'shopDetails.js');
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const match = fileContent.match(/const\s+shopDetails\s*=\s*({[\s\S]*?})/);
            if (match && match[1]) {
                shopDetails = new Function(`return ${match[1]}`)();
            }
        } catch (e) {
            console.error('Failed to load shop details', e);
        }

        res.json({
            categories: categories.rows,
            banks: banks.rows,
            customers: customers.rows,
            shopDetails: shopDetails
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/dashboard", async (req, res) => {
    try {
        const allUsers = await db.query('SELECT username, role FROM users');
        const salesData = await db.query("SELECT ast.name, change_type, quantity_change, unit_selling_price, last_cost_price FROM stock_changes AS sc JOIN all_stocks AS ast ON sc.product_id = ast.id WHERE sc.change_type = 'Sales' ORDER BY change_date DESC LIMIT 15");
        const stockValueResult = await db.query("SELECT COALESCE(SUM(total_quantity_in_stock * last_cost_price), 0) AS total_stock_value FROM all_stocks");
        const customersCount = await db.query("SELECT COUNT(*) FROM customers");

        res.json({
            users: allUsers.rows,
            recentSales: salesData.rows,
            totalStockValue: stockValueResult.rows[0].total_stock_value,
            totalCustomers: parseInt(customersCount.rows[0].count)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stock Page
app.get("/api/stockPage", async (req, res) => {
    try {
        const categories = await db.query('SELECT name FROM categories');
        const units = await db.query('SELECT name FROM units');
        res.json({
            categories: categories.rows,
            units: units.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/purchasePage", async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM suppliers');
        res.json({
            suppliers: result.rows
        });
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve suppliers: ${err.message}`,
            error: err.message
        });
    }
});

// Get transactions
app.get("/api/transactionPage", async (req, res) => {
    try {
        const userData = await db.query('SELECT id, username FROM users');
        res.json({
            users: userData.rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Product Tracker
app.get("/api/productTracker", async (req, res) => {
    try {
        const categories = await db.query('SELECT name FROM categories');
        res.json({
            categories: categories.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ********* Analytics Routes
app.get("/api/analytics/main", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Date range is required" });
        const metrics = await analytics.getMainMetrics(startDate, endDate, db);
        res.json({ success: true, ...metrics });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/analytics/staff", async (req, res) => {
    try {
        const { staffId, startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Date range is required" });
        const staffPerformance = await analytics.getStaffPerformance(staffId, startDate, endDate, db);
        res.json({ success: true, data: staffPerformance });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/analytics/customers", async (req, res) => {
    try {
        const { search, page = 1 } = req.query;
        const limit = 15;
        const offset = (parseInt(page) - 1) * limit;
        const customerData = await analytics.getCustomersAnalytics(search, offset, limit, db);
        res.json({ success: true, ...customerData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/analytics/products", async (req, res) => {
    try {
        const { startDate, endDate, limit, sort } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Date range is required" });
        const productData = await analytics.getProductPerformance(startDate, endDate, limit, sort, db);
        res.json({ success: true, data: productData });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ********* Dashboard Data Routes
app.get("/api/expenses", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: "Date range is required" });
        const expenses = await dashboardData.getExpenses(startDate, endDate, db);
        res.json({ success: true, expenses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/expenses", async (req, res) => {
    try {
        const { amount, description, date } = req.body;
        if (!amount || !description || !date) return res.status(400).json({ success: false, message: "Missing required fields" });
        const userId = req.user ? req.user.id : null;
        const newExpense = await dashboardData.addExpense(amount, description, date, userId, db);
        res.json({ success: true, expense: newExpense });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/expenses/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await dashboardData.deleteExpense(id, db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get("/api/banks", async (req, res) => {
    try {
        const banks = await dashboardData.getBanks(db);
        res.json({ success: true, banks });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/banks", async (req, res) => {
    try {
        const { bankName, accountNumber } = req.body;
        if (!bankName) return res.status(400).json({ success: false, message: "Bank name is required" });
        const newBank = await dashboardData.addBank(bankName, accountNumber, db);
        res.json({ success: true, bank: newBank });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put("/api/banks/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { bankName, accountNumber } = req.body;
        if (!bankName) return res.status(400).json({ success: false, message: "Bank name is required" });
        const updatedBank = await dashboardData.updateBank(id, bankName, accountNumber, db);
        res.json({ success: true, bank: updatedBank });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete("/api/banks/:id", async (req, res) => {
    try {
        const { id } = req.params;
        await dashboardData.deleteBank(id, db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// *********Sales processing
app.get("/api/searchItems", async (req, res) => {
    const { itemName, category, minPrice, maxPrice } = req.query;
    try {
        const data = await sales.searchDb(itemName, category, minPrice, maxPrice, db);
        if (data.length > 0) {
            res.json({
                success: true,
                message: `${data.length} item(s) found!`,
                contents: data
            });
        } else {
            res.status(404).json({
                success: false,
                message: "Item not found, check the name or criteria!",
                contents: []
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't search for item: ${err.message}`,
            error: err.message
        });
    }
});

// Search customers
app.get("/api/searchCustomers", async (req, res) => {
    const customerName = req.query.customerName;
    try {
        const result = await db.query('SELECT * FROM customers WHERE name ILIKE $1', [`%${customerName}%`])
        const data = result.rows;

        if (data.length > 0) {
            res.json({
                success: true,
                message: `${data.length} customer(s) found!`,
                contents: data
            });
        } else {
            res.status(404).json({
                success: false,
                message: "",
                contents: []
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve customers: ${err.message}`,
            error: err.message
        });
    }
});

// Update customer notes
app.put("/api/updateCustomerNotes", async (req, res) => {
    const { id, notes } = req.body;
    try {
        await db.query('UPDATE customers SET customer_notes = $1 WHERE id = $2', [notes, id]);
        res.json({
            success: true,
            message: "Customer notes updated successfully!"
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't update customer notes: ${err.message}`,
            error: err.message
        });
    }
});

// Add new customer
app.post("/api/addCustomer", async (req, res) => {
    const { name, phone_number, address, email, customer_notes } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO customers (name, phone_number, address, email, customer_notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, phone_number || null, address || null, email || null, customer_notes || null]
        );
        res.json({
            success: true,
            message: "Customer added successfully!",
            customer: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't add customer: ${err.message}`,
            error: err.message
        });
    }
});

// Get all customers
app.get("/api/allCustomers", async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM customers ORDER BY name ASC');
        res.json({
            success: true,
            contents: result.rows
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve customers: ${err.message}`,
            error: err.message
        });
    }
});

// Update customer (full)
app.put("/api/updateCustomer", async (req, res) => {
    const { id, name, phone_number, address, email, customer_notes } = req.body;
    try {
        const result = await db.query(
            'UPDATE customers SET name = $1, phone_number = $2, address = $3, email = $4, customer_notes = $5 WHERE id = $6 RETURNING *',
            [name, phone_number || null, address || null, email || null, customer_notes || null, id]
        );
        if (result.rows.length > 0) {
            res.json({
                success: true,
                message: "Customer updated successfully!",
                customer: result.rows[0]
            });
        } else {
            res.status(404).json({ success: false, message: "Customer not found." });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Couldn't update customer: ${err.message}`,
            error: err.message
        });
    }
});

// Item Tracker
app.get("/api/track-product", async (req, res) => {
    const { productId, startDate, stopDate } = req.query;
    try {
        const queryText = `
            SELECT 
                sc.id,
                sc.change_type,
                sc.quantity_change,
                sc.cost_impact,
                sc.change_date,
                sl.lot_id,
                u.username
            FROM stock_changes sc
            LEFT JOIN stock_lots sl ON sc.lot_id = sl.lot_id
            LEFT JOIN users u ON sc.user_id = u.id
            WHERE sc.product_id = $1
                AND sc.change_date >= $2::date 
                AND sc.change_date < ($3::date + '1 day'::interval)
            ORDER BY sc.change_date DESC;
        `;
        const values = [parseInt(productId), startDate, stopDate];
        const result = await db.query(queryText, values);
        const data = result.rows;

        if (data.length > 0) {
            res.json({
                success: true,
                message: `${data.length} transaction(s) found!`,
                contents: data
            });
        } else {
            res.status(404).json({
                success: false,
                message: "No transactions found for this item.",
                contents: []
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve data: ${error.message}`,
            error: error.message
        });
    }
});

// Fetch all stocks
app.get("/api/all-inventory", async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', filter = '' } = req.query;
        const limitVal = limit === 'all' ? null : parseInt(limit);
        const offset = limit === 'all' ? 0 : (parseInt(page) - 1) * limitVal;
        
        let queryParams = [];
        let countParams = [];
        let whereConditions = [];

        if (search) {
            whereConditions.push(`(ast.name ILIKE $1 OR ctg.name ILIKE $1 OR ast.generic_name ILIKE $1 OR ast.barcode ILIKE $1)`);
            queryParams.push(`%${search}%`);
            countParams.push(`%${search}%`);
        }

        if (filter === 'reorder') {
            whereConditions.push(`ast.total_quantity_in_stock <= ast.reorder_level AND ast.total_quantity_in_stock > 0`);
        } else if (filter === 'zero') {
            whereConditions.push(`ast.total_quantity_in_stock = 0`);
        }

        let whereClause = whereConditions.length > 0 ? "WHERE " + whereConditions.join(" AND ") : "";

        const countQuery = `
            SELECT COUNT(*) 
            FROM all_stocks ast
            LEFT JOIN categories ctg ON ast.category_id = ctg.id
            ${whereClause}
        `;
        
        let queryText = `
            SELECT 
                ast.id,
                ast.barcode,
                ast.name,
                ast.generic_name,
                ast.last_cost_price,
                ast.unit_selling_price,
                units.name AS unit,
                ctg.name AS category,
                ast.reorder_level,
                ast.description,
                ast.total_quantity_in_stock,
                ast.entry_date,
                ast.last_updated_date
            FROM all_stocks ast
            LEFT JOIN units ON ast.unit_id = units.id
            LEFT JOIN categories ctg ON ast.category_id = ctg.id
            ${whereClause}
            ORDER BY ast.name ASC
        `;

        if (limitVal !== null) {
            queryParams.push(limitVal);
            queryText += ` LIMIT $${queryParams.length}`;
            
            queryParams.push(offset);
            queryText += ` OFFSET $${queryParams.length}`;
        }

        const [countResult, result] = await Promise.all([
            db.query(countQuery, countParams),
            db.query(queryText, queryParams)
        ]);

        const inventory = result.rows;
        const totalCount = parseInt(countResult.rows[0].count, 10);

        res.json({
            success: true,
            message: inventory.length > 0 ? `${inventory.length} items(s) found!` : "No inventory items found.",
            contents: inventory,
            totalCount: totalCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Couldn't retrieve data: ${error.message}`,
            error: error.message
        });
    }
});

// Delete stock item
app.delete("/api/delete-item/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM all_stocks WHERE id = $1', [id]);
        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Couldn't delete item. It might be referenced in other records.`,
            error: error.message
        });
    }
});

// Add Stock Item
app.post("/api/addStock", async (req, res) => {
    const { name, genericName, barcode, category, unit, cost, price, reorderLevel, description } = req.body;
    try {
        const catRes = await db.query('SELECT id FROM categories WHERE name = $1', [category]);
        const categoryId = catRes.rows.length > 0 ? catRes.rows[0].id : null;

        const unitRes = await db.query('SELECT id FROM units WHERE name = $1', [unit]);
        const unitId = unitRes.rows.length > 0 ? unitRes.rows[0].id : null;

        const insertQuery = `
            INSERT INTO all_stocks 
            (name, generic_name, barcode, category_id, unit_id, last_cost_price, unit_selling_price, reorder_level, description, total_quantity_in_stock)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
            RETURNING *;
        `;
        const values = [
            name, 
            genericName || null, 
            barcode || null,
            categoryId, 
            unitId, 
            cost || 0, 
            price || 0, 
            reorderLevel || 0, 
            description || null
        ];
        
        const result = await db.query(insertQuery, values);
        res.json({ success: true, message: 'Product saved successfully!', item: result.rows[0] });
    } catch (error) {
        console.error('Error adding stock:', error);
        res.status(500).json({ success: false, message: 'Failed to save product: ' + error.message });
    }
});

// Update Stock Item
app.put("/api/update-item", async (req, res) => {
    const { id, name, genericName, barcode, category, unit, cost, price, reorderLevel, description, quantity } = req.body;
    try {
        const catRes = await db.query('SELECT id FROM categories WHERE name = $1', [category]);
        const categoryId = catRes.rows.length > 0 ? catRes.rows[0].id : null;

        const unitRes = await db.query('SELECT id FROM units WHERE name = $1', [unit]);
        const unitId = unitRes.rows.length > 0 ? unitRes.rows[0].id : null;

        const updateQuery = `
            UPDATE all_stocks 
            SET name = $1, generic_name = $2, barcode = $3, category_id = $4, unit_id = $5, 
                last_cost_price = $6, unit_selling_price = $7, reorder_level = $8, description = $9,
                last_updated_date = CURRENT_TIMESTAMP
            WHERE id = $10
            RETURNING *;
        `;
        const values = [
            name, 
            genericName || null, 
            barcode || null,
            categoryId, 
            unitId, 
            cost || 0, 
            price || 0, 
            reorderLevel || 0, 
            description || null, 
            id
        ];
        
        const result = await db.query(updateQuery, values);
        let updatedItem = result.rows[0];

        if (quantity !== undefined && quantity !== null && quantity !== '') {
            const currentQty = Number(updatedItem.total_quantity_in_stock);
            const newQty = Number(quantity);
            const adjustmentQty = newQty - currentQty;

            if (adjustmentQty !== 0) {
                const userId = req.user ? req.user.id : 1;
                const adjustmentItem = {
                    item_id: id,
                    adjustment_qty: adjustmentQty,
                    current_qty: currentQty,
                    last_cost_price: updatedItem.last_cost_price
                };
                
                const client = await db.connect();
                try {
                    await adjustment(client, userId, [adjustmentItem]);
                } finally {
                    client.release();
                }

                const freshRes = await db.query('SELECT * FROM all_stocks WHERE id = $1', [id]);
                updatedItem = freshRes.rows[0];
            }
        }

        res.json({ success: true, message: 'Product updated successfully!', item: updatedItem });
    } catch (error) {
        console.error('Error updating stock:', error);
        res.status(500).json({ success: false, message: 'Failed to update product: ' + error.message });
    }
});

// Internal Updates
app.post("/api/process-return", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await saveReturn(client, userId, req.body);
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Return processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

app.post("/api/process-expired", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, "Expired");
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Expired items processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

app.post("/api/process-office-use", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, "Office Use");
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Office use processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

app.post("/api/process-damaged", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, "Damaged");
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Damaged items processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

// Process Purchase
app.post("/api/process-purchase", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await savePurchase(userId, req.body, client, res);
        if (!res.headersSent) {
            res.status(201).json({ success: true, message: "Purchase processed successfully!" });
        }
    } catch (err) {
        if (!res.headersSent) {
            res.status(err.status || 500).json({ success: false, message: err.message });
        }
    } finally { client.release(); }
});

// Save Sale
app.post("/api/process-sale", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const saleData = req.body;
    try {
        const newSale = await sales.saveSale(userId, saleData, db, res);
        if (newSale && newSale.saleId) {
            res.status(201).json({
                success: true,
                message: `Sale successfully processed!`,
                contents: newSale
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Sale could not be saved. Invalid data or internal issue.",
                contents: {}
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Failed to process sale: ${err.message}`,
            error: err.message
        });
    }
});

// ********Transaction checking
app.post("/api/searchTransactions", async (req, res) => {
    const { startDate, endDate, transactionType, userId } = req.body;
    try {
        const data = await checkTransaction(startDate, endDate, transactionType, userId, db, res);
        const userData = await db.query('SELECT id, username FROM users');

        if (Array.isArray(data) && data.length > 0) {
            const transactionsWithRevenue = data.map(transaction => {
                if (transaction.change_type === 'Sales') {
                    const price = parseFloat(transaction.selling_price_per_unit);
                    const quantity = Math.abs(transaction.quantity_change);
                    transaction.gross_revenue_impact = (price * quantity).toFixed(2);
                } else {
                    transaction.gross_revenue_impact = null;
                }
                return transaction;
            });

            const totalSalesRevenue = transactionsWithRevenue.reduce((acc, curr) => {
                return acc + (parseFloat(curr.gross_revenue_impact) || 0);
            }, 0);

            const totalDiscount = transactionsWithRevenue.reduce((acc, curr) => {
                return acc + (parseFloat(curr.sale_discount) || 0);
            }, 0);

            const payRouteTotals = {};
            transactionsWithRevenue.forEach(transaction => {
                if (transaction.change_type === 'Sales' && transaction.pay_route) {
                    const impact = parseFloat(transaction.gross_revenue_impact) || 0;
                    if (!payRouteTotals[transaction.pay_route]) {
                        payRouteTotals[transaction.pay_route] = 0;
                    }
                    payRouteTotals[transaction.pay_route] += impact;
                }
            });
            
            for (const route in payRouteTotals) {
                payRouteTotals[route] = payRouteTotals[route].toFixed(2);
            }

            res.json({
                success: true,
                contents: transactionsWithRevenue,
                totalSalesRevenue: totalSalesRevenue.toFixed(2),
                totalDiscount: totalDiscount.toFixed(2),
                payRouteTotals: payRouteTotals,
                users: userData.rows,
            });
        } else if (!Array.isArray(data)) {
            res.status(400).json({ success: false, message: data });
        } else {
            res.status(404).json({ success: false, message: "No transactions found for this timeline" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Search Previous Sales
app.post("/api/searchSales", async (req, res) => {
    const { startDate, endDate, customerId, userId } = req.body;
    if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: 'Start date and end date are required.' });
    }
    try {
        const queryParts = [];
        const params = [];
        let paramCounter = 1;

        queryParts.push(`s.sale_date >= $${paramCounter}::date`);
        params.push(startDate);
        paramCounter++;

        queryParts.push(`s.sale_date < ($${paramCounter}::date + interval '1 day')`);
        params.push(endDate);
        paramCounter++;

        if (customerId && parseInt(customerId, 10) > 0) {
            queryParts.push(`s.customer_id = $${paramCounter}`);
            params.push(parseInt(customerId, 10));
            paramCounter++;
        }

        if (userId && parseInt(userId, 10) > 0) {
            queryParts.push(`s.user_id = $${paramCounter}`);
            params.push(parseInt(userId, 10));
            paramCounter++;
        }

        const salesQuery = `
            SELECT 
                s.id AS sale_id,
                s.sale_date,
                s.total_amount,
                s.discount_applied,
                s.pay_route,
                s.customer_id,
                c.name AS customer_name,
                s.user_id,
                u.username AS cashier_name,
                s.bank_id,
                b.bank_name
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN banks b ON s.bank_id = b.id
            WHERE ${queryParts.join(' AND ')}
            ORDER BY s.sale_date DESC
        `;
        const salesResult = await db.query(salesQuery, params);
        
        if (salesResult.rows.length === 0) {
            return res.json({ success: true, sales: [] });
        }

        const saleIds = salesResult.rows.map(r => r.sale_id);
        const lineItemsQuery = `
            SELECT 
                sli.id AS line_item_id,
                sli.sale_id,
                sli.product_id,
                ast.name AS product_name,
                sli.quantity_sold,
                sli.selling_price_per_unit,
                sli.cost_at_sale
            FROM sale_line_items sli
            JOIN all_stocks ast ON sli.product_id = ast.id
            WHERE sli.sale_id = ANY($1::int[])
            ORDER BY sli.id ASC
        `;
        const lineItemsResult = await db.query(lineItemsQuery, [saleIds]);

        const itemsBySaleId = {};
        lineItemsResult.rows.forEach(item => {
            if (!itemsBySaleId[item.sale_id]) {
                itemsBySaleId[item.sale_id] = [];
            }
            itemsBySaleId[item.sale_id].push(item);
        });

        const sales = salesResult.rows.map(sale => ({
            ...sale,
            items: itemsBySaleId[sale.sale_id] || []
        }));

        res.json({ success: true, sales });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Stock adjustments
app.post('/api/process-adjustments', async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const { items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided." });
    }

    const client = await db.connect();
    try {
        const result = await adjustment(client, userId, items);
        if (result.success) {
            res.status(200).json({
                success: true,
                message: "Adjustments processed successfully",
            });
        }
    } catch (err) {
        res.status(500).json({
            success: false,
            message: `Failed to process adjustments: ${err.message}`
        });
    } finally {
        client.release();
    }
});

// Process Returns
app.post("/api/process-return", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await saveReturn(client, userId, req.body);
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Return processed successfully!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(err.status || 500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

// Process Damaged items
app.post("/api/process-damaged", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, 'Damaged');
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Damaged items recorded!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(err.status || 500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

// Process Office Use
app.post("/api/process-officeUse", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, 'OfficeUse');
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Office use recorded!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(err.status || 500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

// Process Expired items
app.post("/api/process-expired", async (req, res) => {
    const userId = req.user ? req.user.id : 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await removeStock(client, userId, req.body, 'Expired');
        await client.query('COMMIT');
        res.status(201).json({ success: true, message: "Expired items cleared!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(err.status || 500).json({ success: false, message: err.message });
    } finally { client.release(); }
});

//********Register new / Edit user 
app.post("/api/editUser", async (req, res) => {
    let id = req.body.userId;
    let username = req.body.username;
    let password = req.body.password;
    let role = req.body.role;

    const queryParts = [];
    const params = [];
    let paramCounter = 1;

    if (username) {
        queryParts.push(`username = $${paramCounter}`);
        params.push(`${username}`);
        paramCounter++;
    }

    if (password) {
        try {
            const hash = await bcrypt.hash(password, saltRounds);
            queryParts.push(`password = $${paramCounter}`);
            params.push(`${hash}`);
            paramCounter++;
        } catch (err) {
            return res.status(500).json({ success: false, message: "Failed to hash password" });
        }
    }

    if (role) {
        queryParts.push(`role = $${paramCounter}`);
        params.push(`${role}`);
        paramCounter++;
    }

    let sqlQuery = 'UPDATE users SET ';
    if (queryParts.length > 0) {
        sqlQuery += queryParts.join(', ') + ' WHERE ' + `id = $${paramCounter}`;
        params.push(`${id}`);
    } else {
        return res.status(400).json({ success: false, message: "No fields provided for update." });
    }

    try {
        const result = await db.query(sqlQuery, params);
        if (result.rowCount > 0) {
            res.json({ success: true, message: "User Updated Successfully" });
        } else {
            res.status(404).json({ success: false, message: "User not found or no changes made." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: `Failed to update user: ${err.message}` });
    }
});

app.post("/api/registerUser", async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let role = req.body.role;

    const result = await userAuth.registerUser(username, password, role, db);
    if (result === "Already exists") {
        res.status(409).json({ success: false, message: "This username already exists" });
    } else if (result === "error") {
        res.status(500).json({ success: false, message: "There was an unexpected error, please try again" });
    } else {
        res.status(201).json({ success: true, message: `New user: ${username}, added successfully` });
    }
});

// Expenses
app.post("/api/addExpenses", async (req, res) => {
    let amount = req.body.amount;
    let description = req.body.description;
    let userId = req.user ? req.user.id : 1;

    try {
        const result = await db.query("INSERT INTO expenses (amount, description, user_id) VALUES ($1, $2, $3)",
            [amount, description, userId]);

        if (result.rowCount > 0) {
            res.status(201).json({ success: true, message: "New expense successfully added" });
        } else {
            res.status(400).json({ success: false, message: "Expense not added, try again!" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: `Failed to add expense: ${err.message}` });
    }
});

app.post("/api/deleteExpense", async (req, res) => {
    let id = req.body.id;
    try {
        const result = await db.query("DELETE FROM expenses WHERE id = $1", [id]);
        if (result.rowCount > 0) {
            res.json({ success: true, message: "Row successfully deleted" });
        } else {
            res.status(404).json({ success: false, message: "Row not deleted, try again!" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: `Failed to delete expense: ${err.message}` });
    }
});

// Customer route
app.post("/api/editCustomer", async (req, res) => {
    let id = req.body.customerId;
    let name = req.body.name;
    let phone = req.body.phone;
    let address = req.body.address;
    let email = req.body.email;

    try {
        const result = await db.query('UPDATE customers SET name = $1, phone_number = $2, address = $3, email = $4 WHERE id = $5',
            [name, phone, address, email, id]
        );
        if (result.rowCount > 0) {
            res.json({ success: true, message: "Customer's data successfully edited" });
        } else {
            res.status(404).json({ success: false, message: "Data not edited, please try again..." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post("/api/addNewCustomer", async (req, res) => {
    let name = req.body.name;
    let phone = req.body.phone;
    let address = req.body.address;
    let email = req.body.email;

    try {
        const result = await db.query('INSERT INTO customers(name, phone_number, address, email) VALUES ($1, $2, $3, $4)',
            [name, phone, address, email]
        );
        if (result.rowCount > 0) {
            res.status(201).json({ success: true, message: "New customer successfully added" });
        } else {
            res.status(400).json({ success: false, message: "Customer not added, please try again..." });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Label routes
app.post("/api/editUnit", (req, res) => editLabel(req.body.unit, req.body.unitId, 'units', req, res));
app.post("/api/addNewUnit", (req, res) => addLabel(req.body.unit, 'units', req, res));

app.post("/api/editCategory", (req, res) => editLabel(req.body.category, req.body.categoryId, 'categories', req, res));
app.post("/api/addNewCategory", (req, res) => addLabel(req.body.category, 'categories', req, res));

app.post("/api/editSupplier", (req, res) => editLabel(req.body.supplier, req.body.supplierId, 'suppliers', req, res));
app.post("/api/addNewSupplier", (req, res) => addLabel(req.body.supplier, 'suppliers', req, res));

app.post("/api/editCompany", (req, res) => editLabel(req.body.company, req.body.companyId, 'companies', req, res));
app.post("/api/addNewCompany", (req, res) => addLabel(req.body.company, 'companies', req, res));

// User Settings endpoints (Admin Only)
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user && req.user.role === 'administrator') {
        return next();
    }
    res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
};

app.get('/api/users', isAdmin, async (req, res) => {
    try {
        const result = await db.query('SELECT id, username, role FROM users ORDER BY id ASC');
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/users', isAdmin, async (req, res) => {
    let { username, password, role } = req.body;
    try {
        const result = await userAuth.registerUser(username, password, role, db);
        if (result === "Already exists") {
            res.status(409).json({ success: false, message: "This username already exists" });
        } else if (result === "error") {
            res.status(500).json({ success: false, message: "Error registering user" });
        } else {
            res.status(201).json({ success: true, message: `User ${username} added successfully` });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/users/:id', isAdmin, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const { username, role } = req.body;
    try {
        const result = await db.query('UPDATE users SET username = $1, role = $2 WHERE id = $3 RETURNING *', [username, role, targetUserId]);
        if (result.rowCount > 0) {
            // Log the user out by destroying their sessions
            const sessions = req.sessionStore.sessions;
            if (sessions) {
                for (const sessionId in sessions) {
                    try {
                        const sessionObj = JSON.parse(sessions[sessionId]);
                        if (sessionObj.passport && sessionObj.passport.user && sessionObj.passport.user.id === targetUserId) {
                            if (targetUserId !== req.user.id) {
                                req.sessionStore.destroy(sessionId);
                            } else {
                                req.session.passport.user.username = username;
                                req.session.passport.user.role = role;
                                req.session.save();
                            }
                        }
                    } catch (e) { }
                }
            }
            res.json({ success: true, message: 'User updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        if (err.code === '23505') { 
            res.status(409).json({ success: false, message: 'Username already exists' });
        } else {
            res.status(500).json({ success: false, message: err.message });
        }
    }
});

// CSV Import Endpoints
const allowedTables = ['all_stocks', 'customers', 'suppliers', 'categories', 'units', 'companies'];

app.get('/api/schema/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;
        if (!allowedTables.includes(tableName)) {
            return res.status(403).json({ success: false, message: "Table not allowed for import" });
        }

        const result = await db.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = 'public';
        `, [tableName]);

        // Filter out auto-generated ID columns
        const columns = result.rows.filter(col => col.column_name !== 'id');

        res.json({ success: true, schema: columns });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/import', async (req, res) => {
    try {
        const { tableName, mappings, data } = req.body;
        
        if (!allowedTables.includes(tableName)) {
            return res.status(403).json({ success: false, message: "Table not allowed for import" });
        }
        
        if (!data || data.length === 0) {
            return res.status(400).json({ success: false, message: "No data provided" });
        }

        // Get actual schema to validate mappings
        const schemaResult = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = $1 AND table_schema = 'public';
        `, [tableName]);
        const schemaCols = schemaResult.rows.map(r => r.column_name);

        const targetCols = Object.keys(mappings).filter(col => schemaCols.includes(col));
        if (targetCols.length === 0) {
            return res.status(400).json({ success: false, message: "No valid mappings provided" });
        }

        await db.query('BEGIN');
        
        let insertedCount = 0;
        for (const row of data) {
            const cols = [];
            const vals = [];
            const params = [];
            let pCounter = 1;

            for (const tCol of targetCols) {
                const csvCol = mappings[tCol];
                if (row[csvCol] !== undefined && row[csvCol] !== null && row[csvCol] !== "") {
                    cols.push(tCol);
                    params.push(row[csvCol]);
                    vals.push(`$${pCounter}`);
                    pCounter++;
                }
            }

            if (cols.length > 0) {
                const query = `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${vals.join(', ')})`;
                await db.query(query, params);
                insertedCount++;
            }
        }
        
        await db.query('COMMIT');
        res.json({ success: true, message: `Successfully imported ${insertedCount} rows into ${tableName}` });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Bulk import error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/users/:id/password', isAdmin, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const { adminPassword, newPassword } = req.body;
    const adminId = req.user.id;

    if (!adminPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Admin password and new password are required' });
    }

    try {
        const adminResult = await db.query("SELECT password FROM users WHERE id = $1", [adminId]);
        if (adminResult.rows.length === 0) return res.status(404).json({ success: false, message: "Admin not found" });

        const adminSavedPassword = adminResult.rows[0].password;
        const passwordMatch = await bcrypt.compare(adminPassword, adminSavedPassword);

        if (!passwordMatch) {
            return res.status(403).json({ success: false, message: "Incorrect admin password" });
        }

        const hash = await bcrypt.hash(newPassword, saltRounds);
        const updateResult = await db.query("UPDATE users SET password = $1 WHERE id = $2", [hash, targetUserId]);
        
        if (updateResult.rowCount > 0) {
            res.json({ success: true, message: 'Password updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Target user not found' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/users/:id', isAdmin, async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    if (targetUserId === req.user.id) {
        return res.status(400).json({ success: false, message: "You cannot delete yourself" });
    }
    try {
        const result = await db.query('DELETE FROM users WHERE id = $1', [targetUserId]);
        if (result.rowCount > 0) {
            res.json({ success: true, message: 'User deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        if (err.code === '23503') {
            res.status(400).json({ success: false, message: 'Cannot delete user because they are linked to existing records.' });
        } else {
            res.status(500).json({ success: false, message: err.message });
        }
    }
});

// Auth routes
app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(401).json({ success: false, message: info.message });
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.json({ success: true, message: "Logged in successfully", user });
        });
    })(req, res, next);
});

app.post("/api/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        } else {
            res.json({ success: true, message: "Logged out successfully" });
        }
    })
});

// Passport Authentication
passport.use("local", new Strategy(async function verify(username, password, cb) {
    try {
        let user = await userAuth.loginUser(username, password, db);
        if (user == "wrong password") {
            return cb(null, false, { message: 'Wrong Password!!' });
        } else if (user == "does not exist") {
            return cb(null, false, { message: 'This user is not registered, Contact your Admin.' });
        } else {
            return cb(null, user);
        }
    } catch (err) {
        return cb(err);
    }
}));

passport.serializeUser((user, cb) => {
    cb(null, user);
});
passport.deserializeUser((user, cb) => {
    cb(null, user)
});

//Listening at port >> 3000
app.listen(port, () => {
    console.log(`Server running at ${port}`)
});
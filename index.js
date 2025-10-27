import express from 'express';
import ejs from 'ejs';
import session from 'express-session';
import passport from 'passport';
import { Strategy } from "passport-local";
import flash from "connect-flash";
import env from "dotenv";
import bcrypt from 'bcrypt';

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
import {saveReturn, saveExpired, saveOfficeUse, saveDamaged} from './imports/internalStockUpdates.js';


const app = express();
const port = 3000;
const saltRounds = 5;
env.config();

app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));
// Express Session
app.use(session({
    secret: process.env.SECRET_SESSION,
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    } //24hrs cookie
}));
// Flash Messages Middleware
app.use(flash());
// Make flash messages available in all templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.failure_msg = req.flash('failure_msg');
   
    next();
});
// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Global Variables
let selectedItems = [];
let categoryList;
// Global functions
function addLabel(name, tableName, req, res){
    if(addEdit.addNew(name, tableName, db)){
        req.flash('success_msg', `New ${name} successfully added to ${tableName}`)
        res.redirect("/dashboard");
    }else{
        req.flash('failure_msg', `${name} not added, try again!`)
        res.redirect("/dashboard");
    }
}

function editLabel(name, id, tableName, req, res){
    if(addEdit.addNew(name, id, tableName, db)){
        req.flash('success_msg', `${name} successfully edited in ${tableName}`)
        res.redirect("/dashboard");
    }else{
        req.flash('failure_msg', `${name} not edited, try again!`)
        res.redirect("/dashboard");
    }
}

//Starting database connection
db.connect();

app.get("/", (req, res) => {
    res.render("index.ejs", {
        user: req.user
    });
});
app.get("/salesPage", async (req, res) => {
    // if(req.isAuthenticated()){
        const result = await db.query('SELECT name FROM categories')
        
        categoryList = [];
        let categories = result.rows;
        categories.forEach((ctg) => {
            categoryList.push(ctg.name);
        });

        res.render("salesPage.ejs", {
            user: req.user,
            selectedItems: selectedItems,
            categories: categoryList
        });
    // }else{
//         res.render("saleslogin.ejs");
//     }
});
app.get("/dashboard", async (req, res) => {
    // if(req.isAuthenticated()){
    //     console.log(req.user)
    //     if(req.user.role === "administrator"){
            const userData = await db.query('SELECT * FROM users');

            res.render("dashboard.ejs", {
                user: req.user,
                users: userData.rows
            });
    //     }
    //     else{
    //         res.render("saleslogin.ejs", {
    //             errorMessage: "User not an Admin"
    //         });
    //     }
    // }else{
    //     res.render("adminlogin.ejs");
    // }
})
app.get("/purchase", async (req, res) => {
    // if(req.isAuthenticated()){
    //     console.log(req.user)
    //     if(req.user.role === "administrator"){
            try{
                const result = await db.query('SELECT * FROM suppliers');
                res.render("purchase.ejs", {
                    user: req.user,
                    suppliers: result.rows
                });
            }catch(err){
                console.error('Database query error:', err);
                res.status(500).json({
                    success: false,
                    message: `Couldn't retrieve suppliers: ${err.message}`,
                    error: err.message
                });
            }
    //     }
    //     else{
    //         res.render("saleslogin.ejs", {
    //             errorMessage: "User not an Admin"
    //         });
    //     }
    // }else{
    //     res.render("adminlogin.ejs");
    // }
})
app.get("/transactions", async (req, res) => {
    // if(req.isAuthenticated()){
           const userData = await db.query('SELECT id, username FROM users');
    //     if(req.user.role === "administrator"){
            res.render("transactions.ejs", {
                users: userData.rows,
            });
    //     }
    //     else{
    //         res.render("saleslogin.ejs", {
    //             errorMessage: "User not an Admin"
    //         });
    //     }
    // }else{
    //     res.render("adminlogin.ejs");
    // }
})
app.get("/returnsPage", (req, res) => {
    res.render('internalStockUpdates.ejs', {
        returnsPage : true,
        expiredDrugsPage: false,
        officeUsePage: false,
        damagedDrugsPage: false
    })
})
app.get("/expiredDrugsPage", (req, res) => {
    res.render('internalStockUpdates.ejs', {
        returnsPage : false,
        expiredDrugsPage: true,
        officeUsePage: false,
        damagedDrugsPage: false
    })
})
app.get("/officeUsePage", (req, res) => {
    res.render('internalStockUpdates.ejs', {
        returnsPage : false,
        expiredDrugsPage: false,
        officeUsePage: true,
        damagedDrugsPage: false
    })
})
app.get("/damagedDrugsPage", (req, res) => {
    res.render('internalStockUpdates.ejs', {
        returnsPage : false,
        expiredDrugsPage: false,
        officeUsePage: false,
        damagedDrugsPage: true
    })
})
// User log in
app.get("/adminlogin", (req, res) => {
    const errorMessage = req.flash('error');

    res.render('adminlogin.ejs', {
        errorMessage: errorMessage.length ? errorMessage[0] : null
    });
});
app.get('/saleslogin', (req, res) => {
    // Get flash messages
    const errorMessage = req.flash('error');
    
    res.render('saleslogin.ejs', {
        errorMessage: errorMessage.length ? errorMessage[0] : null
    });
});

// *********Sales processing
// step 1: getting the list of items from a search
app.get("/api/searchItems", async (req, res) => {
    // 1. Read parameters from req.query (since frontend uses a GET request with query params)
    let itemName = req.query.itemName;
    let category = req.query.category;
    let minPrice = req.query.minPrice;
    let maxPrice = req.query.maxPrice;

    try{
        // Execute the database search
        const data = await sales.searchDb(itemName, category, minPrice, maxPrice, db);
        
        if(data.length > 0){
            // Success: Return the search results as JSON
            res.json({
                success: true,
                message: `${data.length} item(s) found!`,
                contents: data // The array of search results
            });
        } else {
            // No results found: Return a failure message as JSON
            res.status(404).json({  
                success: false,
                message: "Item not found, check the name or criteria!",
                contents: []
            });
        }
    } catch(err){
        console.error('Database query error:', err);
        // Server error: Return a 500 status with an error message
        res.status(500).json({ 
            success: false,
            message: `Couldn't search for item: ${err.message}`,
            error: err.message 
        });
    }
});

// Save Sale
app.post("/api/process-sale", async (req, res) => {
    // const userId = req.user.id;
    const userId = 1; // Temporary hardcoded user ID for testing

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
        console.error('Sale processing error:', err);
       
        res.status(500).json({ 
            success: false,
            message: `Failed to process sale: ${err.message}`,
            error: err.message 
        });
    }

    // console.log(sales.saveSale(saleData)); 
});

// ********Transaction checking
app.post("/searchTransactions", async (req, res) => {
    const { startDate, endDate, transactionType, userId } = req.body;

    const data = await checkTransaction(startDate, endDate, transactionType, userId, db, res);

    if(Array.isArray(data) && data.length > 0){
        const transactionsWithRevenue = data.map(transaction => {
            if (transaction.change_type === 'Sales') {
                const price = parseFloat(transaction.selling_price_per_unit);
                // quantity_change is negative for sales, using Math.abs()
                const quantity = Math.abs(transaction.quantity_change); 
                
                transaction.gross_revenue_impact = (price * quantity).toFixed(2);
            } else {
                transaction.gross_revenue_impact = null;
            }
            
            // We can delete the temp fie vbbvld or keep it for debugging.
            return transaction;
        });

        const totalSalesRevenue = transactionsWithRevenue.reduce((acc, curr) => {   
            return acc + (parseFloat(curr.gross_revenue_impact) || 0);
        }, 0);

        const totalDiscount = transactionsWithRevenue.reduce((acc, curr) => {   
            return acc + (parseFloat(curr.sale_discount) || 0);
        }, 0);

        res.render('transactions.ejs', {
            contents: transactionsWithRevenue,
            totalSalesRevenue: totalSalesRevenue.toFixed(2),
            totalDiscount: totalDiscount.toFixed(2)
        })
    }else if(!Array.isArray(data)){
        res.render('transactions.ejs', {
            message: data
        });
    }else{
        res.render('transactions.ejs', {
            message: "No transactions found for this timeline"
        });
    }
})

app.post("/api/process-purchase", async (req, res) => {
    // const userId = req.user.id;
    const userId = 1; // Temporary hardcoded user ID for testing
    const purchaseData = req.body;

    try {
        const newPurchase = await savePurchase(userId, purchaseData, db, res);

        if (newPurchase && newPurchase.purchaseId) {
            res.status(201).json({
                success: true,
                message: `Purchase successfully processed!`,
                contents: newPurchase
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Purchase could not be saved. Invalid data or internal issue.",
                contents: {}
            });
        }
    } catch (err) {
        console.error('Purchase processing error:', err);

        res.status(500).json({
            success: false,
            message: `Failed to process purchase: ${err.message}`,
            error: err.message
        });
    }
});

// Process Returns
app.post("/api/process-return", async (req, res) => {
    // const userId = req.user.id;
    const userId = 1; //temporary placeholder
    const data = req.body.requestData;

    try {
        const result = await saveReturn(db, res, userId, data);

        if (result && result.stockChangeId) {
            res.status(201).json({
                success: true,
                message: `Return successfully processed!`
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Return could not be saved. Invalid data or internal issue.",
            });
        }
    } catch (err) {
        console.error('Return processing error:', err);

        res.status(500).json({
            success: false,
            message: `Failed to process Return: ${err.message}`,
            error: err.message
        });
    }
})

// Process Damaged items
app.post("/api/process-damaged", async (req, res) => {
    // const userId = req.user.id;
    const userId = 1; //temporary placeholder
    const data = req.body.requestData;

    try {
        const result = await saveDamaged(db, res, userId, data);

        if (result && result.stockChangeId) {
            res.status(201).json({
                success: true,
                message: `Damaged items successfully processed!`
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Damaged items could not be saved. Invalid data or internal issue.",
            });
        }
    } catch (err) {
        console.error('Damaged items processing error:', err);

        res.status(500).json({
            success: false,
            message: `Failed to process Damaged items: ${err.message}`,
            error: err.message
        });
    }
})

// Process Office Use
app.post("/api/process-officeUse", async (req, res) => {
    // const userId = req.user.id;
    const userId = 1; //temporary placeholder
    const data = req.body.requestData;

    try {
        const result = await saveReturn(db, res, userId, data);

        if (result && result.stockChangeId) {
            res.status(201).json({
                success: true,
                message: `Office use successfully processed!`
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Office use could not be saved. Invalid data or internal issue.",
            });
        }
    } catch (err) {
        console.error('Office use processing error:', err);

        res.status(500).json({
            success: false,
            message: `Failed to process Office use: ${err.message}`,
            error: err.message
        });
    }
})

// Process Expired items
app.post("/api/process-expired", async (req, res) => {
    // const userId = req.user.id;
    const userId = 1; //temporary placeholder
    const data = req.body.requestData;

    try {
        const result = await saveReturn(db, res, userId, data);

        if (result && result.stockChangeId) {
            res.status(201).json({
                success: true,
                message: `Return successfully processed!`
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Return could not be saved. Invalid data or internal issue.",
            });
        }
    } catch (err) {
        console.error('Return processing error:', err);

        res.status(500).json({
            success: false,
            message: `Failed to process Return: ${err.message}`,
            error: err.message
        });
    }
})

//********Register new / Edit user 
app.post("/editUser", async (req, res) => {
    let id = req.body.userId;
    let username = req.body.username;
    let password = req.body.password;
    let role = req.body.role;

    const queryParts = [];
    const params = [];
    let paramCounter = 1; // Used for $1, $2, $3...

    if (username) {
        queryParts.push(`username = $${paramCounter}`); // Removed trailing comma
        params.push(`${username}`);
        paramCounter++;
    }

    if (password) {
        try {
            const hash = await bcrypt.hash(password, saltRounds);
            queryParts.push(`password = $${paramCounter}`);
            params.push(`${hash}`);
            paramCounter++;
            console.log("Hashed password:", hash);
        } catch (err) {
            console.error("Error hashing password", err);
            return res.status(500).json({ error: "Failed to hash password" });
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
        // If no fields to update (e.g., only ID provided without username, password, or role)
        //send a 400 Bad Request.
        return res.status(400).json({ error: "No fields provided for update." });
    }

    console.log('Generated SQL Query:', sqlQuery);
    console.log('Parameters:', params);

    try {
        const result = await db.query(sqlQuery, params);
        console.log('Database update result:', result.rows);
        if (result.rowCount > 0) {
            req.flash('success_msg', "User Updated Successfully")
            res.redirect("/dashboard");
        } else {
            req.flash('failure_msg', "User not found or no changes made.")
            res.redirect("/dashboard");
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to update user: ${err.message}` });
    }
});
app.post("/registerUser", async (req, res) => {
    let username = req.body.username;
    let password = req.body.password;
    let role = req.body.role;

    const result = await userAuth.registerUser(username, password, role, db);
    console.log(result);
    if(result === "Already exists"){
        req.flash('failure_msg', "This username already exists")
        res.redirect("/dashboard");
    }else if(result === "error"){
        req.flash('failure_msg', "There was an unexpected error, please try again")
        res.redirect("/dashboard");
    }else{
        req.flash('success_msg', `New user: ${username}, added successfully`)
        res.redirect("/dashboard");
    }
})

// Expenses
app.post("/addExpenses", async (req, res) => {
    let amount = req.body.amount;
    let description = req.body.description;
    let userId = req.body.userId; //to be changed to req.user.id later

    try{
        const result = await db.query("INSERT INTO expenses (amount, description, user_id) VALUES ($1, $2, $3)",
        [amount, description, userId]);
        
        if(result.rowCount > 0){
            req.flash('success_msg', "New expense successfully added")
            res.redirect("/dashboard");
        }else{
            req.flash('failure_msg', "Expense not added, try again!")
            res.redirect("/dashboard");
        }
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to add expense: ${err.message}` });
    }
})
app.post("/deleteExpense", async (req, res) => {
    let id = req.body.id;

    try{
        const result = await db.query("DELETE FROM expenses WHERE id = $1",
        [id]);

        if(result.rowCount > 0){
            req.flash('success_msg', "Row successfully deleted")
            res.redirect("/dashboard");
        }else{
            req.flash('failure_msg', "Row not deleted, try again!")
            res.redirect("/dashboard");
        }
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to add expense: ${err.message}` });
    }
})

// Customer route
app.post("/editCustomer", async (req, res) => {
    let id = req.body.customerId;
    let name = req.body.name;
    let phone = req.body.phone;
    let address = req.body.address;
    let email = req.body.email;

    try{
        const result = await db.query('UPDATE customers SET name = $1, phone_number = $2, address = $3, email = $4 WHERE id = $5',
            [name, phone, address, email, id]
        )

        if(result.rowCount > 0){
            req.flash('success_msg', "Customer's data successfully edited")
            res.redirect("/dashboard");
        }else{
            req.flash('failure_msg', "Data not edited, please try again...")
            res.redirect("/dashboard");
        }
    }catch(err){
        console.error(err);
    }
})
app.post("/addNewCustomer", async (req, res) => {
    let name = req.body.name;
    let phone = req.body.phone;
    let address = req.body.address;
    let email = req.body.email;

    try{
        const result = await db.query('INSERT INTO customers(name, phone_number, address, email) VALUES ($1, $2, $3, $4)',
            [name, phone, address, email]
        )

        if(result.rowCount > 0){
            req.flash('success_msg', "New customer successfully added")
            res.redirect("/dashboard");
        }else{
            req.flash('failure_msg', "Customer not added, please try again...")
            res.redirect("/dashboard");
        }
    }catch(err){
        console.error(err);
    }
})


// Unit route
app.post("/editUnit", async (req, res) => {
    let name = req.body.unit;
    let id = req.body.unitId;

    editLabel(name, id, 'units', req, res);
})
app.post("/addNewUnit", async (req, res) => {
    let name = req.body.unit;

    addLabel(name, 'units', req, res);
})

// Categories route
app.post("/editCategory", async (req, res) => {
    let name = req.body.category;
    let id = req.body.categoryId;

    editLabel(name, id, 'categories', req, res);
})
app.post("/addNewCategory", async (req, res) => {
    let name = req.body.category;

    addLabel(name, 'categories', req, res);
})

// Suppliers route
app.post("/editSupplier", async (req, res) => {
    let name = req.body.supplier;
    let id = req.body.supplierId;

    editLabel(name, id, 'suppliers', req, res);
})
app.post("/addNewSupplier", async (req, res) => {
    let name = req.body.supplier;

    addLabel(name, 'suppliers', req, res);
})

// Companies route
app.post("/editCompany", async (req, res) => {
    let name = req.body.company;
    let id = req.body.companyId;

    editLabel(name, id, 'companies', req, res);
})
app.post("/addNewCompany", async (req, res) => {
    let name = req.body.company;

    addLabel(name, 'companies', req, res);
})

app.post("/salesLogin", passport.authenticate("local", {
    successRedirect: "/salesPage",
    failureRedirect: "/salesLogin",
    failureFlash: true   // Crucial: Pass the message from LocalStrategy to connect-flash
}));
app.post("/adminLogin", passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/adminlogin",
    failureFlash: true   // Crucial: Pass the message from LocalStrategy to connect-flash
}));

// logout
app.get("/logout", (req, res) => {
    req.logout((err) => {
        if(err){
            console.log(err);
        }else{
            res.redirect("/salesLogin")
        }
    })
})

// Passport Authentication
passport.use("local", new Strategy (async function verify(username, password, cb){
    try{
        let user = await userAuth.loginUser(username, password, db);

        if(user == "wrong password"){
            return cb(null, false, { message: 'Wrong Password!!'});
        }else if(user == "does not exist"){
            return cb(null, false, { message: 'This user is not registered, Contact your Admin.' });
        }else{
            return cb(null, user);
        }
    }catch(err){
        return cb(err);
    }
}))

passport.serializeUser((user, cb) => {
    cb(null, user);
})
passport.deserializeUser((user, cb) => {
    cb(null, user)
})

//Listening at port >> 3000
app.listen(port, () => {
    console.log(`Server running at ${port}`)
})
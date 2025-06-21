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

const app = express();
const port = 3000;
const saltRounds = 5;
env.config();

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
// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

//Starting database connection
db.connect();

app.get("/", (req, res) => {
    res.render("index.ejs");
});
app.get("/salesPage", (req, res) => {
    if(req.isAuthenticated()){
        res.render("salesPage.ejs", {
            username: req.user
        });
    }else{
        res.render("saleslogin.ejs");
    }
});
app.get("/dashboard", async (req, res) => {
    const userData = await db.query('SELECT * FROM users');
    // console.log(userData)
    res.render("dashboard.ejs", {
        users: userData.rows
    });
})
app.get("/adminLogin", (req, res) => {
    res.render("adminLogin.ejs");
});
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
            res.render('/dashboard.ejs', {
                feedback: "User Updated Successfully"
            })
        } else {
            res.render('/dashboard.ejs', {
                feedback: "User not found or no changes made."
            })
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
        res.render("dashboard.ejs", {
            feedback: "This username already exists"
        });
    }else if(result === "error"){
        res.render("dashboard.ejs", {
            feedback: "There was an unexpected error, please try again"
        });
    }else{
        res.render("dashboard.ejs", {
            feedback: "User added successfully"
        });
    }
})

// Expenses
app.post("/addExpenses", async (req, res) => {
    let amount = req.body.amount;
    let description = req.body.description;
    let userId = req.user.id;

    try{
        const result = await db.query("INSERT INTO expenses (amount, description, userId) VALUES ($1, $2, $3)",
        [amount, description, userId]
    )
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to add expense: ${err.message}` });
    }
})
app.post("/deleteExpense", async (req, res) => {
    let id = req.body.id;

    try{
        const result = await db.query("DELETE FROM expenses WHERE id = $1",
        [id]
    )
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to add expense: ${err.message}` });
    }
})

// Unit route
app.post("/editUnit", async (req, res) => {
    let id = req.body.unitId;
    let unit = req.body.unit;

    try{
        const result = await db.query("UPDATE unit SET name = $1 WHERE id = $2",
        [unit, id]
    )
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to edit Unit: ${err.message}` });
    }
})
app.post("/addNewUnit", async (req, res) => {
    let unit = req.body.unit;

    try{
        const result = await db.query("INSERT INTO unit (name) VALUES ($1)",
        [unit]
    )
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to add new Unit: ${err.message}` });
    }
})

// Categories route
app.post("/editCategory", async (req, res) => {
    let id = req.body.categoryId;
    let category = req.body.category;

    try{
        const result = await db.query("UPDATE categories SET name = $1 WHERE id = $2",
        [category, id]
    )
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to edit category: ${err.message}` });
    }
})
app.post("/addNewCategory", async (req, res) => {
    let category = req.body.category;

    try{
        const result = await db.query("INSERT INTO categories (name) VALUES ($1)",
        [category]
    )
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to add new category: ${err.message}` });
    }
})

// Suppliers route
app.post("/editSupplier", async (req, res) => {
    let id = req.body.supplierId;
    let supplier = req.body.supplier;

    try{
        const result = await db.query("UPDATE suppliers SET name = $1 WHERE id = $2",
        [supplier, id]
    )
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to edit supplier: ${err.message}` });
    }
})
app.post("/addNewCategory", async (req, res) => {
    let supplier = req.body.supplier;

    try{
        const result = await db.query("INSERT INTO suppliers (name) VALUES ($1)",
        [supplier]);
        
        
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to add new supplier: ${err.message}` });
    }
})

app.post("/saleslogin", passport.authenticate("local", {
    successRedirect: "/salesPage",
    failureRedirect: "/saleslogin",
    failureFlash: true   // Crucial: Pass the message from LocalStrategy to connect-flash
}));

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
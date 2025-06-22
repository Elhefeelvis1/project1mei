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
// Import add/edit labels functions
import * as addEdit from "./imports/add_edit_labels.js";


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
// Make flash messages available in all templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.failure_msg = req.flash('failure_msg');
   
    next();
});
// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Some functions
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
    let userId = req.user.userId;

    try{
        const result = await db.query("INSERT INTO expenses (amount, description, userId) VALUES ($1, $2, $3)",
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

    editLabel(name, id, 'categories');
})
app.post("/addNewCategory", async (req, res) => {
    let name = req.body.category;

    addLabel(name, 'categories');
})

// Suppliers route
app.post("/editSupplier", async (req, res) => {
    let name = req.body.supplier;
    let id = req.body.supplierId;

    editLabel(name, id, 'suppliers');
})
app.post("/addNewSupplier", async (req, res) => {
    let name = req.body.supplier;

    addLabel(name, 'suppliers');
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
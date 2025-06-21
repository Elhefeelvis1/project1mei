export async function addNew(name, tableName, db){
    try{
        const result = await db.query(`INSERT INTO ${tableName} (name) VALUES ($1)`,
        [name]);

        if(result.rowCount > 0){
            res.render("dashboard.ejs", {
                feedback: `New ${name} successfully added`
            })
        }else{
            res.render("dashboard.ejs", {
                feedback: `${name} not added, try again!`
            })
        }
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to add new ${name}: ${err.message}` });
    }
}

export async function edit(name, id, tableName, db){
    try{
        const result = await db.query(`UPDATE ${tableName} SET name = $1 WHERE id = $2`,
        [name, id]);

        if(result.rowCount > 0){
            res.render("dashboard.ejs", {
                feedback: `${name} successfully edited`
            })
        }else{
            res.render("dashboard.ejs", {
                feedback: `${name} not edited, try again!`
            })
        }
    }catch(err){
        console.error('Database query error:', err);
        res.status(500).json({ error: `Failed to edit ${name}: ${err.message}` });
    }
}
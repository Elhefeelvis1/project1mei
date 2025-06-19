import bcrypt from 'bcrypt';

const saltRounds = 5;

export async function registerUser(username, password, role, db){

    try{
        const user = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if(user.rows.length > 0){
            return "Already exists";
        }else{
            // Password Hashing
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if(err){
                    console.log("Error hashing password", err);
                    return "error"
                }else{  
                    const result = await db.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3)", [
                        username, hash, role
                    ]);
                    console.log(result);
                    return result;
                }
            })
        }
    }catch(err){
        console.error(err)
    }
}

export async function loginUser(username, password, db) {
    try {
        const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        const data = result.rows;

        if (data.length > 0) {
            const savedPassword = data[0].password;
            const passwordMatch = await new Promise((resolve, reject) => {
                bcrypt.compare(password, savedPassword, (err, correct) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(correct);
                    }
                });
            });

            if (passwordMatch) {
                return data[0];
            } else {
                return "wrong password";
            }
        } else {
            return "does not exist";
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
}
import pg from 'pg';

const db = new pg.Client({
    user: 'postgres',
    host: 'localhost',
    database: 'shop_keeper',
    password: 'Marcelinus',
    port: '5432'
});

export default db;
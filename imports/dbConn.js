import pg from 'pg';

const db = new pg.Client({
    user: 'postgres',
    host: 'localhost',
    database: 'shopkeeper',
    password: 'Marcelinus1',
    port: '5432'
});

export default db;
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    theme TEXT DEFAULT 'light',

    UNIQUE (username)
);

CREATE TABLE all_stocks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    generic_name TEXT,
    serial_number TEXT,
    unit_cost DECIMAL(10, 2) NOT NULL,
    unit_selling_price DECIMAL(10, 2) NOT NULL,
    unit_quantity_in_stock INTEGER NOT NULL,
    unit_id INTEGER NOT NULL,
    company_id INTEGER,
    category_id INTEGER DEFAULT 0,
    reorder_level INTEGER NOT NULL,
    expiry_date DATE NOT NULL,
    entry_date DATE NOT NULL,
    last_updated_date DATE NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL,

    UNIQUE (serial_number),

    CONSTRAINT fk_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_unit_id
        FOREIGN KEY (unit_id)
        REFERENCES units (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_category_id
        FOREIGN KEY (category_id)
        REFERENCES categories (id)
        ON UPDATE CASCADE
        ON DELETE SET DEFAULT,

    CONSTRAINT fk_company_id
        FOREIGN KEY (company_id)
        REFERENCES companies (id)
        ON UPDATE CASCADE
        ON DELETE SET DEFAULT

);

CREATE TABLE units(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE categories(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE suppliers(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE companies(
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE expenses(
    id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT NOT NULL,
    date 
    user_id INTEGER,

    CONSTRAINT fk_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
)

CREATE TABLE purchases(
    id SERIAL PRIMARY KEY,
    item_id INTEGER,
    unit_cost DECIMAL(10, 2) NOT NULL,
    unit_selling_price DECIMAL(10, 2) NOT NULL,
    unit_quantity INTEGER NOT NULL,
    new_expiry_date DATE NOT NULL,
    purchase_date DATE NOT NULL,
    supplier_id INTEGER,
    user_id INTEGER NOT NULL,

    CONSTRAINT fk_item_id
        FOREIGN KEY (item_id)
        REFERENCES all_stocks (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_id
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE stock_changes (
    id SERIAL PRIMARY KEY,
    item_id INTEGER,
    payment_method TEXT,
    type TEXT NOT NULL,
    change_date DATE NOT NULL,
    user_id INTEGER NOT NULL,

    CONSTRAINT fk_item_id
        FOREIGN KEY (item_id)
        REFERENCES all_stocks (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
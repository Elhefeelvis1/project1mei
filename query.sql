CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    theme TEXT DEFAULT 'light',

    UNIQUE (username)
);

-- Units Table (e.g., 'Tablet', 'Bottle', 'Box')
CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Categories Table (e.g., 'Antibiotics', 'Pain Relievers')
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Insert default 'Uncategorized' category for FK SET DEFAULT
INSERT INTO categories (id, name) VALUES (0, 'Uncategorized');

-- Suppliers Table
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Companies Table (manufacturers, brands)
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Insert default 'Unknown Company' for FK SET DEFAULT
INSERT INTO companies (id, name) VALUES (0, 'Unknown Company');


CREATE TABLE expenses(
    id SERIAL PRIMARY KEY,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    user_id INTEGER,

    CONSTRAINT fk_user_id
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
)

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number INT,
    address TEXT,
    email TEXT
)

CREATE TABLE all_stocks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    generic_name TEXT,
    serial_number TEXT UNIQUE,
    unit_selling_price DECIMAL(10, 2) NOT NULL,
    reorder_level INTEGER NOT NULL,
    description TEXT,
    total_quantity_in_stock INTEGER NOT NULL DEFAULT 0 CHECK (total_quantity_in_stock >= 0), --calculates total quantity of a product in all lots
    
    -- Audit fields
    entry_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    
    -- Foreign Keys
    unit_id INTEGER NOT NULL,
    category_id INTEGER DEFAULT 0,
    company_id INTEGER DEFAULT 0,

    CONSTRAINT fk_user_product_def
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_unit_product_def
        FOREIGN KEY (unit_id) REFERENCES units (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_category_product_def
        FOREIGN KEY (category_id) REFERENCES categories (id)
        ON UPDATE CASCADE ON DELETE SET DEFAULT,

    CONSTRAINT fk_company_product_def
        FOREIGN KEY (company_id) REFERENCES companies (id)
        ON UPDATE CASCADE ON DELETE SET DEFAULT
);

-- Function to update total_quantity_in_stock after INSERT, UPDATE, or DELETE on stock_lots
CREATE OR REPLACE FUNCTION update_all_stocks_total_quantity()
RETURNS TRIGGER AS $$
BEGIN
    -- For INSERT or UPDATE:
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        UPDATE all_stocks
        SET total_quantity_in_stock = (
            SELECT COALESCE(SUM(quantity_in_lot), 0)
            FROM stock_lots
            WHERE product_id = NEW.product_id
        )
        WHERE id = NEW.product_id;
        RETURN NEW;
    END IF;

    -- For DELETE:
    IF (TG_OP = 'DELETE') THEN
        UPDATE all_stocks
        SET total_quantity_in_stock = (
            SELECT COALESCE(SUM(quantity_in_lot), 0)
            FROM stock_lots
            WHERE product_id = OLD.product_id
        )
        WHERE id = OLD.product_id;
        RETURN OLD;
    END IF;

    RETURN NULL; -- Should not be reached
END;
$$ LANGUAGE plpgsql;

-- Trigger for INSERTs on stock_lots
CREATE TRIGGER trg_update_all_stocks_total_on_insert
AFTER INSERT ON stock_lots
FOR EACH ROW
EXECUTE FUNCTION update_all_stocks_total_quantity();

-- Trigger for UPDATEs on stock_lots (specifically when quantity_in_lot changes)
CREATE TRIGGER trg_update_all_stocks_total_on_update
AFTER UPDATE OF quantity_in_lot ON stock_lots
FOR EACH ROW
EXECUTE FUNCTION update_all_stocks_total_quantity();

-- Trigger for DELETEs on stock_lots
CREATE TRIGGER trg_update_all_stocks_total_on_delete
AFTER DELETE ON stock_lots
FOR EACH ROW
EXECUTE FUNCTION update_all_stocks_total_quantity();

-- stock_lots Table (Individual Batches of Stock)
-- This table tracks the actual physical inventory in distinct batches.
CREATE TABLE stock_lots (
    lot_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL, -- Links to all_stocks
    quantity_in_lot INTEGER NOT NULL CHECK (quantity_in_lot >= 0), -- Quantity remaining in this specific batch
    cost_per_unit DECIMAL(10, 2) NOT NULL, -- Cost for items in THIS batch
    expiry_date DATE NOT NULL, -- Expiry date for items in THIS batch
    
    -- Audit fields
    entry_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_product_lot
        FOREIGN KEY (product_id) REFERENCES all_stocks (id)
        ON UPDATE CASCADE ON DELETE RESTRICT -- Don't delete a product if existing lots are tied to it
);

-- purchases Table (Records of Buying Stock)
-- Records historical purchase transactions.
CREATE TABLE purchases (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    lot_id INTEGER NOT NULL,
    quantity_purchased INTEGER NOT NULL,
    purchase_price_per_unit DECIMAL(10, 2) NOT NULL,
    purchase_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    supplier_id INTEGER,
    user_id INTEGER NOT NULL,

    CONSTRAINT fk_product_purchase
        FOREIGN KEY (product_id) REFERENCES all_stocks (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_lot_purchase
        FOREIGN KEY (lot_id) REFERENCES stock_lots (lot_id)
        ON UPDATE CASCADE ON DELETE RESTRICT, -- Prevent deleting a lot if it has purchase history

    CONSTRAINT fk_user_purchase
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_supplier_purchase
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- sales Table (Records of Selling Stock)
-- This table records each sale transaction.
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    sale_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    customer_name TEXT, -- Or link to a 'customers' table
    user_id INTEGER NOT NULL, -- User who recorded the sale

    CONSTRAINT fk_user_sale
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- sale_line_items Table (Details of Each Item in a Sale)
-- This links individual items from stock_lots to a sale transaction.
CREATE TABLE sale_line_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    lot_id INTEGER NOT NULL, -- **Crucial: Which specific lot this item came from**
    quantity_sold INTEGER NOT NULL CHECK (quantity_sold > 0),
    selling_price_per_unit DECIMAL(10, 2) NOT NULL,
    cost_at_sale DECIMAL(10, 2) NOT NULL, --individual cost at the time of sale

    CONSTRAINT fk_sale_header
        FOREIGN KEY (sale_id) REFERENCES sales (id)
        ON UPDATE CASCADE ON DELETE CASCADE, -- If sale is deleted, delete its line items

    CONSTRAINT fk_product_sold
        FOREIGN KEY (product_id) REFERENCES all_stocks (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,

    CONSTRAINT fk_lot_sold
        FOREIGN KEY (lot_id) REFERENCES stock_lots (lot_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);


-- stock_changes Table (Audit Log of All Stock Movements)
CREATE TABLE stock_changes (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    lot_id INTEGER, -- NULLABLE: some changes might not be lot-specific (e.g., initial setup, overall adjustments)
    change_type TEXT NOT NULL, -- e.g., 'purchase_in', 'sale_out', 'adjustment_in', 'adjustment_out', 'return_in', 'return_out', 'expiry_disposal'
    quantity_change INTEGER NOT NULL, -- Positive for increase, negative for decrease
    new_quantity_on_hand INTEGER,     -- Total quantity of THIS PRODUCT after the change (useful for quick reference)
    cost_impact DECIMAL(10, 2),       -- Financial impact of this change
    change_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,

    CONSTRAINT fk_product_change
        FOREIGN KEY (product_id) REFERENCES all_stocks (id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_lot_change
        FOREIGN KEY (lot_id) REFERENCES stock_lots (lot_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_user_change
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
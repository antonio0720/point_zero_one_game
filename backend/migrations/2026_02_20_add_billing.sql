-- Created by Point Zero One Digital on 2026-02-20

CREATE TABLE IF NOT EXISTS billing_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP')),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    billing_plan_id INT NOT NULL,
    customer_id INT NOT NULL,
    invoice_number VARCHAR(255) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'paid', 'overdue') NOT NULL DEFAULT 'pending',
    FOREIGN KEY (billing_plan_id) REFERENCES billing_plans(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS usage_counters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    product_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    usage DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS revshare_partners (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    partner_id INT NOT NULL,
    revenue_split DECIMAL(4, 2) NOT NULL CHECK (revenue_split BETWEEN 0.01 AND 1),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (partner_id) REFERENCES partners(id)
);

CREATE TABLE IF NOT EXISTS payout_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    revshare_partner_id INT NOT NULL,
    payment_method VARCHAR(255) NOT NULL,
    frequency ENUM('monthly', 'quarterly', 'yearly') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    FOREIGN KEY (revshare_partner_id) REFERENCES revshare_partners(id)
);

-- Invoice indexes
CREATE INDEX IF NOT EXISTS invoice_customer_id_idx ON invoices (customer_id);
CREATE INDEX IF NOT EXISTS invoice_invoice_number_idx ON invoices (invoice_number);

-- Usage Counters indexes
CREATE INDEX IF NOT EXISTS usage_counter_customer_id_idx ON usage_counters (customer_id);
CREATE INDEX IF NOT EXISTS usage_counter_product_id_idx ON usage_counters (product_id);

-- Revshare Partners indexes
CREATE INDEX IF NOT EXISTS revshare_partner_customer_id_idx ON revshare_partners (customer_id);
CREATE INDEX IF NOT EXISTS revshare_partner_partner_id_idx ON revshare_partners (partner_id);

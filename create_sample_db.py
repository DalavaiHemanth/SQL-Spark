"""
Create a sample SQLite database for SQL SPARK platform demo.
This creates a small e-commerce database with realistic data.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "sample_ecommerce.db")

def create_database():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # --- Schema ---
    c.executescript("""
        CREATE TABLE customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            city TEXT,
            country TEXT DEFAULT 'India',
            joined_date TEXT
        );

        CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER DEFAULT 0
        );

        CREATE TABLE orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            order_date TEXT NOT NULL,
            total_amount REAL,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        );

        CREATE TABLE order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );

        CREATE TABLE reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            rating INTEGER CHECK(rating BETWEEN 1 AND 5),
            comment TEXT,
            review_date TEXT,
            FOREIGN KEY (customer_id) REFERENCES customers(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        );
    """)

    # --- Sample Data ---
    customers = [
        ("Aarav Sharma", "aarav@email.com", "Mumbai", "India", "2024-01-15"),
        ("Priya Patel", "priya@email.com", "Delhi", "India", "2024-02-03"),
        ("Rohan Gupta", "rohan@email.com", "Bangalore", "India", "2024-02-20"),
        ("Sneha Reddy", "sneha@email.com", "Hyderabad", "India", "2024-03-10"),
        ("Vikram Singh", "vikram@email.com", "Pune", "India", "2024-03-25"),
        ("Ananya Das", "ananya@email.com", "Kolkata", "India", "2024-04-08"),
        ("Karthik Nair", "karthik@email.com", "Chennai", "India", "2024-04-22"),
        ("Meera Joshi", "meera@email.com", "Jaipur", "India", "2024-05-05"),
        ("Arjun Kumar", "arjun@email.com", "Lucknow", "India", "2024-05-18"),
        ("Divya Iyer", "divya@email.com", "Kochi", "India", "2024-06-01"),
        ("Rahul Verma", "rahul@email.com", "Mumbai", "India", "2024-06-15"),
        ("Neha Kapoor", "neha@email.com", "Delhi", "India", "2024-07-02"),
    ]
    c.executemany("INSERT INTO customers (name, email, city, country, joined_date) VALUES (?, ?, ?, ?, ?)", customers)

    products = [
        ("Wireless Earbuds", "Electronics", 1999.00, 150),
        ("USB-C Hub", "Electronics", 2499.00, 80),
        ("Mechanical Keyboard", "Electronics", 4999.00, 45),
        ("Laptop Stand", "Accessories", 1299.00, 120),
        ("Phone Case", "Accessories", 499.00, 300),
        ("Desk Lamp", "Home", 899.00, 90),
        ("Water Bottle", "Home", 399.00, 200),
        ("Notebook Set", "Stationery", 249.00, 500),
        ("Pen Pack", "Stationery", 149.00, 400),
        ("Backpack", "Accessories", 2199.00, 75),
        ("Mouse Pad", "Accessories", 599.00, 180),
        ("Webcam", "Electronics", 3499.00, 60),
    ]
    c.executemany("INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?)", products)

    orders = [
        (1, "2024-06-10", 4498.00, "delivered"),
        (2, "2024-06-12", 1999.00, "delivered"),
        (3, "2024-06-15", 7498.00, "delivered"),
        (1, "2024-07-01", 1299.00, "delivered"),
        (4, "2024-07-05", 2698.00, "shipped"),
        (5, "2024-07-10", 5498.00, "shipped"),
        (6, "2024-07-15", 399.00, "delivered"),
        (7, "2024-07-20", 2249.00, "delivered"),
        (2, "2024-08-01", 4999.00, "processing"),
        (8, "2024-08-05", 649.00, "pending"),
        (3, "2024-08-10", 3499.00, "pending"),
        (9, "2024-08-15", 1998.00, "processing"),
        (10, "2024-08-20", 2199.00, "shipped"),
        (11, "2024-08-25", 748.00, "delivered"),
        (12, "2024-09-01", 4999.00, "pending"),
    ]
    c.executemany("INSERT INTO orders (customer_id, order_date, total_amount, status) VALUES (?, ?, ?, ?)", orders)

    order_items = [
        (1, 1, 2, 1999.00),  # 2x Earbuds
        (1, 5, 1, 499.00),   # 1x Phone Case
        (2, 1, 1, 1999.00),  # 1x Earbuds
        (3, 3, 1, 4999.00),  # 1x Keyboard
        (3, 2, 1, 2499.00),  # 1x USB-C Hub
        (4, 4, 1, 1299.00),  # 1x Laptop Stand
        (5, 6, 2, 899.00),   # 2x Desk Lamp
        (5, 5, 2, 499.00),   # 2x Phone Case
        (6, 10, 1, 2199.00), # 1x Backpack
        (6, 11, 1, 599.00),  # 1x Mouse Pad
        (6, 9, 2, 149.00),   # 2x Pen Pack
        (7, 7, 1, 399.00),   # 1x Water Bottle
        (8, 8, 3, 249.00),   # 3x Notebook Set
        (8, 9, 2, 149.00),   # 2x Pen Pack
        (9, 3, 1, 4999.00),  # 1x Keyboard
        (10, 8, 1, 249.00),  # 1x Notebook Set
        (10, 7, 1, 399.00),  # 1x Water Bottle
        (11, 12, 1, 3499.00),# 1x Webcam
        (12, 1, 1, 1999.00), # 1x Earbuds
        (12, 11, 1, 599.00), # 1x Mouse Pad
        (13, 10, 1, 2199.00),# 1x Backpack
        (14, 8, 1, 249.00),  # 1x Notebook Set
        (14, 5, 1, 499.00),  # 1x Phone Case
        (15, 3, 1, 4999.00), # 1x Keyboard
    ]
    c.executemany("INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)", order_items)

    reviews = [
        (1, 1, 5, "Amazing sound quality!", "2024-06-20"),
        (2, 1, 4, "Good earbuds, decent battery life", "2024-06-25"),
        (3, 3, 5, "Best keyboard I have ever used", "2024-06-30"),
        (1, 5, 3, "Average phone case, okay quality", "2024-07-05"),
        (4, 6, 4, "Nice lamp, good brightness", "2024-07-15"),
        (5, 10, 5, "Very spacious backpack!", "2024-07-20"),
        (6, 7, 4, "Keeps water cold for hours", "2024-07-25"),
        (7, 8, 5, "Smooth paper, love it", "2024-08-01"),
        (3, 2, 4, "Works well with my laptop", "2024-08-05"),
        (8, 8, 3, "Paper could be thicker", "2024-08-10"),
        (9, 1, 4, "Good sound, comfortable fit", "2024-08-20"),
        (10, 7, 5, "Excellent bottle, no leaks", "2024-08-25"),
        (11, 12, 4, "Clear video quality", "2024-09-01"),
        (12, 3, 5, "Typing feels amazing", "2024-09-05"),
    ]
    c.executemany("INSERT INTO reviews (customer_id, product_id, rating, comment, review_date) VALUES (?, ?, ?, ?, ?)", reviews)

    conn.commit()
    conn.close()
    print(f"✅ Sample database created: {DB_PATH}")
    print(f"   Tables: customers(12), products(12), orders(15), order_items(24), reviews(14)")

if __name__ == "__main__":
    create_database()

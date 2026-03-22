import sqlite3
conn = sqlite3.connect(r'C:\Users\heman\Downloads\database.sqlite')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("=== TABLES ===")
for t in tables:
    name = t[0]
    if name == 'sqlite_sequence':
        continue
    cursor.execute(f'PRAGMA table_info("{name}")')
    cols = cursor.fetchall()
    col_names = [c[1] for c in cols]
    cursor.execute(f'SELECT COUNT(*) FROM "{name}"')
    count = cursor.fetchone()[0]
    print(f"\n{name} ({count} rows): {col_names}")
conn.close()

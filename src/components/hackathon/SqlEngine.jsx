import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useSqlJs } from '@/hooks/useSqlJs';
import { fetchDbFile } from '@/utils/fetchDbFile';

const SqlEngine = forwardRef(({ schema, sampleData, dbFileUrl, onReady }, ref) => {
    const [db, setDb] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { SQL, isLoading: isLoadingSql } = useSqlJs();

    useEffect(() => {
        if (!SQL) return;

        const initDb = async () => {
            try {
                setIsLoading(true);
                setError(null);

                let database;

                // 1. Load from binary file URL if provided
                if (dbFileUrl) {
                    try {
                        const buffer = await fetchDbFile(dbFileUrl);
                        database = new SQL.Database(new Uint8Array(buffer));
                    } catch (e) {
                        console.error('Failed to load database file:', e);
                        setError(`Failed to load database file: ${e.message}`);
                        setIsLoading(false);
                        return;
                    }
                }
                // 2. Or create new DB and run schema/data
                else {
                    database = new SQL.Database();

                    if (schema) {
                        try {
                            database.run(schema);
                        } catch (e) {
                            console.error('Schema error:', e);
                            setError(`Schema error: ${e.message}`);
                        }
                    }

                    if (sampleData) {
                        try {
                            database.run(sampleData);
                        } catch (e) {
                            console.error('Sample data error:', e);
                            setError(`Data error: ${e.message}`);
                        }
                    }
                }

                setDb(database);
                setIsLoading(false);
                onReady?.();
            } catch (e) {
                console.error('Failed to initialize SQL.js:', e);
                setError(`Failed to initialize database: ${e.message}`);
                setIsLoading(false);
            }
        };

        if (!isLoadingSql) {
            initDb();
        }

        return () => {
            // We can't easily close/nullify here without causing issues on re-renders, 
            // but we should if the component unmounts. 
            // Ideally we'd keep track if it's the same DB request.
        };
    }, [schema, sampleData, dbFileUrl, SQL, isLoadingSql]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        executeQuery: (query) => {
            if (!db) {
                return { success: false, error: 'Database not initialized' };
            }

            try {
                const startTime = performance.now();
                const results = db.exec(query);
                const executionTime = performance.now() - startTime;

                if (results.length === 0) {
                    // Query executed but returned no results (like INSERT/UPDATE)
                    return {
                        success: true,
                        data: [],
                        columns: [],
                        rowCount: 0,
                        executionTime: Math.round(executionTime)
                    };
                }

                const result = results[0];
                return {
                    success: true,
                    data: result.values.map(row => {
                        const obj = {};
                        result.columns.forEach((col, i) => {
                            obj[col] = row[i];
                        });
                        return obj;
                    }),
                    columns: result.columns,
                    rowCount: result.values.length,
                    executionTime: Math.round(executionTime)
                };
            } catch (e) {
                return {
                    success: false,
                    error: e.message,
                    executionTime: 0
                };
            }
        },

        resetDatabase: () => {
            if (db && schema && SQL) {
                try {
                    db.close();
                    const newDb = new SQL.Database();
                    if (schema) newDb.run(schema);
                    if (sampleData) newDb.run(sampleData);
                    setDb(newDb);
                } catch (e) {
                    setError(`Reset error: ${e.message}`);
                }
            }
        },

        isReady: () => db !== null && !isLoading
    }));

    return null;
});

SqlEngine.displayName = 'SqlEngine';

export default SqlEngine;
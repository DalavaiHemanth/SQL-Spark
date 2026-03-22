import { useState, useEffect } from 'react';

/**
 * Hook to load and initialize sql.js
 * Ensures the WASM binary is loaded from the correct CDN location
 * @returns {Object} { SQL, isLoading, error }
 */
export const useSqlJs = () => {
    const [SQL, setSQL] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadSqlJs = async () => {
            try {
                // If already loaded globally, use it
                if (window.initSqlJs) {
                    const sql = await window.initSqlJs({
                        locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm`
                    });
                    setSQL(sql);
                    setIsLoading(false);
                    return;
                }

                // Inject script if not present
                let script = document.querySelector('script[src*="sql-wasm.js"]');
                if (!script) {
                    await new Promise((resolve, reject) => {
                        script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
                        script.onload = resolve;
                        script.onerror = () => reject(new Error('Failed to load sql.js script'));
                        document.head.appendChild(script);
                    });
                } else if (!window.initSqlJs) {
                    // Script tag exists but hasn't finished loading yet (race condition fix)
                    await new Promise((resolve) => {
                        const checkInterval = setInterval(() => {
                            if (window.initSqlJs) {
                                clearInterval(checkInterval);
                                resolve();
                            }
                        }, 50);
                    });
                }

                // Initialize
                const sql = await window.initSqlJs({
                    locateFile: () => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm`
                });
                setSQL(sql);
            } catch (err) {
                console.error('Failed to load sql.js:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadSqlJs();
    }, []);

    return { SQL, isLoading, error };
};

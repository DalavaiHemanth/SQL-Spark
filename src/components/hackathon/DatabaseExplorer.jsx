import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Database,
    Table as TableIcon,
    Columns3,
    ChevronDown,
    ChevronRight,
    Loader2,
    Hash,
    Type,
    Key,
    ToggleLeft,
    Search,
    ArrowUpDown,
    RefreshCw
} from 'lucide-react';
import { Input } from "@/components/ui/input";

/**
 * DatabaseExplorer — lets team members browse all tables, columns, and data
 * in their assigned database. Uses the shared sqlEngineRef from TeamDashboard.
 */
export default function DatabaseExplorer({ sqlEngineRef, dbReady }) {
    const [tables, setTables] = useState([]);
    const [activeTable, setActiveTable] = useState(null);
    const [tableData, setTableData] = useState(null);
    const [isLoadingTables, setIsLoadingTables] = useState(true);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');
    const [sortCol, setSortCol] = useState(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [showColumnPanel, setShowColumnPanel] = useState(true);
    const retryCountRef = useRef(0);

    // Try to run a query — returns result or null
    const tryQuery = useCallback((query) => {
        try {
            const engine = sqlEngineRef?.current;
            if (!engine) return null;
            const result = engine.executeQuery(query);
            // If DB not initialized yet, treat as null
            if (!result.success && result.error === 'Database not initialized') return null;
            return result;
        } catch {
            return null;
        }
    }, [sqlEngineRef]);

    // Load all tables with polling/retry until they appear
    const loadTables = useCallback(() => {
        const tablesResult = tryQuery(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        );

        // If query failed (engine not ready), retry
        if (!tablesResult) return false;

        if (!tablesResult.success || tablesResult.rowCount === 0) {
            // Query ran but no tables — DB might be empty or still loading
            return false;
        }

        const tableNames = tablesResult.data.map(r => r.name);
        const tablesWithCols = tableNames.map(tableName => {
            const pragmaResult = tryQuery(`PRAGMA table_info("${tableName}")`);
            let columns = [];
            if (pragmaResult?.success && pragmaResult.data.length > 0) {
                columns = pragmaResult.data.map(col => ({
                    name: col.name,
                    type: col.type || 'TEXT',
                    pk: col.pk === 1,
                    notnull: col.notnull === 1,
                    defaultValue: col.dflt_value
                }));
            }

            const countResult = tryQuery(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
            const rowCount = countResult?.success && countResult.data.length > 0
                ? countResult.data[0].cnt : 0;

            return { name: tableName, columns, rowCount };
        });

        setTables(tablesWithCols);
        setIsLoadingTables(false);

        // Auto-select first table
        if (tablesWithCols.length > 0) {
            setActiveTable(tablesWithCols[0].name);
        }

        return true; // success
    }, [tryQuery]);

    // Load data for a specific table
    const loadDataForTable = useCallback((tableName) => {
        if (!tableName) return;

        setIsLoadingData(true);
        setSearchFilter('');
        setSortCol(null);
        setSortAsc(true);

        const result = tryQuery(`SELECT * FROM "${tableName}" LIMIT 500`);

        if (result?.success) {
            setTableData({
                columns: result.columns,
                data: result.data,
                rowCount: result.rowCount
            });
        } else {
            setTableData({
                columns: [],
                data: [],
                rowCount: 0,
                error: result?.error || 'Could not load data — try clicking Refresh'
            });
        }
        setIsLoadingData(false);
    }, [tryQuery]);

    // Poll for tables once dbReady — retries every 500ms up to 20 times (10s)
    useEffect(() => {
        if (!dbReady) {
            setIsLoadingTables(true);
            return;
        }

        retryCountRef.current = 0;

        const interval = setInterval(() => {
            retryCountRef.current += 1;
            const success = loadTables();
            if (success || retryCountRef.current >= 20) {
                clearInterval(interval);
                if (!success) setIsLoadingTables(false); // give up, show empty
            }
        }, 500);

        return () => clearInterval(interval);
    }, [dbReady, loadTables]);

    // Load data whenever activeTable changes
    useEffect(() => {
        if (activeTable && dbReady) {
            // Small delay to let React settle
            const timer = setTimeout(() => loadDataForTable(activeTable), 50);
            return () => clearTimeout(timer);
        }
    }, [activeTable, dbReady, loadDataForTable]);

    const handleSelectTable = (tableName) => {
        if (tableName === activeTable) return;
        setActiveTable(tableName);
    };

    const handleRefresh = () => {
        setIsLoadingTables(true);
        retryCountRef.current = 0;
        setTimeout(() => {
            const success = loadTables();
            if (!success) setIsLoadingTables(false);
            if (activeTable) loadDataForTable(activeTable);
        }, 300);
    };

    // Filter & sort
    const getFilteredData = () => {
        if (!tableData?.data) return [];
        let data = tableData.data;

        if (searchFilter.trim()) {
            const term = searchFilter.toLowerCase();
            data = data.filter(row =>
                Object.values(row).some(val =>
                    String(val ?? '').toLowerCase().includes(term)
                )
            );
        }

        if (sortCol) {
            data = [...data].sort((a, b) => {
                const aVal = a[sortCol];
                const bVal = b[sortCol];
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return sortAsc ? -1 : 1;
                if (bVal == null) return sortAsc ? 1 : -1;
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortAsc ? aVal - bVal : bVal - aVal;
                }
                return sortAsc
                    ? String(aVal).localeCompare(String(bVal))
                    : String(bVal).localeCompare(String(aVal));
            });
        }
        return data;
    };

    const handleSort = (colName) => {
        if (sortCol === colName) setSortAsc(!sortAsc);
        else { setSortCol(colName); setSortAsc(true); }
    };

    const getTypeIcon = (type) => {
        const t = (type || '').toUpperCase();
        if (['INTEGER', 'INT', 'REAL', 'FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC'].some(n => t.includes(n)))
            return <Hash className="w-3 h-3 text-blue-500" />;
        return <Type className="w-3 h-3 text-emerald-500" />;
    };

    // --- Render ---

    if (!dbReady || isLoadingTables) {
        return (
            <Card className="border-0 shadow-sm">
                <CardContent className="p-6 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">
                        {!dbReady ? 'Waiting for database to load...' : 'Loading tables...'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (tables.length === 0) {
        return (
            <Card className="border-0 shadow-sm">
                <CardContent className="p-6 text-center">
                    <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 mb-3">No tables found in database</p>
                    <Button variant="outline" size="sm" onClick={handleRefresh}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const filteredData = getFilteredData();
    const activeTableInfo = tables.find(t => t.name === activeTable);

    return (
        <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Database className="w-5 h-5 text-violet-500" />
                        Database Explorer
                        <Badge variant="outline" className="ml-2 text-xs">
                            {tables.length} table{tables.length !== 1 ? 's' : ''}
                        </Badge>
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh data">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {/* Table tabs */}
                <div className="flex gap-1 overflow-x-auto pb-3 border-b border-slate-100 mb-4">
                    {tables.map(table => (
                        <button
                            key={table.name}
                            onClick={() => handleSelectTable(table.name)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${activeTable === table.name
                                    ? 'bg-violet-100 text-violet-700 font-medium shadow-sm'
                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                                }`}
                        >
                            <TableIcon className="w-3.5 h-3.5" />
                            {table.name}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {table.rowCount}
                            </Badge>
                        </button>
                    ))}
                </div>

                {activeTableInfo && (
                    <div className="space-y-3">
                        {/* Column info toggle */}
                        <button
                            onClick={() => setShowColumnPanel(!showColumnPanel)}
                            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            {showColumnPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            <Columns3 className="w-4 h-4" />
                            Columns ({activeTableInfo.columns.length})
                        </button>

                        {showColumnPanel && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {activeTableInfo.columns.map(col => (
                                    <div key={col.name} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                                        {col.pk ? <Key className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> : getTypeIcon(col.type)}
                                        <span className="font-medium text-slate-700 truncate">{col.name}</span>
                                        <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{col.type}</span>
                                        {col.notnull && <ToggleLeft className="w-3 h-3 text-red-400 flex-shrink-0" title="NOT NULL" />}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Search bar */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    value={searchFilter}
                                    onChange={(e) => setSearchFilter(e.target.value)}
                                    placeholder="Search rows..."
                                    className="pl-9 h-9"
                                />
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                                {searchFilter ? `${filteredData.length} of ` : ''}{tableData?.rowCount ?? 0} rows
                                {(tableData?.rowCount ?? 0) >= 500 && ' (limited to 500)'}
                            </span>
                        </div>

                        {/* Data table */}
                        {isLoadingData ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-emerald-500 mr-2" />
                                <span className="text-sm text-slate-500">Loading data...</span>
                            </div>
                        ) : tableData?.error ? (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 flex items-center justify-between">
                                <span>{tableData.error}</span>
                                <Button variant="outline" size="sm" onClick={() => loadDataForTable(activeTable)}>
                                    <RefreshCw className="w-3 h-3 mr-1" /> Retry
                                </Button>
                            </div>
                        ) : tableData && tableData.columns.length > 0 ? (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 w-10">#</th>
                                                {tableData.columns.map(col => (
                                                    <th
                                                        key={col}
                                                        className="px-3 py-2 text-left text-xs font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 select-none"
                                                        onClick={() => handleSort(col)}
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            {col}
                                                            <ArrowUpDown className={`w-3 h-3 ${sortCol === col ? 'text-violet-500' : 'text-slate-300'}`} />
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={tableData.columns.length + 1} className="px-3 py-6 text-center text-slate-400">
                                                        {searchFilter ? 'No matching rows' : 'Table is empty'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredData.map((row, i) => (
                                                    <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-3 py-2 text-xs text-slate-400 font-mono">{i + 1}</td>
                                                        {tableData.columns.map(col => {
                                                            const val = row[col];
                                                            const isNull = val === null || val === undefined;
                                                            return (
                                                                <td
                                                                    key={col}
                                                                    className={`px-3 py-2 max-w-[250px] truncate ${isNull ? 'text-slate-300 italic'
                                                                            : typeof val === 'number' ? 'font-mono text-blue-700'
                                                                                : 'text-slate-700'
                                                                        }`}
                                                                    title={isNull ? 'NULL' : String(val)}
                                                                >
                                                                    {isNull ? 'NULL' : String(val)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-slate-400 text-sm mb-3">No data to display</p>
                                <Button variant="outline" size="sm" onClick={() => loadDataForTable(activeTable)}>
                                    <RefreshCw className="w-4 h-4 mr-2" /> Load Data
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

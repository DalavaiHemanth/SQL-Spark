import React, { useState, useEffect, useCallback } from 'react';
import { fetchDbFile } from '@/utils/fetchDbFile';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Database,
    Loader2,
    RefreshCw,
    Table as TableIcon,
    AlertTriangle,
    Search,
    ArrowUpDown,
    Key,
    Hash,
    Type,
    ChevronRight
} from 'lucide-react';
import { useSqlJs } from '@/hooks/useSqlJs';

export default function AdminDbPreview({ schema, sampleData, dbFileUrl }) {
    const [db, setDb] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [tables, setTables] = useState([]);       // [{ name, rowCount, columns }]
    const [activeTable, setActiveTable] = useState(null);
    const [tableData, setTableData] = useState(null); // { columns, rows }
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [search, setSearch] = useState('');
    const [sortCol, setSortCol] = useState(null);
    const [sortAsc, setSortAsc] = useState(true);

    const hasSource = !!(schema || dbFileUrl);
    const { SQL, isLoading: isLoadingSql } = useSqlJs();

    // ------ DB init ------
    const initDb = useCallback(async () => {
        if (!SQL) return;
        setIsLoading(true);
        setError(null);
        setTables([]);
        setActiveTable(null);
        setTableData(null);

        try {
            let database;
            if (dbFileUrl) {
                const buffer = await fetchDbFile(dbFileUrl);
                database = new SQL.Database(new Uint8Array(buffer));
            } else if (schema) {
                database = new SQL.Database();
                database.run(schema);
                if (sampleData) database.run(sampleData);
            }

            if (database) {
                const tableRes = database.exec(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                );
                const tableNames = tableRes.length > 0 ? tableRes[0].values.map(r => r[0]) : [];

                const enriched = tableNames.map(name => {
                    const colRes = database.exec(`PRAGMA table_info("${name}")`);
                    const columns = colRes.length > 0 ? colRes[0].values.map(r => ({
                        name: r[1], type: r[2] || 'TEXT', pk: r[5] === 1, notnull: r[3] === 1
                    })) : [];
                    const cntRes = database.exec(`SELECT COUNT(*) FROM "${name}"`);
                    const rowCount = cntRes.length > 0 ? cntRes[0].values[0][0] : 0;
                    return { name, columns, rowCount };
                });

                setTables(enriched);
                setDb(database);
                if (enriched.length > 0) setActiveTable(enriched[0].name);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [SQL, schema, sampleData, dbFileUrl]);

    // ------ Load table data ------
    const loadTable = useCallback((tableName, database) => {
        const d = database || db;
        if (!d || !tableName) return;
        setIsLoadingData(true);
        setSearch('');
        setSortCol(null);
        setSortAsc(true);
        try {
            const res = d.exec(`SELECT * FROM "${tableName}" LIMIT 500`);
            if (res.length > 0) {
                const cols = res[0].columns;
                const rows = res[0].values.map(r => {
                    const obj = {};
                    cols.forEach((c, i) => { obj[c] = r[i]; });
                    return obj;
                });
                setTableData({ columns: cols, rows });
            } else {
                setTableData({ columns: [], rows: [] });
            }
        } catch (e) {
            setTableData({ columns: [], rows: [], error: e.message });
        } finally {
            setIsLoadingData(false);
        }
    }, [db]);

    useEffect(() => {
        if (hasSource && SQL && !isLoadingSql) initDb();
        return () => { if (db) { try { db.close(); } catch { /* ignore */ } } };
    }, [schema, sampleData, dbFileUrl, SQL]);

    useEffect(() => {
        if (activeTable && db) loadTable(activeTable);
    }, [activeTable, db]);

    // Filter + sort
    const displayRows = (() => {
        if (!tableData?.rows) return [];
        let rows = tableData.rows;
        if (search.trim()) {
            const term = search.toLowerCase();
            rows = rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(term)));
        }
        if (sortCol) {
            rows = [...rows].sort((a, b) => {
                const av = a[sortCol], bv = b[sortCol];
                if (av == null && bv == null) return 0;
                if (av == null) return sortAsc ? -1 : 1;
                if (bv == null) return sortAsc ? 1 : -1;
                if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
                return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
            });
        }
        return rows;
    })();

    const getTypeIcon = (type) => {
        const t = (type || '').toUpperCase();
        if (['INTEGER', 'INT', 'REAL', 'FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC'].some(n => t.includes(n)))
            return <Hash className="w-3 h-3 text-blue-400" />;
        return <Type className="w-3 h-3 text-emerald-400" />;
    };

    if (!hasSource) return null;

    return (
        <Card className="border-0 shadow-lg bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Database className="w-5 h-5 text-blue-400" />
                        Database Browser
                        {db && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ml-2 text-xs">
                                {tables.length} table{tables.length !== 1 ? 's' : ''}
                            </Badge>
                        )}
                    </CardTitle>
                    <Button
                        variant="ghost" size="icon"
                        onClick={initDb}
                        title="Reload database"
                        className="text-slate-400 hover:text-white"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
                <p className="text-sm text-slate-500">Click a table to browse its data</p>
            </CardHeader>

            <CardContent className="p-0">
                {(isLoading || isLoadingSql) ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mr-2" />
                        <span className="text-slate-400 text-sm">Loading database...</span>
                    </div>
                ) : error ? (
                    <div className="m-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-medium text-red-400">Failed to load database</p>
                                <p className="text-sm text-red-300/80 font-mono mt-1">{error}</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" className="mt-3 border-red-500/30 text-red-400" onClick={initDb}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Retry
                        </Button>
                    </div>
                ) : db ? (
                    <div className="flex h-[500px]">
                        {/* Sidebar — table list */}
                        <div className="w-52 flex-shrink-0 border-r border-slate-800 overflow-y-auto py-2">
                            {tables.length === 0 ? (
                                <p className="text-xs text-slate-500 px-4 py-3">No tables found</p>
                            ) : tables.map(t => (
                                <button
                                    key={t.name}
                                    onClick={() => setActiveTable(t.name)}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors group"
                                    style={{
                                        background: activeTable === t.name ? 'rgba(16,185,129,0.1)' : 'transparent',
                                        borderRight: activeTable === t.name ? '2px solid #10b981' : '2px solid transparent'
                                    }}
                                >
                                    <TableIcon className={`w-3.5 h-3.5 flex-shrink-0 ${activeTable === t.name ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                                    <span className={`text-sm truncate flex-1 ${activeTable === t.name ? 'text-emerald-300 font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
                                        {t.name}
                                    </span>
                                    <span className="text-[10px] text-slate-600 ml-auto flex-shrink-0">{t.rowCount}</span>
                                </button>
                            ))}
                        </div>

                        {/* Main content — data grid */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {activeTable ? (
                                <>
                                    {/* Table header bar */}
                                    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900/80">
                                        <div className="flex items-center gap-1.5">
                                            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                                            <span className="text-sm font-semibold text-slate-200">{activeTable}</span>
                                        </div>
                                        {/* Column chips */}
                                        <div className="flex gap-1.5 overflow-x-auto flex-1">
                                            {tables.find(t => t.name === activeTable)?.columns.map(col => (
                                                <span key={col.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-400 whitespace-nowrap flex-shrink-0">
                                                    {col.pk ? <Key className="w-2.5 h-2.5 text-amber-400" /> : getTypeIcon(col.type)}
                                                    {col.name}
                                                </span>
                                            ))}
                                        </div>
                                        {/* Search */}
                                        <div className="relative flex-shrink-0 w-44">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                            <Input
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                placeholder="Search rows..."
                                                className="pl-8 h-8 text-xs bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-emerald-500"
                                            />
                                        </div>
                                        <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">
                                            {search ? `${displayRows.length} / ` : ''}{tableData?.rows?.length ?? 0} rows
                                        </span>
                                    </div>

                                    {/* Data grid */}
                                    {isLoadingData ? (
                                        <div className="flex items-center justify-center flex-1">
                                            <Loader2 className="w-5 h-5 animate-spin text-emerald-500 mr-2" />
                                            <span className="text-sm text-slate-500">Loading...</span>
                                        </div>
                                    ) : tableData?.error ? (
                                        <div className="m-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                                            {tableData.error}
                                        </div>
                                    ) : (tableData?.columns?.length ?? 0) === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                                            Table is empty
                                        </div>
                                    ) : (
                                        <div className="flex-1 overflow-auto">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="sticky top-0 z-10">
                                                    <tr style={{ background: '#0f172a' }}>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-600 w-10 border-b border-slate-800">#</th>
                                                        {tableData.columns.map(col => (
                                                            <th
                                                                key={col}
                                                                className="px-3 py-2 text-left text-xs font-semibold text-slate-400 cursor-pointer select-none border-b border-slate-800 hover:text-slate-200 whitespace-nowrap"
                                                                onClick={() => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } }}
                                                            >
                                                                <div className="flex items-center gap-1">
                                                                    {col}
                                                                    <ArrowUpDown className={`w-3 h-3 ${sortCol === col ? 'text-emerald-400' : 'text-slate-700'}`} />
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {displayRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={tableData.columns.length + 1} className="px-3 py-8 text-center text-slate-500">
                                                                {search ? 'No matching rows' : 'Empty table'}
                                                            </td>
                                                        </tr>
                                                    ) : displayRows.map((row, i) => (
                                                        <tr key={i} className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                                                            <td className="px-3 py-2 text-xs text-slate-600 font-mono">{i + 1}</td>
                                                            {tableData.columns.map(col => {
                                                                const val = row[col];
                                                                const isNull = val === null || val === undefined;
                                                                return (
                                                                    <td
                                                                        key={col}
                                                                        className={`px-3 py-2 max-w-[240px] truncate text-xs ${isNull ? 'text-slate-600 italic' : typeof val === 'number' ? 'font-mono text-blue-400' : 'text-slate-300'}`}
                                                                        title={isNull ? 'NULL' : String(val)}
                                                                    >
                                                                        {isNull ? 'NULL' : String(val)}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                                    Select a table from the left
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-500">
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Save your schema first to preview</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

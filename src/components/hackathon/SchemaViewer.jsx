import React, { useState, useEffect } from 'react';
import { fetchDbFile } from '@/utils/fetchDbFile';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Database,
    Table as TableIcon,
    ChevronDown,
    ChevronRight,
    Key,
    Hash,
    Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { useSqlJs } from '@/hooks/useSqlJs';

export default function SchemaViewer({ schema, dbFileUrl }) {
    const [expandedTables, setExpandedTables] = useState(new Set());
    const [extractedTables, setExtractedTables] = useState(null);
    const [isLoadingDb, setIsLoadingDb] = useState(false);

    // Parse schema from SQL text to extract table info
    const parseSchema = (sql) => {
        if (!sql) return [];

        const tables = [];
        const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;

        let match;
        while ((match = tableRegex.exec(sql)) !== null) {
            const tableName = match[1];
            const columnsStr = match[2];

            const columns = [];
            const lines = columnsStr.split(',').map(l => l.trim()).filter(l => l);

            for (const line of lines) {
                if (/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(line)) continue;

                const colMatch = line.match(/^(\w+)\s+(\w+(?:\([^)]+\))?)/i);
                if (colMatch) {
                    columns.push({
                        name: colMatch[1],
                        type: colMatch[2].toUpperCase(),
                        isPrimary: /PRIMARY\s+KEY/i.test(line),
                        isNotNull: /NOT\s+NULL/i.test(line)
                    });
                }
            }

            tables.push({ name: tableName, columns });
        }

        return tables;
    };

    const { SQL, isLoading: isLoadingSql } = useSqlJs();

    useEffect(() => {
        if (schema || !dbFileUrl || !SQL) {
            setExtractedTables(null);
            return;
        }

        let cancelled = false;
        const loadSchema = async () => {
            setIsLoadingDb(true);
            try {
                const buffer = await fetchDbFile(dbFileUrl);
                const db = new SQL.Database(new Uint8Array(buffer));

                // Get all user tables
                const result = db.exec(
                    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                );

                if (!cancelled && result.length > 0) {
                    const tables = [];
                    for (const row of result[0].values) {
                        const tableName = row[0];
                        const createSql = row[1];

                        // Parse columns from the CREATE TABLE statement
                        const parsed = parseSchema(createSql + ';');
                        if (parsed.length > 0) {
                            tables.push(parsed[0]);
                        } else {
                            // Fallback: use PRAGMA to get column info
                            try {
                                const pragmaResult = db.exec(`PRAGMA table_info("${tableName}")`);
                                if (pragmaResult.length > 0) {
                                    const columns = pragmaResult[0].values.map(col => ({
                                        name: col[1],
                                        type: (col[2] || 'TEXT').toUpperCase(),
                                        isPrimary: col[5] === 1,
                                        isNotNull: col[3] === 1
                                    }));
                                    tables.push({ name: tableName, columns });
                                }
                            } catch (e) {
                                tables.push({ name: tableName, columns: [] });
                            }
                        }
                    }
                    setExtractedTables(tables);
                }
                db.close();
            } catch (e) {
                console.error('SchemaViewer: Failed to load DB file schema:', e);
                if (!cancelled) setExtractedTables([]);
            } finally {
                if (!cancelled) setIsLoadingDb(false);
            }
        };

        loadSchema();
        return () => { cancelled = true; };
    }, [dbFileUrl, schema, SQL]);

    // Use parsed SQL text schema, or fallback to extracted DB schema
    const tables = schema ? parseSchema(schema) : (extractedTables || []);

    const toggleTable = (tableName) => {
        const newExpanded = new Set(expandedTables);
        if (newExpanded.has(tableName)) {
            newExpanded.delete(tableName);
        } else {
            newExpanded.add(tableName);
        }
        setExpandedTables(newExpanded);
    };

    if (isLoadingDb) {
        return (
            <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-emerald-500" />
                    <p className="text-sm">Loading database schema...</p>
                </CardContent>
            </Card>
        );
    }

    if (tables.length === 0) {
        return (
            <Card className="border-0 shadow-sm">
                <CardContent className="p-4 text-center text-slate-500">
                    <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No schema available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-500" />
                    Database Schema
                    {!schema && dbFileUrl && (
                        <Badge variant="outline" className="text-xs ml-auto">
                            from file
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                {tables.map((table) => (
                    <div key={table.name} className="border border-slate-100 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleTable(table.name)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                        >
                            {expandedTables.has(table.name) ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <TableIcon className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-slate-700">{table.name}</span>
                            <Badge variant="outline" className="ml-auto text-xs">
                                {table.columns.length} cols
                            </Badge>
                        </button>

                        {expandedTables.has(table.name) && (
                            <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2">
                                <div className="space-y-1">
                                    {table.columns.map((col, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm py-1">
                                            {col.isPrimary ? (
                                                <Key className="w-3 h-3 text-amber-500" />
                                            ) : (
                                                <Hash className="w-3 h-3 text-slate-300" />
                                            )}
                                            <span className={cn(
                                                "font-mono",
                                                col.isPrimary ? "text-amber-700 font-medium" : "text-slate-600"
                                            )}>
                                                {col.name}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-auto">
                                                {col.type}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
import React from 'react';
import { Card } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

export default function QueryResultsTable({ result, expectedOutput, orderSensitive = false }) {
    if (!result) return null;

    // Parse expected output for comparison
    let expected = null;
    try {
        if (expectedOutput) {
            expected = JSON.parse(expectedOutput);
        }
    } catch (e) {
        // Invalid JSON in expected output
    }

    // Check if results match expected
    const checkMatch = () => {
        if (!expected || !result.success || !result.data) return null;
        if (!Array.isArray(expected)) return null;
        if (expected.length !== result.data.length) return false;

        const rowValues = (row) => Object.values(row).map(v => String(v ?? ''));
        const sortKey = (row) => rowValues(row).join('|');

        if (orderSensitive) {
            return expected.every((expRow, i) => {
                const expVals = rowValues(expRow);
                const actVals = rowValues(result.data[i]);
                return expVals.length === actVals.length &&
                    expVals.every((v, j) => v === actVals[j]);
            });
        } else {
            const sortedExp = [...expected].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
            const sortedAct = [...result.data].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
            return sortedExp.every((expRow, i) => {
                const expVals = rowValues(expRow);
                const actVals = rowValues(sortedAct[i]);
                return expVals.length === actVals.length &&
                    expVals.every((v, j) => v === actVals[j]);
            });
        }
    };

    const isMatch = checkMatch();

    return (
        <Card className="border-0 shadow-md overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {result.success ? (
                        isMatch === true ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : isMatch === false ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                        ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        )
                    ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className="font-medium">
                        {result.success
                            ? isMatch === true
                                ? 'Correct Output!'
                                : isMatch === false
                                    ? 'Output Mismatch'
                                    : 'Query Executed'
                            : 'Query Error'
                        }
                    </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                    {result.success && (
                        <>
                            <span>{result.rowCount} row{result.rowCount !== 1 ? 's' : ''}</span>
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {result.executionTime}ms
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-auto">
                {result.success ? (
                    result.data.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50">
                                    {result.columns.map((col, i) => (
                                        <TableHead key={i} className="font-semibold text-slate-700">
                                            {col}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result.data.slice(0, 100).map((row, i) => (
                                    <TableRow key={i}>
                                        {result.columns.map((col, j) => (
                                            <TableCell key={j} className="font-mono text-sm">
                                                {row[col] === null ? (
                                                    <span className="text-slate-400 italic">NULL</span>
                                                ) : (
                                                    String(row[col])
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="p-8 text-center text-slate-500">
                            Query executed successfully. No rows returned.
                        </div>
                    )
                ) : (
                    <div className="p-4 bg-red-50">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                            <div>
                                <p className="font-medium text-red-700">SQL Error</p>
                                <p className="text-sm text-red-600 font-mono mt-1">{result.error}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Match indicator */}
            {isMatch !== null && (
                <div className={`px-4 py-2 text-sm ${isMatch ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {isMatch
                        ? '✓ Output matches expected result!'
                        : '✗ Output does not match expected result. Check your query.'
                    }
                </div>
            )}
        </Card>
    );
}
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Wand2,
    Save,
    Loader2,
    ChevronDown,
    ChevronUp,
    Trash2,
    Star,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { generationLimiter } from '@/lib/rateLimit';

// Template-based question generators by difficulty
const QUESTION_TEMPLATES = {
    easy: [
        {
            template: (table) => ({
                title: `Select All from ${table.name}`,
                description: `Write a query to select all columns and all rows from the "${table.name}" table.`,
                solution_query: `SELECT * FROM ${table.name};`,
                hint: `Use SELECT * to get all columns`,
                points: 10,
                difficulty: 'easy'
            })
        },
        {
            template: (table, col) => ({
                title: `Count ${table.name} Records`,
                description: `Write a query to count the total number of records in the "${table.name}" table.`,
                solution_query: `SELECT COUNT(*) AS total FROM ${table.name};`,
                hint: `Use the COUNT(*) aggregate function`,
                points: 10,
                difficulty: 'easy'
            })
        },
        {
            template: (table, col) => col ? ({
                title: `Select Specific Columns from ${table.name}`,
                description: `Write a query to select only the "${col.name}" column from the "${table.name}" table.`,
                solution_query: `SELECT ${col.name} FROM ${table.name};`,
                hint: `Specify the column name instead of using *`,
                points: 10,
                difficulty: 'easy'
            }) : null
        },
        {
            template: (table, col) => col ? ({
                title: `Distinct ${col.name} Values`,
                description: `Write a query to find all distinct values of "${col.name}" in the "${table.name}" table.`,
                solution_query: `SELECT DISTINCT ${col.name} FROM ${table.name};`,
                hint: `Use the DISTINCT keyword`,
                points: 15,
                difficulty: 'easy'
            }) : null
        }
    ],
    medium: [
        {
            template: (table, col) => col ? ({
                title: `Filter ${table.name} by ${col.name}`,
                description: `Write a query to select all records from "${table.name}" where "${col.name}" is NOT NULL. Order the results by "${col.name}".`,
                solution_query: `SELECT * FROM ${table.name} WHERE ${col.name} IS NOT NULL ORDER BY ${col.name};`,
                hint: `Use WHERE ... IS NOT NULL and ORDER BY`,
                points: 20,
                difficulty: 'medium'
            }) : null
        },
        {
            template: (table, col) => col && isNumericType(col.type) ? ({
                title: `Sum of ${col.name}`,
                description: `Write a query to calculate the sum of "${col.name}" from the "${table.name}" table.`,
                solution_query: `SELECT SUM(${col.name}) AS total_${col.name.toLowerCase()} FROM ${table.name};`,
                hint: `Use the SUM() aggregate function`,
                points: 20,
                difficulty: 'medium'
            }) : null
        },
        {
            template: (table, col) => col ? ({
                title: `Group by ${col.name}`,
                description: `Write a query to count the number of records in "${table.name}" grouped by "${col.name}". Show the ${col.name} and the count, ordered by count descending.`,
                solution_query: `SELECT ${col.name}, COUNT(*) AS count FROM ${table.name} GROUP BY ${col.name} ORDER BY count DESC;`,
                hint: `Use GROUP BY with COUNT(*) and ORDER BY`,
                points: 25,
                difficulty: 'medium'
            }) : null
        },
        {
            template: (table, col) => col && isNumericType(col.type) ? ({
                title: `Average ${col.name}`,
                description: `Write a query to calculate the average of "${col.name}" for each unique value. Round to 2 decimal places.`,
                solution_query: `SELECT ROUND(AVG(${col.name}), 2) AS avg_${col.name.toLowerCase()} FROM ${table.name};`,
                hint: `Use AVG() and ROUND() functions`,
                points: 25,
                difficulty: 'medium'
            }) : null
        }
    ],
    hard: [
        {
            template: (table, col, tables) => {
                // Find a potential join
                const fk = findForeignKey(table, tables);
                if (!fk) return null;
                return {
                    title: `Join ${table.name} with ${fk.refTable}`,
                    description: `Write a query to join the "${table.name}" table with the "${fk.refTable}" table on "${fk.column}" = "${fk.refColumn}". Select all columns from both tables.`,
                    solution_query: `SELECT * FROM ${table.name} JOIN ${fk.refTable} ON ${table.name}.${fk.column} = ${fk.refTable}.${fk.refColumn};`,
                    hint: `Use JOIN ... ON to combine tables based on their relationship`,
                    points: 35,
                    difficulty: 'hard'
                };
            }
        },
        {
            template: (table, col) => col && isNumericType(col.type) ? ({
                title: `Top Records by ${col.name}`,
                description: `Write a query to find the top 5 records from "${table.name}" with the highest "${col.name}" values. Show all columns.`,
                solution_query: `SELECT * FROM ${table.name} ORDER BY ${col.name} DESC LIMIT 5;`,
                hint: `Use ORDER BY ... DESC with LIMIT`,
                points: 30,
                difficulty: 'hard'
            }) : null
        },
        {
            template: (table, col, tables) => {
                const fk = findForeignKey(table, tables);
                if (!fk || !col || !isNumericType(col.type)) return null;
                return {
                    title: `Aggregate with Join`,
                    description: `Write a query to join "${table.name}" with "${fk.refTable}" and calculate the SUM of "${col.name}" grouped by a column from "${fk.refTable}". Order by the sum descending.`,
                    solution_query: `SELECT ${fk.refTable}.${fk.refColumn}, SUM(${table.name}.${col.name}) AS total FROM ${table.name} JOIN ${fk.refTable} ON ${table.name}.${fk.column} = ${fk.refTable}.${fk.refColumn} GROUP BY ${fk.refTable}.${fk.refColumn} ORDER BY total DESC;`,
                    hint: `Combine JOIN with GROUP BY and SUM()`,
                    points: 40,
                    difficulty: 'hard'
                };
            }
        },
        {
            template: (table, col) => col ? ({
                title: `Subquery on ${table.name}`,
                description: `Write a query to find all records in "${table.name}" where "${col.name}" is above the average "${col.name}" value.`,
                solution_query: `SELECT * FROM ${table.name} WHERE ${col.name} > (SELECT AVG(${col.name}) FROM ${table.name});`,
                hint: `Use a subquery in the WHERE clause with AVG()`,
                points: 40,
                difficulty: 'hard'
            }) : null
        }
    ]
};

function isNumericType(type) {
    const t = (type || '').toUpperCase();
    return ['INTEGER', 'INT', 'REAL', 'FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC', 'NUMBER'].some(
        nt => t.includes(nt)
    );
}

function findForeignKey(table, allTables) {
    // Look for columns that reference other tables (simple heuristic: *_id columns)
    for (const col of table.columns) {
        const match = col.name.match(/^(\w+)_id$/i);
        if (match) {
            const refTableName = match[1];
            // Find matching table (try singular and plural)
            const refTable = allTables.find(t =>
                t.name.toLowerCase() === refTableName.toLowerCase() ||
                t.name.toLowerCase() === refTableName.toLowerCase() + 's' ||
                t.name.toLowerCase() === refTableName.toLowerCase() + 'es'
            );
            if (refTable) {
                const refPk = refTable.columns.find(c => c.isPrimary);
                return {
                    column: col.name,
                    refTable: refTable.name,
                    refColumn: refPk ? refPk.name : 'id'
                };
            }
        }
    }
    return null;
}

export default function QuestionGenerator({ tables, onSave, hackathonId }) {
    const [questions, setQuestions] = useState([]);
    const [expandedIdx, setExpandedIdx] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [savedIndices, setSavedIndices] = useState(new Set());

    const generateQuestions = () => {
        if (!generationLimiter.check('generator')) {
            const delay = generationLimiter.getRemainingTimeSeconds('generator');
            toast.error(`Generation limit exceeded. Please wait ${delay}s.`);
            return;
        }

        setIsGenerating(true);
        setSavedIndices(new Set());

        const generated = [];

        for (const table of tables) {
            // Get non-primary columns for variety
            const nonPkCols = table.columns.filter(c => !c.isPrimary);
            const numericCols = table.columns.filter(c => isNumericType(c.type));
            const textCols = nonPkCols.filter(c => !isNumericType(c.type));

            // Generate easy questions
            for (const tmpl of QUESTION_TEMPLATES.easy) {
                const col = textCols[0] || nonPkCols[0] || null;
                const q = tmpl.template(table, col, tables);
                if (q) generated.push(q);
            }

            // Generate medium questions
            for (const tmpl of QUESTION_TEMPLATES.medium) {
                const col = numericCols[0] || textCols[0] || nonPkCols[0] || null;
                const q = tmpl.template(table, col, tables);
                if (q) generated.push(q);
            }

            // Generate hard questions
            for (const tmpl of QUESTION_TEMPLATES.hard) {
                const col = numericCols[0] || nonPkCols[0] || null;
                const q = tmpl.template(table, col, tables);
                if (q) generated.push(q);
            }
        }

        // De-duplicate by title
        const unique = [];
        const seen = new Set();
        for (const q of generated) {
            if (!seen.has(q.title)) {
                seen.add(q.title);
                unique.push(q);
            }
        }

        setQuestions(unique);
        setIsGenerating(false);
    };

    const updateQuestion = (idx, field, value) => {
        setQuestions(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: value };
            return updated;
        });
    };

    const removeQuestion = (idx) => {
        setQuestions(prev => prev.filter((_, i) => i !== idx));
        setSavedIndices(prev => {
            const updated = new Set(prev);
            updated.delete(idx);
            return updated;
        });
    };

    const saveQuestion = async (idx) => {
        const q = questions[idx];
        try {
            await onSave({
                hackathon_id: hackathonId,
                title: q.title,
                description: q.description,
                difficulty: q.difficulty,
                points: q.points,
                hint: q.hint,
                solution_query: q.solution_query,
                required_keywords: [],
                forbidden_keywords: []
            });
            setSavedIndices(prev => new Set(prev).add(idx));
            toast.success(`Challenge "${q.title}" saved!`);
        } catch (e) {
            toast.error('Failed to save challenge');
        }
    };

    const saveAll = async () => {
        let count = 0;
        for (let i = 0; i < questions.length; i++) {
            if (!savedIndices.has(i)) {
                try {
                    await saveQuestion(i);
                    count++;
                } catch (e) { /* individual errors handled in saveQuestion */ }
            }
        }
        if (count > 0) {
            toast.success(`${count} challenges saved!`);
        }
    };

    const getDifficultyColor = (d) => {
        switch (d) {
            case 'easy': return 'bg-emerald-100 text-emerald-700';
            case 'medium': return 'bg-amber-100 text-amber-700';
            case 'hard': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <div className="space-y-4">
            {/* Generate button */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-slate-900">Auto-Generate Questions</h3>
                    <p className="text-sm text-slate-500">
                        Generate SQL challenges based on your database schema
                    </p>
                </div>
                <Button
                    onClick={generateQuestions}
                    className="bg-violet-600 hover:bg-violet-700"
                    disabled={isGenerating || tables.length === 0}
                >
                    {isGenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Wand2 className="w-4 h-4 mr-2" />
                    )}
                    Generate Questions
                </Button>
            </div>

            {tables.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                    No tables found. Set up your database first (schema or upload a file) to generate questions.
                </div>
            )}

            {/* Generated questions list */}
            {questions.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-sm">
                            {questions.length} questions generated
                        </Badge>
                        {questions.length > 0 && (
                            <Button
                                size="sm"
                                onClick={saveAll}
                                className="bg-emerald-600 hover:bg-emerald-700"
                                disabled={savedIndices.size === questions.length}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Save All Unsaved ({questions.length - savedIndices.size})
                            </Button>
                        )}
                    </div>

                    {questions.map((q, idx) => {
                        const isExpanded = expandedIdx === idx;
                        const isSaved = savedIndices.has(idx);

                        return (
                            <Card key={idx} className={`border ${isSaved ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'} shadow-sm`}>
                                <div
                                    className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge className={getDifficultyColor(q.difficulty) + ' border-0 text-xs'}>
                                                {q.difficulty}
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                <Star className="w-3 h-3 mr-1" />
                                                {q.points} pts
                                            </Badge>
                                            {isSaved && (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                            )}
                                        </div>
                                        <h4 className="font-medium text-slate-900 truncate">{q.title}</h4>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>

                                {isExpanded && (
                                    <CardContent className="pt-0 space-y-3 border-t border-slate-100">
                                        <div className="space-y-2 pt-3">
                                            <Label className="text-xs font-medium text-slate-500">Title</Label>
                                            <Input
                                                value={q.title}
                                                onChange={(e) => updateQuestion(idx, 'title', e.target.value)}
                                                disabled={isSaved}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium text-slate-500">Description</Label>
                                            <Textarea
                                                value={q.description}
                                                onChange={(e) => updateQuestion(idx, 'description', e.target.value)}
                                                rows={2}
                                                disabled={isSaved}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium text-slate-500">Points</Label>
                                                <Input
                                                    type="number"
                                                    value={q.points}
                                                    onChange={(e) => updateQuestion(idx, 'points', parseInt(e.target.value) || 0)}
                                                    disabled={isSaved}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-medium text-slate-500">Difficulty</Label>
                                                <select
                                                    value={q.difficulty}
                                                    onChange={(e) => updateQuestion(idx, 'difficulty', e.target.value)}
                                                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                                                    disabled={isSaved}
                                                >
                                                    <option value="easy">Easy</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="hard">Hard</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium text-slate-500">Solution Query</Label>
                                            <Textarea
                                                value={q.solution_query}
                                                onChange={(e) => updateQuestion(idx, 'solution_query', e.target.value)}
                                                rows={2}
                                                className="font-mono text-sm"
                                                disabled={isSaved}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium text-slate-500">Hint</Label>
                                            <Input
                                                value={q.hint || ''}
                                                onChange={(e) => updateQuestion(idx, 'hint', e.target.value)}
                                                disabled={isSaved}
                                            />
                                        </div>
                                        <div className="flex gap-2 pt-2">
                                            {!isSaved && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                        onClick={() => saveQuestion(idx)}
                                                    >
                                                        <Save className="w-4 h-4 mr-1" />
                                                        Save as Challenge
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                        onClick={() => removeQuestion(idx)}
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-1" />
                                                        Remove
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

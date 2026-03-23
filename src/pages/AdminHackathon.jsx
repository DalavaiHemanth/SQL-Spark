import React, { useState, useEffect } from 'react';
import { db } from '@/api/dataClient';
import { fetchDbFile } from '@/utils/fetchDbFile';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl, formatDatetimeLocal } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import DatabaseManager from '@/components/hackathon/DatabaseManager';
import {
    ArrowLeft,
    Plus,
    Save,
    Trash2,
    Users,
    Target,
    Trophy,
    Loader2,
    Zap,
    Edit2,
    Settings,
    Database,
    Upload,
    FileJson,
    Activity,
    Clock,
    CheckCircle2,
    X,
    Sparkles,
    AlertTriangle,
    Globe,
    Lock,
    Copy,
    RefreshCw,
    UserPlus,
    CheckCircle,
    XCircle,
    Download,
    Eye,
    EyeOff,
    Check,
    ChevronRight,
    Flag,
    Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Leaderboard from '@/components/hackathon/Leaderboard';
import QuestionGenerator from '@/components/hackathon/QuestionGenerator';
import CodeEditor from '@/components/ui/CodeEditor';
import AdminDbPreview from '@/components/hackathon/AdminDbPreview';
import { useSqlJs } from '@/hooks/useSqlJs';
import Certificate from '@/components/hackathon/Certificate'; // ADDED for preview

export default function AdminHackathon() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const hackathonId = searchParams.get('id');
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { SQL, isLoading: isLoadingSql } = useSqlJs();

    const [dbSchema, setDbSchema] = useState('');
    const [sampleData, setSampleData] = useState('');
    const [dbSource, setDbSource] = useState('manual');
    const [uploadedFileUrl, setUploadedFileUrl] = useState('');
    const [schemaTables, setSchemaTables] = useState([]);
    const [showChallengeDialog, setShowChallengeDialog] = useState(false);
    const [editingChallenge, setEditingChallenge] = useState(null);
    const [newChallenge, setNewChallenge] = useState({
        title: '',
        description: '',
        difficulty: 'medium',
        points: 100,
        expected_output: '',
        solution_query: '',
        hints: [],
        required_keywords: [],
        forbidden_keywords: [],
        database_id: null,
        round_number: 1
    });
    const [newHint, setNewHint] = useState({ text: '', point_penalty: 50 });
    const [newRequiredKeyword, setNewRequiredKeyword] = useState('');
    const [newForbiddenKeyword, setNewForbiddenKeyword] = useState('');
    const [showBulkImport, setShowBulkImport] = useState(false);
    const [outputPreview, setOutputPreview] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [bulkJson, setBulkJson] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    // Save manual SQL to library
    const [saveLibName, setSaveLibName] = useState('');
    const [saveLibPublic, setSaveLibPublic] = useState(false);
    const [isSavingToLib, setIsSavingToLib] = useState(false);

    // Status change confirmation
    const [pendingStatus, setPendingStatus] = useState(null);
    const [showStatusConfirmDialog, setShowStatusConfirmDialog] = useState(false);

    // Multi-round state
    const [showQualifyDialog, setShowQualifyDialog] = useState(false);
    const [qualifyingRoundNumber, setQualifyingRoundNumber] = useState(null);
    const [qualificationScoreInput, setQualificationScoreInput] = useState('');
    const [isEndingRound, setIsEndingRound] = useState(false);

    // Challenges tab round filter
    const [selectedRoundFilter, setSelectedRoundFilter] = useState('all');
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    // Auto-generate round target
    const [autoGenRound, setAutoGenRound] = useState('1');

    const { data: hackathon, isLoading } = useQuery({
        queryKey: ['hackathon', hackathonId],
        queryFn: async () => {
            const hackathons = await db.entities.Hackathon.list();
            return hackathons.find(h => h.id === hackathonId) || null;
        },
        enabled: !!hackathonId
    });

    // Auto-start rounds when their start_time arrives, and auto-complete when end_time passes
    useEffect(() => {
        if (!hackathon || !hackathon.rounds_config || hackathon.status !== 'in_progress') return;

        const checkRoundTimes = () => {
            const now = new Date();
            let needsUpdate = false;
            const newConfig = [...hackathon.rounds_config];
            const totalRounds = hackathon.total_rounds || 1;
            let hackathonUpdate = {};

            for (let i = 0; i < newConfig.length; i++) {
                const r = newConfig[i];

                // Auto-activate an upcoming round when its start_time arrives
                if (r.status === 'upcoming' && r.start_time) {
                    const st = new Date(r.start_time);
                    if (now >= st && hackathon.current_round === r.round_number) {
                        newConfig[i] = { ...r, status: 'active' };
                        needsUpdate = true;
                    }
                }

                // Auto-complete an active round when its end_time passes
                if (r.status === 'active' && r.end_time) {
                    const et = new Date(r.end_time);
                    if (now >= et) {
                        newConfig[i] = { ...r, status: 'completed' };
                        needsUpdate = true;

                        const isLastRound = r.round_number >= totalRounds;
                        if (isLastRound) {
                            // Last round ended — complete the hackathon
                            hackathonUpdate.status = 'completed';
                        } else {
                            // Advance to next round
                            hackathonUpdate.current_round = r.round_number + 1;
                        }
                    }
                }
            }

            if (needsUpdate) {
                db.entities.Hackathon.update(hackathon.id, { rounds_config: newConfig, ...hackathonUpdate })
                    .then(() => queryClient.invalidateQueries(['hackathon']))
                    .catch(() => {});
            }
        };

        checkRoundTimes();
        const interval = setInterval(checkRoundTimes, 10000);
        return () => clearInterval(interval);
    }, [hackathon, queryClient]);

    // Parse tables from SQL schema for QuestionGenerator
    const parseTables = (sql) => {
        // ... (existing logic)
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

    // Extract tables from uploaded DB file
    const loadTablesFromFile = async (url) => {
        if (!SQL || !url) return;
        try {
            // Validate URL format
            try {
                new URL(url);
            } catch {
                toast.error('Invalid database file URL. Please re-upload the file.');
                return;
            }

            const buffer = await fetchDbFile(url);
            const database = new SQL.Database(new Uint8Array(buffer));
            const result = database.exec(
                "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            );
            if (result.length > 0) {
                const tables = [];
                for (const row of result[0].values) {
                    const parsed = parseTables(row[1] + ';');
                    // ... (rest of parsing logic same as before)
                    if (parsed.length > 0) {
                        tables.push(parsed[0]);
                    } else {
                        try {
                            const pragmaResult = database.exec(`PRAGMA table_info("${row[0]}")`);
                            if (pragmaResult.length > 0) {
                                tables.push({
                                    name: row[0],
                                    columns: pragmaResult[0].values.map(col => ({
                                        name: col[1],
                                        type: (col[2] || 'TEXT').toUpperCase(),
                                        isPrimary: col[5] === 1,
                                        isNotNull: col[3] === 1
                                    }))
                                });
                            }
                        } catch (e) {
                            tables.push({ name: row[0], columns: [] });
                        }
                    }
                }
                setSchemaTables(tables);
            }
            database.close();
        } catch (e) {
            console.error('Failed to load tables from DB file:', e);
            toast.error('Failed to parse database file. Make sure it is a valid SQLite (.db/.sqlite) file.');
        }
    };

    // Effect to load tables when file URL changes or SQL becomes ready
    useEffect(() => {
        if (uploadedFileUrl && SQL) {
            loadTablesFromFile(uploadedFileUrl);
        } else if (dbSource === 'manual' && dbSchema) {
            setSchemaTables(parseTables(dbSchema));
        }
    }, [dbSource, uploadedFileUrl, dbSchema, SQL]);

    const [certSettings, setCertSettings] = useState(null);

    // Initial load effect (modified to not call load function directly)
    useEffect(() => {
        if (hackathon) {
            setDbSchema(hackathon.database_schema || '');
            setSampleData(hackathon.sample_data || '');
            setDbSource(hackathon.database_source || 'manual');
            setUploadedFileUrl(hackathon.database_file_url || '');
            
            // Only initialize certSettings once to avoid overwriting ongoing edits
            if (certSettings === null) {
                setCertSettings(hackathon.certificate_settings || {});
            }
        }
    }, [hackathon, certSettings]);

    const handleCertChange = (key, value) => {
        setCertSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleCertBlur = () => {
        updateHackathonMutation.mutate({
            certificate_settings: certSettings
        });
    };

    const { data: challenges = [] } = useQuery({
        queryKey: ['challenges', hackathonId],
        queryFn: () => db.entities.Challenge.filter({ hackathon_id: hackathonId }, 'order'),
        enabled: !!hackathonId
    });

    const displayedChallenges = selectedRoundFilter === 'all'
        ? challenges
        : challenges.filter(c => (c.round_number || 1) === parseInt(selectedRoundFilter));

    // Hackathon's curated database list
    const hackathonDbIds = hackathon?.hackathon_database_ids || [];
    const { data: hackathonDbs = [] } = useQuery({
        queryKey: ['hackathon_dbs', hackathonId, hackathonDbIds.join(',')],
        queryFn: async () => {
            if (!hackathonDbIds.length) return [];
            const { data, error } = await supabase
                .from('database_library')
                .select('*')
                .in('id', hackathonDbIds);
            if (error) throw error;
            return data || [];
        },
        enabled: !!hackathonId
    });

    const addDbToHackathon = async (dbEntry) => {
        if (hackathonDbIds.includes(dbEntry.id)) return;
        const newIds = [...hackathonDbIds, dbEntry.id];
        const { error } = await supabase
            .from('hackathons')
            .update({ hackathon_database_ids: newIds })
            .eq('id', hackathonId);
        if (error) { toast.error('Failed to add database'); return; }
        queryClient.invalidateQueries(['hackathon', hackathonId]);
        queryClient.invalidateQueries(['hackathon_dbs', hackathonId]);
        toast.success(`"${dbEntry.name}" added to hackathon!`);
    };

    const removeDbFromHackathon = async (dbId) => {
        const newIds = hackathonDbIds.filter(id => id !== dbId);
        const { error } = await supabase
            .from('hackathons')
            .update({ hackathon_database_ids: newIds })
            .eq('id', hackathonId);
        if (error) { toast.error('Failed to remove database'); return; }
        queryClient.invalidateQueries(['hackathon', hackathonId]);
        queryClient.invalidateQueries(['hackathon_dbs', hackathonId]);
        toast.success('Database removed from hackathon list');
    };

    // Which hackathon DB is selected/previewed in challenge tab
    const [selectedHackathonDb, setSelectedHackathonDb] = useState(null);
    const [selectedHackathonDbTables, setSelectedHackathonDbTables] = useState([]);
    const [showAutoGenerate, setShowAutoGenerate] = useState(false);

    const { data: teams = [] } = useQuery({
        queryKey: ['teams', hackathonId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('teams')
                .select('*')
                .eq('hackathon_id', hackathonId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!hackathonId,
        refetchInterval: 15000 // Poll every 15 seconds for live violation updates
    });

    const { data: allSubmissions = [] } = useQuery({
        queryKey: ['submissions', hackathonId],
        queryFn: () => db.entities.Submission.filter({ hackathon_id: hackathonId }),
        enabled: !!hackathonId
    });

    // REAL-TIME UPDATES: Subscribe to teams and submissions
    useEffect(() => {
        if (!hackathonId || window.IS_MOCK_MODE) return;

        const teamsChannel = supabase
            .channel(`admin-teams-${hackathonId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'teams', filter: `hackathon_id=eq.${hackathonId}` },
                () => queryClient.invalidateQueries(['teams', hackathonId])
            )
            .subscribe();

        const subsChannel = supabase
            .channel(`admin-subs-${hackathonId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'submissions', filter: `hackathon_id=eq.${hackathonId}` },
                () => queryClient.invalidateQueries(['submissions', hackathonId])
            )
            .subscribe();

        return () => {
            supabase.removeChannel(teamsChannel);
            supabase.removeChannel(subsChannel);
        };
    }, [hackathonId, queryClient]);

    // Get violation summary per team — reads from live teams.violations column,
    // falls back to submissions if not yet synced
    const getTeamViolations = (teamId) => {
        // Try live violations from teams table first
        const team = teams.find(t => t.id === teamId);
        if (team?.violations) {
            const v = team.violations;
            return {
                totalViolations: v.total_violations || 0,
                tabSwitches: v.tab_switches || 0,
                pastes: v.paste_count || 0,
                fullscreenExits: v.fullscreen_exits || 0
            };
        }
        // Fallback: read from submissions
        const teamSubs = allSubmissions.filter(s => s.team_id === teamId && s.violations);
        let totalViolations = 0, tabSwitches = 0, pastes = 0;
        for (const sub of teamSubs) {
            try {
                const v = JSON.parse(sub.violations);
                totalViolations = Math.max(totalViolations, v.total_violations || 0);
                tabSwitches = Math.max(tabSwitches, v.tab_switches || 0);
                pastes = Math.max(pastes, v.paste_count || 0);
            } catch { /* ignore */ }
        }
        return { totalViolations, tabSwitches, pastes, fullscreenExits: 0 };
    };

    const updateHackathonMutation = useMutation({
        mutationFn: (data) => db.entities.Hackathon.update(hackathonId, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['hackathon', hackathonId]);
            queryClient.invalidateQueries(['hackathons']);
            toast.success('Hackathon updated!');
        },
        onError: (err) => {
            toast.error('Failed to update: ' + err.message);
        }
    });

    const createChallengeMutation = useMutation({
        mutationFn: (data) => db.entities.Challenge.create({
            ...data,
            hackathon_id: hackathonId,
            order: challenges.length
        }),
        onSuccess: () => {
            queryClient.invalidateQueries(['challenges', hackathonId]);
            setShowChallengeDialog(false);
            resetChallengeForm();
            toast.success('Challenge created!');
        }
    });

    const updateChallengeMutation = useMutation({
        mutationFn: ({ id, data }) => db.entities.Challenge.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['challenges', hackathonId]);
            setShowChallengeDialog(false);
            setEditingChallenge(null);
            resetChallengeForm();
            toast.success('Challenge updated!');
        }
    });

    const deleteChallengeMutation = useMutation({
        mutationFn: (id) => db.entities.Challenge.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['challenges', hackathonId]);
            toast.success('Challenge deleted!');
        }
    });

    // ── CSV Team Import ────────────────────────────────────────────
    const [showCsvImport, setShowCsvImport] = useState(false);
    const [csvText, setCsvText] = useState('');
    const [csvParsed, setCsvParsed] = useState([]);
    const [csvImporting, setCsvImporting] = useState(false);

    const parseCsvText = (raw) => {
        const lines = raw.trim().split('\n').filter(l => l.trim());
        return lines.map((line, idx) => {
            const cols = line.split(',').map(c => c.trim());
            const name = cols[0] || `Team ${idx + 1}`;
            const members = cols.slice(1).filter(Boolean);
            return { name, members };
        }).filter(t => t.name);
    };

    const handleCsvChange = (raw) => {
        setCsvText(raw);
        setCsvParsed(parseCsvText(raw));
    };

    const handleCsvImport = async () => {
        if (!csvParsed.length) return;
        setCsvImporting(true);
        let created = 0, failed = 0;
        for (const row of csvParsed) {
            try {
                // Generate a simple join code
                const join_code = Math.random().toString(36).slice(2, 8).toUpperCase();
                await db.entities.Team.create({
                    name: row.name,
                    hackathon_id: hackathonId,
                    join_code,
                    members: row.members,
                });
                created++;
            } catch {
                failed++;
            }
        }
        setCsvImporting(false);
        setShowCsvImport(false);
        setCsvText('');
        setCsvParsed([]);
        queryClient.invalidateQueries(['teams', hackathonId]);
        toast.success(`Imported ${created} teams${failed ? ` (${failed} failed)` : ''}`);
    };

    const resetChallengeForm = () => {
        setNewChallenge({
            title: '',
            description: '',
            difficulty: 'medium',
            points: 100,
            expected_output: '',
            solution_query: '',
            order_sensitive: false,
            hints: [],
            required_keywords: [],
            forbidden_keywords: [],
            round_number: selectedRoundFilter !== 'all' ? parseInt(selectedRoundFilter) : 1
        });
        setNewHint({ text: '', point_penalty: 50 });
        setNewRequiredKeyword('');
        setNewForbiddenKeyword('');
    };

    const addHint = () => {
        if (newHint.text) {
            setNewChallenge({
                ...newChallenge,
                hints: [...newChallenge.hints, newHint]
            });
            setNewHint({ text: '', point_penalty: Math.max(1, Math.round((newChallenge?.points || 100) * 0.5)) });
        }
    };

    const removeHint = (index) => {
        setNewChallenge({
            ...newChallenge,
            hints: newChallenge.hints.filter((_, i) => i !== index)
        });
    };

    const openEditChallenge = (challenge) => {
        setEditingChallenge(challenge);
        setNewChallenge({
            title: challenge.title,
            description: challenge.description,
            difficulty: challenge.difficulty,
            points: challenge.points,
            expected_output: challenge.expected_output || '',
            solution_query: challenge.solution_query || '',
            order_sensitive: challenge.order_sensitive || false,
            hints: challenge.hints || [],
            required_keywords: challenge.required_keywords || [],
            forbidden_keywords: challenge.forbidden_keywords || [],
            round_number: challenge.round_number || 1
        });
        setShowChallengeDialog(true);
    };

    // Extracted auto-generate function (reusable)
    const runSolutionQuery = async (challenge = newChallenge) => {
        if (!SQL) {
            toast.error('SQL engine not loaded yet');
            return null;
        }
        if (!challenge.solution_query?.trim()) {
            toast.error('Please enter a solution query first');
            return null;
        }
        setIsGenerating(true);
        try {
            let tempDb;
            const fileUrl = uploadedFileUrl || hackathon?.database_file_url;
            const schema = dbSchema || hackathon?.database_schema;
            const data = sampleData || hackathon?.sample_data;

            if (fileUrl) {
                const buffer = await fetchDbFile(fileUrl);
                tempDb = new SQL.Database(new Uint8Array(buffer));
            } else if (schema) {
                tempDb = new SQL.Database();
                tempDb.run(schema);
                if (data) tempDb.run(data);
            } else {
                toast.error('No database found. Set up your database first.');
                setIsGenerating(false);
                return null;
            }

            const results = tempDb.exec(challenge.solution_query);
            tempDb.close();
            if (results.length === 0) {
                const output = '[]';
                setNewChallenge(prev => ({ ...prev, expected_output: output }));
                setOutputPreview({ columns: [], rows: [] });
                toast.info('Query returned no rows');
                setIsGenerating(false);
                return output;
            }
            const rows = results[0].values.map(row => {
                const obj = {};
                results[0].columns.forEach((col, i) => { obj[col] = row[i]; });
                return obj;
            });
            const output = JSON.stringify(rows, null, 2);
            setNewChallenge(prev => ({ ...prev, expected_output: output }));
            setOutputPreview({ columns: results[0].columns, rows });
            toast.success(`Generated expected output (${rows.length} rows)`);
            setIsGenerating(false);
            return output;
        } catch (e) {
            toast.error(`SQL Error: ${e.message}`);
            setIsGenerating(false);
            return null;
        }
    };

    const handleSaveChallenge = async () => {
        // Auto-link the DB chip selected in the left panel
        let challengeToSave = {
            ...newChallenge,
            database_id: selectedHackathonDb?.id ?? newChallenge.database_id ?? null,
            database_name: selectedHackathonDb?.name ?? newChallenge.database_name ?? null,
        };

        // Auto-generate expected output if empty but solution query exists
        if (!challengeToSave.expected_output?.trim() && challengeToSave.solution_query?.trim() && SQL) {
            const generated = await runSolutionQuery(challengeToSave);
            if (generated) {
                challengeToSave = { ...challengeToSave, expected_output: generated };
            }
        }

        if (editingChallenge) {
            updateChallengeMutation.mutate({ id: editingChallenge.id, data: challengeToSave });
        } else {
            createChallengeMutation.mutate(challengeToSave);
        }
    };

    if (isLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!hackathon) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">Hackathon Not Found</h2>
                        <Button onClick={() => navigate(createPageUrl('AdminDashboard'))}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const difficultyColors = {
        easy: 'bg-green-100 text-green-700',
        medium: 'bg-yellow-100 text-yellow-700',
        hard: 'bg-orange-100 text-orange-700',
        expert: 'bg-red-100 text-red-700'
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(createPageUrl('AdminDashboard'))}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-900">{hackathon.title}</h1>
                        <p className="text-slate-500">Manage challenges and view progress</p>
                    </div>
                </div>

                <Tabs defaultValue="challenges" className="space-y-6">
                    <TabsList className="bg-white border flex-wrap">
                        <TabsTrigger value="challenges">
                            <Target className="w-4 h-4 mr-2" />
                            Challenges
                        </TabsTrigger>
                        <TabsTrigger value="teams">
                            <Users className="w-4 h-4 mr-2" />
                            Teams
                        </TabsTrigger>
                        <TabsTrigger value="leaderboard">
                            <Trophy className="w-4 h-4 mr-2" />
                            Leaderboard
                        </TabsTrigger>
                        {(hackathon.total_rounds || 1) > 1 && (
                            <TabsTrigger value="rounds">
                                <Layers className="w-4 h-4 mr-2" />
                                Rounds
                                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700 font-bold">
                                    {hackathon.total_rounds}
                                </span>
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="database">
                            <Database className="w-4 h-4 mr-2" />
                            Database
                        </TabsTrigger>
                        <TabsTrigger value="settings">
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                        </TabsTrigger>
                        <TabsTrigger value="activity">
                            <Activity className="w-4 h-4 mr-2" />
                            Activity
                        </TabsTrigger>
                    </TabsList>

                    {/* Challenges Tab */}
                    <TabsContent value="challenges">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-semibold text-slate-900">Challenges ({displayedChallenges.length})</h2>
                                {(hackathon?.total_rounds || 1) > 1 && (
                                    <Select value={selectedRoundFilter} onValueChange={setSelectedRoundFilter}>
                                        <SelectTrigger className="w-[140px] h-9 bg-white border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Rounds</SelectItem>
                                            {Array.from({ length: hackathon.total_rounds }, (_, i) => (
                                                <SelectItem key={i + 1} value={String(i + 1)}>
                                                    Round {i + 1}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                                    onClick={() => setShowBulkImport(true)}
                                >
                                    <FileJson className="w-4 h-4 mr-2" />
                                    Import JSON
                                </Button>
                                <Dialog open={showChallengeDialog} onOpenChange={(open) => {
                                    setShowChallengeDialog(open);
                                    if (!open) {
                                        setEditingChallenge(null);
                                        resetChallengeForm();
                                    }
                                }}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Challenge
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-[95vw] w-full h-[92vh] flex flex-col p-0 gap-0 bg-slate-950 border-slate-800">
                                        {/* Split panel header */}
                                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 flex-shrink-0">
                                            <DialogHeader>
                                                <DialogTitle className="text-white">
                                                    {editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}
                                                </DialogTitle>
                                            </DialogHeader>
                                        </div>

                                        {/* Split panel body */}
                                        <div className="flex flex-1 overflow-hidden">
                                            {/* Left — DB Browser */}
                                            <div className="w-[45%] flex-shrink-0 border-r border-slate-800 overflow-hidden flex flex-col">
                                                {/* DB list header */}
                                                <div className="px-4 py-2.5 border-b border-slate-800 flex-shrink-0">
                                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Database Reference</p>
                                                    <p className="text-xs text-slate-600 mt-0.5">Click a database to browse its tables</p>
                                                </div>

                                                {/* DB chips */}
                                                {hackathonDbs.length > 0 && (
                                                    <div className="flex gap-2 flex-wrap px-3 py-2 border-b border-slate-800 flex-shrink-0">
                                                        {hackathonDbs.map(dbEntry => (
                                                            <button
                                                                key={dbEntry.id}
                                                                onClick={async () => {
                                                                    setSelectedHackathonDb(dbEntry);
                                                                    await loadTablesFromFile(dbEntry.file_url);
                                                                }}
                                                                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                                                                    selectedHackathonDb?.id === dbEntry.id
                                                                        ? 'bg-violet-600 border-violet-500 text-white'
                                                                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-violet-500 hover:text-white'
                                                                }`}
                                                            >
                                                                <Database className="w-3 h-3" />
                                                                {dbEntry.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* DB preview */}
                                                <div className="flex-1 overflow-hidden">
                                                    {selectedHackathonDb ? (
                                                        <AdminDbPreview dbFileUrl={selectedHackathonDb.file_url} />
                                                    ) : (
                                                        <AdminDbPreview
                                                            schema={dbSource === 'manual' ? (dbSchema || hackathon?.database_schema) : undefined}
                                                            sampleData={dbSource === 'manual' ? (sampleData || hackathon?.sample_data) : undefined}
                                                            dbFileUrl={dbSource !== 'manual' ? (uploadedFileUrl || hackathon?.database_file_url) : undefined}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right — Challenge Form */}
                                            <div className="flex-1 overflow-y-auto p-5">
                                        <div className="space-y-4">
                                            {/* Auto DB indicator — set by clicking chip in left panel */}
                                            {selectedHackathonDb && (
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-900/40 border border-violet-700 text-violet-300 text-xs mb-2">
                                                    <Database className="w-3.5 h-3.5" />
                                                    Challenge linked to: <span className="font-semibold">{selectedHackathonDb.name}</span>
                                                    <button
                                                        className="ml-auto text-violet-400 hover:text-white"
                                                        onClick={() => setSelectedHackathonDb(null)}
                                                    ><X className="w-3 h-3" /></button>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-slate-300">Title</Label>
                                                    <Input
                                                        value={newChallenge.title}
                                                        onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })}
                                                        placeholder="Find All Users"
                                                        className="bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-slate-300">Difficulty</Label>
                                                    <Select
                                                        value={newChallenge.difficulty}
                                                        onValueChange={(v) => setNewChallenge({ ...newChallenge, difficulty: v })}
                                                    >
                                                        <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                                                            <SelectItem value="easy">Easy</SelectItem>
                                                            <SelectItem value="medium">Medium</SelectItem>
                                                            <SelectItem value="hard">Hard</SelectItem>
                                                            <SelectItem value="expert">Expert</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-slate-300">Description</Label>
                                                <Textarea
                                                    value={newChallenge.description}
                                                    onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })}
                                                    placeholder="Write a SQL query to..."
                                                    rows={3}
                                                    className="bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-slate-300">Points</Label>
                                                    <Input
                                                        type="number"
                                                        value={newChallenge.points}
                                                        onChange={(e) => setNewChallenge({ ...newChallenge, points: parseInt(e.target.value) })}
                                                        className="bg-slate-900 border-slate-700 text-slate-200"
                                                    />
                                                </div>
                                                {(hackathon?.total_rounds || 1) > 1 && (
                                                    <div className="space-y-2">
                                                        <Label className="text-slate-300">Assign to Round</Label>
                                                        <Select
                                                            value={String(newChallenge.round_number || 1)}
                                                            onValueChange={(v) => setNewChallenge({ ...newChallenge, round_number: parseInt(v) })}
                                                        >
                                                            <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-200">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                                                                {Array.from({ length: hackathon.total_rounds }, (_, i) => (
                                                                    <SelectItem key={i + 1} value={String(i + 1)}>
                                                                        Round {i + 1}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="text-slate-300">Solution Query</Label>
                                                <CodeEditor
                                                    value={newChallenge.solution_query}
                                                    onChange={(v) => setNewChallenge({ ...newChallenge, solution_query: v })}
                                                    className="min-h-[120px]"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <Label className="text-slate-300">Expected Output</Label>

                                                {/* Big prominent Auto-Generate button */}
                                                <Button
                                                    type="button"
                                                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-purple-200 transition-all"
                                                    disabled={!newChallenge.solution_query?.trim() || !SQL || isGenerating}
                                                    onClick={() => runSolutionQuery()}
                                                >
                                                    {isGenerating ? (
                                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                    ) : (
                                                        <Sparkles className="w-5 h-5 mr-2" />
                                                    )}
                                                    {isGenerating ? 'Running Query...' : '✨ Run Query & Generate Expected Output'}
                                                </Button>
                                                {!newChallenge.solution_query?.trim() && (
                                                    <p className="text-xs text-slate-400 text-center">Enter a solution query above first</p>
                                                )}

                                                {/* Table Preview */}
                                                {outputPreview && outputPreview.rows.length > 0 && (
                                                    <div className="border rounded-lg overflow-hidden">
                                                        <div className="bg-emerald-50 px-3 py-2 border-b flex items-center justify-between">
                                                            <span className="text-sm font-medium text-emerald-700">
                                                                ✅ Preview: {outputPreview.rows.length} row{outputPreview.rows.length !== 1 ? 's' : ''}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="text-xs text-slate-400 hover:text-slate-600"
                                                                onClick={() => setOutputPreview(null)}
                                                            >
                                                                Hide
                                                            </button>
                                                        </div>
                                                        <div className="max-h-48 overflow-auto">
                                                            <table className="w-full text-sm">
                                                                <thead className="bg-slate-50 sticky top-0">
                                                                    <tr>
                                                                        <th className="px-3 py-1.5 text-left text-xs font-semibold text-slate-500 border-b">#</th>
                                                                        {outputPreview.columns.map((col) => (
                                                                            <th key={col} className="px-3 py-1.5 text-left text-xs font-semibold text-slate-500 border-b">
                                                                                {col}
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {outputPreview.rows.slice(0, 50).map((row, i) => (
                                                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                                            <td className="px-3 py-1.5 text-xs text-slate-400 border-b">{i + 1}</td>
                                                                            {outputPreview.columns.map((col) => (
                                                                                <td key={col} className="px-3 py-1.5 text-xs text-slate-700 border-b font-mono">
                                                                                    {String(row[col] ?? '')}
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                            {outputPreview.rows.length > 50 && (
                                                                <div className="p-2 text-center text-xs text-slate-400 bg-slate-50">
                                                                    Showing first 50 of {outputPreview.rows.length} rows
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {outputPreview && outputPreview.rows.length === 0 && (
                                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 text-center">
                                                        Query returned 0 rows — expected output is empty array
                                                    </div>
                                                )}

                                                {/* Raw JSON (collapsible) */}
                                                <details className="group">
                                                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                                                        {newChallenge.expected_output ? 'View/Edit raw JSON' : 'Or enter JSON manually'}
                                                    </summary>
                                                    <Textarea
                                                        value={newChallenge.expected_output}
                                                        onChange={(e) => {
                                                            setNewChallenge({ ...newChallenge, expected_output: e.target.value });
                                                            setOutputPreview(null);
                                                        }}
                                                        placeholder='Will be auto-generated from solution query'
                                                        rows={4}
                                                        className="font-mono text-xs mt-2"
                                                    />
                                                </details>
                                            </div>

                                            {/* Order Sensitive Toggle */}
                                            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                                                <div>
                                                    <Label className="text-sm font-medium text-slate-200">Row Order Matters</Label>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Enable if the question requires ORDER BY (e.g., "sorted by salary")
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewChallenge({ ...newChallenge, order_sensitive: !newChallenge.order_sensitive })}
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${newChallenge.order_sensitive ? 'bg-emerald-500' : 'bg-slate-300'
                                                        }`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${newChallenge.order_sensitive ? 'translate-x-6' : 'translate-x-1'
                                                        }`} />
                                                </button>
                                            </div>

                                            {/* Required Keywords */}
                                            <div className="space-y-3">
                                                <Label className="text-slate-300">Required Keywords</Label>
                                                <p className="text-xs text-slate-500">SQL keywords that MUST be used (e.g., JOIN, GROUP BY, HAVING)</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {newChallenge.required_keywords?.map((kw, i) => (
                                                        <Badge key={i} className="bg-emerald-100 text-emerald-700 gap-1">
                                                            {kw}
                                                            <button onClick={() => setNewChallenge({
                                                                ...newChallenge,
                                                                required_keywords: newChallenge.required_keywords.filter((_, idx) => idx !== i)
                                                            })}>
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={newRequiredKeyword}
                                                        onChange={(e) => setNewRequiredKeyword(e.target.value.toUpperCase())}
                                                        placeholder="e.g., JOIN, GROUP BY"
                                                        className="flex-1 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && newRequiredKeyword.trim()) {
                                                                e.preventDefault();
                                                                setNewChallenge({
                                                                    ...newChallenge,
                                                                    required_keywords: [...(newChallenge.required_keywords || []), newRequiredKeyword.trim()]
                                                                });
                                                                setNewRequiredKeyword('');
                                                            }
                                                        }}
                                                    />
                                                    <Button variant="outline" onClick={() => {
                                                        if (newRequiredKeyword.trim()) {
                                                            setNewChallenge({
                                                                ...newChallenge,
                                                                required_keywords: [...(newChallenge.required_keywords || []), newRequiredKeyword.trim()]
                                                            });
                                                            setNewRequiredKeyword('');
                                                        }
                                                    }}>Add</Button>
                                                </div>
                                            </div>

                                            {/* Forbidden Keywords */}
                                            <div className="space-y-3">
                                                <Label className="text-slate-300">Forbidden Keywords</Label>
                                                <p className="text-xs text-slate-400">SQL keywords that are NOT allowed (e.g., UNION, subqueries)</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {newChallenge.forbidden_keywords?.map((kw, i) => (
                                                        <Badge key={i} className="bg-red-100 text-red-700 gap-1">
                                                            {kw}
                                                            <button onClick={() => setNewChallenge({
                                                                ...newChallenge,
                                                                forbidden_keywords: newChallenge.forbidden_keywords.filter((_, idx) => idx !== i)
                                                            })}>
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={newForbiddenKeyword}
                                                        onChange={(e) => setNewForbiddenKeyword(e.target.value.toUpperCase())}
                                                        placeholder="e.g., UNION, SELECT *"
                                                        className="flex-1 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && newForbiddenKeyword.trim()) {
                                                                e.preventDefault();
                                                                setNewChallenge({
                                                                    ...newChallenge,
                                                                    forbidden_keywords: [...(newChallenge.forbidden_keywords || []), newForbiddenKeyword.trim()]
                                                                });
                                                                setNewForbiddenKeyword('');
                                                            }
                                                        }}
                                                    />
                                                    <Button variant="outline" onClick={() => {
                                                        if (newForbiddenKeyword.trim()) {
                                                            setNewChallenge({
                                                                ...newChallenge,
                                                                forbidden_keywords: [...(newChallenge.forbidden_keywords || []), newForbiddenKeyword.trim()]
                                                            });
                                                            setNewForbiddenKeyword('');
                                                        }
                                                    }}>Add</Button>
                                                </div>
                                            </div>

                                            {/* Hints */}
                                            <div className="space-y-3">
                                                <Label className="text-slate-300">Hints</Label>
                                                {newChallenge.hints.map((hint, i) => (
                                                    <div key={i} className="flex items-center gap-2 p-3 bg-slate-800 rounded-lg border border-slate-700">
                                                        <span className="flex-1 text-sm text-slate-200">{hint.text}</span>
                                                        <Badge variant="outline">-{hint.point_penalty} pts</Badge>
                                                        <Button variant="ghost" size="icon" onClick={() => removeHint(i)}>
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                ))}
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={newHint.text}
                                                        onChange={(e) => setNewHint({ ...newHint, text: e.target.value })}
                                                        placeholder="Hint text..."
                                                        className="flex-1 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
                                                    />
                                                    <Input
                                                        type="number"
                                                        value={newHint.point_penalty}
                                                        onChange={(e) => setNewHint({ ...newHint, point_penalty: parseInt(e.target.value) })}
                                                        className="w-24 bg-slate-900 border-slate-700 text-slate-200"
                                                    />
                                                    <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800" onClick={addHint}>Add</Button>
                                                </div>
                                            </div>

                                            {(hackathon?.total_rounds || 1) > 1 ? (
                                                <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                                                            disabled={!newChallenge.title || createChallengeMutation.isPending || updateChallengeMutation.isPending}
                                                        >
                                                            {(createChallengeMutation.isPending || updateChallengeMutation.isPending) ? (
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            ) : (
                                                                <Save className="w-4 h-4 mr-2" />
                                                            )}
                                                            {editingChallenge ? 'Update Challenge' : 'Create Challenge'}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirm Round Assignment</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to {editingChallenge ? 'update' : 'create'} this challenge and assign it to <strong className="text-white">Round {newChallenge.round_number || 1}</strong>?
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleSaveChallenge(); setShowSaveConfirm(false); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                                                Confirm
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            ) : (
                                                <Button
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={handleSaveChallenge}
                                                    disabled={!newChallenge.title || createChallengeMutation.isPending || updateChallengeMutation.isPending}
                                                >
                                                    {(createChallengeMutation.isPending || updateChallengeMutation.isPending) ? (
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <Save className="w-4 h-4 mr-2" />
                                                    )}
                                                    {editingChallenge ? 'Update Challenge' : 'Create Challenge'}
                                                </Button>
                                            )}
                                        </div>
                                            </div>{/* end right panel */}
                                        </div>{/* end split body */}
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>

                        {/* Hackathon Databases panel */}
                        {hackathonDbs.length > 0 ? (
                            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-violet-50 to-slate-50 border border-violet-200">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-violet-700 flex items-center gap-2">
                                        <Database className="w-4 h-4" /> Hackathon Databases
                                        <span className="text-xs font-normal text-slate-500">— click a database to auto-generate challenges</span>
                                    </h3>
                                    {showAutoGenerate && selectedHackathonDb && (
                                        <button
                                            onClick={() => { setShowAutoGenerate(false); setSelectedHackathonDb(null); }}
                                            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                                        >
                                            <X className="w-3.5 h-3.5" /> Close generator
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-3 flex-wrap">
                                    {hackathonDbs.map(dbEntry => (
                                        <button
                                            key={dbEntry.id}
                                            onClick={async () => {
                                                setSelectedHackathonDb(dbEntry);
                                                await loadTablesFromFile(dbEntry.file_url);
                                                setShowAutoGenerate(true);
                                            }}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all hover:shadow-md ${
                                                selectedHackathonDb?.id === dbEntry.id
                                                    ? 'border-violet-500 bg-violet-100 text-violet-700'
                                                    : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300'
                                            }`}
                                        >
                                            <Database className="w-4 h-4" />
                                            {dbEntry.name}
                                            <span className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">
                                                <Sparkles className="w-3 h-3" /> Auto Generate
                                            </span>
                                        </button>
                                    ))}
                                </div>
                                {showAutoGenerate && selectedHackathonDb && (
                                    <div className="mt-4 pt-4 border-t border-violet-200">
                                        <div className="flex items-center gap-4 mb-3">
                                            <p className="text-sm font-semibold text-violet-700 flex items-center gap-2 flex-1">
                                                <Sparkles className="w-4 h-4" /> Auto-generating for: {selectedHackathonDb.name}
                                            </p>
                                            {(hackathon?.total_rounds || 1) > 1 && (
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Assign to Round:</label>
                                                    <Select value={autoGenRound} onValueChange={setAutoGenRound}>
                                                        <SelectTrigger className="h-8 w-32 text-xs border-violet-300 bg-white">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Array.from({ length: hackathon.total_rounds }, (_, i) => (
                                                                <SelectItem key={i+1} value={String(i+1)}>Round {i+1}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                        <QuestionGenerator
                                            tables={schemaTables}
                                            hackathonId={hackathonId}
                                            onSave={async (challengeData) => {
                                                const { title, description, difficulty, points, solution_query } = challengeData;

                                                // Run solution_query to generate expected_output
                                                let expected_output = '';
                                                if (solution_query && SQL && selectedHackathonDb?.file_url) {
                                                    try {
                                                        const { fetchDbFile } = await import('@/utils/fetchDbFile');
                                                        const buf = await fetchDbFile(selectedHackathonDb.file_url);
                                                        const sqlDb = new SQL.Database(new Uint8Array(buf));
                                                        const res = sqlDb.exec(solution_query);
                                                        if (res.length > 0) {
                                                            const { columns, values } = res[0];
                                                            const rows = values.map(row => {
                                                                const obj = {};
                                                                columns.forEach((col, i) => { obj[col] = row[i]; });
                                                                return obj;
                                                            });
                                                            expected_output = JSON.stringify(rows);
                                                        } else {
                                                            expected_output = '[]';
                                                        }
                                                        sqlDb.close();
                                                    } catch (e) {
                                                        console.error('Could not generate expected output:', e);
                                                        toast.error(`SQL Error in expected output for "${title}": ${e.message}`);
                                                        return; // Don't save a broken challenge
                                                    }
                                                }

                                                await db.entities.Challenge.create({
                                                    hackathon_id: hackathonId,
                                                    title,
                                                    description,
                                                    difficulty,
                                                    points,
                                                    solution_query: solution_query || '',
                                                    expected_output,
                                                    hints: challengeData.hint ? [{ text: challengeData.hint, point_penalty: Math.max(1, Math.round((challengeData.points || 100) * 0.5)) }] : [],
                                                    required_keywords: [],
                                                    forbidden_keywords: [],
                                                    order_sensitive: false,
                                                    round_number: parseInt(autoGenRound) || 1,
                                                    database_id: selectedHackathonDb?.id || null,
                                                    database_name: selectedHackathonDb?.name || null,
                                                });
                                                queryClient.invalidateQueries(['challenges', hackathonId]);
                                            }}
                                            onQuestionsGenerated={(questions) => {
                                                queryClient.invalidateQueries(['challenges', hackathonId]);
                                                toast.success(`${questions.length} challenges generated from ${selectedHackathonDb.name}!`);
                                                setShowAutoGenerate(false);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-700">
                                <Database className="w-4 h-4 flex-shrink-0" />
                                <span>Add databases in the <strong>Database tab</strong> to enable per-database auto-generate here.</span>
                            </div>
                        )}

                        {displayedChallenges.length === 0 ? (
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-8 text-center">
                                    <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-slate-700 mb-2">
                                        {challenges.length === 0 ? 'No Challenges Yet' : 'No challenges assigned to this round'}
                                    </h3>
                                    <p className="text-slate-500">
                                        {challenges.length === 0 ? 'Add challenges for teams to solve' : 'Change the round filter or add a challenge to this round'}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {displayedChallenges.map((challenge, i) => (
                                    <motion.div
                                        key={challenge.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                    >
                                        <Card className="border-0 shadow-sm hover:shadow-md transition-all">
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                                                            {i + 1}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-slate-900">{challenge.title}</h3>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <Badge className={difficultyColors[challenge.difficulty]}>
                                                                    {challenge.difficulty}
                                                                </Badge>
                                                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                                                    <Zap className="w-3 h-3" />
                                                                    {challenge.points} pts
                                                                </span>
                                                                {challenge.database_id && (
                                                                    <Badge className="bg-blue-100 text-blue-700 gap-1 text-xs">
                                                                        <Database className="w-3 h-3" />
                                                                        {challenge.database_name || 'DB'}
                                                                    </Badge>
                                                                )}
                                                                {(hackathon?.total_rounds || 1) > 1 && (
                                                                    <Badge className="bg-emerald-100 text-emerald-700 gap-1 text-xs ml-2">
                                                                        <Layers className="w-3 h-3" />
                                                                        Round {challenge.round_number || 1}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEditChallenge(challenge)}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon">
                                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Challenge?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        This will permanently delete this challenge and all submissions.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        className="bg-red-600 hover:bg-red-700"
                                                                        onClick={() => deleteChallengeMutation.mutate(challenge.id)}
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Teams Tab */}
                    <TabsContent value="teams">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">Registered Teams ({teams.length})</h2>
                                <p className="text-sm text-slate-500">Manage teams and their database/challenge assignments</p>
                            </div>
                            <Button
                                onClick={() => setShowCsvImport(true)}
                                className="bg-violet-600 hover:bg-violet-700 flex items-center gap-2"
                            >
                                <FileJson className="w-4 h-4" /> Import Teams via CSV
                            </Button>
                        </div>

                        {/* CSV Import Dialog */}
                        <Dialog open={showCsvImport} onOpenChange={setShowCsvImport}>
                            <DialogContent className="max-w-2xl bg-slate-950 border-slate-800">
                                <DialogHeader>
                                    <DialogTitle className="text-white">Bulk Import Teams</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    {/* Format hint */}
                                    <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 font-mono">
                                        <p className="text-slate-400 mb-1 font-sans font-semibold not-italic">CSV Format (one team per line):</p>
                                        Team Name, email1@college.edu, email2@college.edu<br/>
                                        Alpha Squad, ravi@college.edu, priya@college.edu<br/>
                                        Beta Force, arjun@college.edu
                                    </div>

                                    {/* CSV input */}
                                    <Textarea
                                        value={csvText}
                                        onChange={e => handleCsvChange(e.target.value)}
                                        placeholder={`Alpha Squad, ravi@college.edu, priya@college.edu\nBeta Force, arjun@college.edu, meera@college.edu`}
                                        rows={6}
                                        className="bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-600 font-mono text-sm"
                                    />

                                    {/* Preview table */}
                                    {csvParsed.length > 0 && (
                                        <div>
                                            <p className="text-sm text-slate-400 mb-2">{csvParsed.length} team{csvParsed.length !== 1 ? 's' : ''} ready to import:</p>
                                            <div className="rounded-lg border border-slate-700 overflow-hidden max-h-52 overflow-y-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-800">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">#</th>
                                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Team Name</th>
                                                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400">Members</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {csvParsed.map((row, i) => (
                                                            <tr key={i} className="border-t border-slate-800">
                                                                <td className="px-3 py-2 text-slate-500 text-xs">{i + 1}</td>
                                                                <td className="px-3 py-2 text-slate-200 font-medium">{row.name}</td>
                                                                <td className="px-3 py-2">
                                                                    {row.members.length > 0
                                                                        ? row.members.map(m => (
                                                                            <span key={m} className="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-xs">{m}</span>
                                                                        ))
                                                                        : <span className="text-slate-500 text-xs italic">No members</span>
                                                                    }
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3 pt-2">
                                        <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800" onClick={() => setShowCsvImport(false)}>Cancel</Button>
                                        <Button
                                            className="bg-violet-600 hover:bg-violet-700"
                                            disabled={!csvParsed.length || csvImporting}
                                            onClick={handleCsvImport}
                                        >
                                            {csvImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Users className="w-4 h-4 mr-2" />}
                                            {csvImporting ? 'Importing...' : `Import ${csvParsed.length} Team${csvParsed.length !== 1 ? 's' : ''}`}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        {teams.length === 0 ? (
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-8 text-center">
                                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-semibold text-slate-700 mb-2">No Teams Yet</h3>
                                    <p className="text-slate-500">Teams will appear here once they register</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-4">
                                {teams.map((team, i) => {
                                    // Get unique databases — prefer from hackathonDbs (has file_url) then fall back to challenge.database_id
                                    const dbOptions = hackathonDbs.length > 0
                                        ? hackathonDbs.map(d => ({ id: d.id, name: d.name, file_url: d.file_url }))
                                        : [...new Map(
                                            challenges
                                                .filter(c => c.database_id)
                                                .map(c => [c.database_id, { id: c.database_id, name: c.database_name || c.database_id, file_url: null }])
                                        ).values()];

                                    // Challenges for the team's selected db
                                    const teamDbId = team.custom_db_id;
                                    const availableChallenges = teamDbId
                                        ? challenges.filter(c => c.database_id === teamDbId)
                                        : challenges;

                                    const assignedIds = team.assigned_challenge_ids || [];

                                    return (
                                        <motion.div
                                            key={team.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                        >
                                            <Card className="border-0 shadow-sm">
                                                <CardContent className="p-5">
                                                    {/* Team header */}
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div>
                                                            <h3 className="font-semibold text-slate-900 text-lg">{team.name}</h3>
                                                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                                                                <Badge variant="outline" className="font-mono">{team.join_code}</Badge>
                                                                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{team.members?.length || 1} members</span>
                                                                <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5 text-amber-500" />{team.total_score || 0} pts</span>
                                                                <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5 text-emerald-500" />{team.challenges_completed || 0} solved</span>
                                                            </div>
                                                            {team.member_scores && Object.keys(team.member_scores).length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mt-3">
                                                                    {Object.entries(team.member_scores).map(([email, score]) => {
                                                                        // Try to lookup the member's display name from the team.members array
                                                                        const memberName = team.members?.find(m => m.email === email)?.name || email.split('@')[0];
                                                                        return (
                                                                            <Badge key={email} variant="secondary" className="text-xs bg-slate-100 text-slate-600 border border-slate-200">
                                                                                <span className="font-medium mr-1">{memberName}:</span> 
                                                                                <span className="font-bold text-emerald-600">{score} pts</span>
                                                                            </Badge>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                            {(() => {
                                                                const v = getTeamViolations(team.id);
                                                                if (v.totalViolations === 0) return null;
                                                                return (
                                                                    <div className="flex items-center gap-1.5 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 mr-2">
                                                                        <AlertTriangle className="w-4 h-4" />
                                                                        <span className="font-medium">{v.totalViolations} violations</span>
                                                                    </div>
                                                                );
                                                            })()}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={async () => {
                                                                    if (window.confirm(`Are you sure you want to delete the team "${team.name}"? This action cannot be undone.`)) {
                                                                        const { error } = await supabase.from('teams').delete().eq('id', team.id);
                                                                        if (error) {
                                                                            toast.error('Failed to delete team');
                                                                        } else {
                                                                            toast.success('Team deleted successfully');
                                                                            queryClient.invalidateQueries(['teams', hackathonId]);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>

                                                    {/* Admin Disqualification Action Banner */}
                                                    {(() => {
                                                        const v = getTeamViolations(team.id);
                                                        const needsIntervention = team.status === 'disqualified' || v.fullscreenExits >= 3;
                                                        
                                                        if (!needsIntervention) return null;

                                                        return (
                                                            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                                                <div>
                                                                    <div className="flex items-center gap-2 text-red-700 font-bold">
                                                                        <AlertTriangle className="w-5 h-5" />
                                                                        ACTION REQUIRED: Disqualified Team
                                                                    </div>
                                                                    <p className="text-sm text-red-600 mt-1">
                                                                        {team.status === 'disqualified' 
                                                                            ? "This team has been permanently disqualified." 
                                                                            : "This team has exceeded the maximum fullscreen exits (3/3) and is locked out."}
                                                                    </p>
                                                                </div>
                                                                
                                                                <div className="flex gap-2 w-full md:w-auto">
                                                                    <Button 
                                                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-sm"
                                                                        onClick={async () => {
                                                                            if (window.confirm("Permanently disqualify this team? Their score will be set to 0 and they will not be able to re-enter.")) {
                                                                                await supabase.from('teams').update({ status: 'disqualified', total_score: 0, round_scores: {} }).eq('id', team.id);
                                                                                toast.success(`Team ${team.name} has been graded as 0.`);
                                                                                queryClient.invalidateQueries(['teams', hackathonId]);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <X className="w-4 h-4 mr-2" />
                                                                        Grade as 0
                                                                    </Button>
                                                                    
                                                                    <Button 
                                                                        className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm"
                                                                        onClick={async () => {
                                                                            if (window.confirm("Forgive this team? Their violations will be wiped and they can re-enter the contest.")) {
                                                                                // Wipe backend database violations so the TeamDashboard can detect it and wipe local storage
                                                                                await supabase.from('teams').update({ status: 'active', violations: {} }).eq('id', team.id);
                                                                                toast.success(`Team ${team.name} has been forgiven.`);
                                                                                queryClient.invalidateQueries(['teams', hackathonId]);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                                                                        Forgive
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                                        {/* Database assignment */}
                                                        <div className="space-y-2">
                                                            <Label className="flex items-center gap-1.5 text-slate-700">
                                                                <Database className="w-3.5 h-3.5 text-blue-500" />
                                                                Assigned Database
                                                            </Label>
                                                            <Select
                                                                value={team.custom_db_id ? String(team.custom_db_id) : '__default__'}
                                                                onValueChange={async (val) => {
                                                                    const newId = val === '__default__' ? null : val;
                                                                    const chosenDb = dbOptions.find(d => String(d.id) === String(newId));
                                                                    const { error } = await supabase
                                                                        .from('teams')
                                                                        .update({
                                                                            custom_db_id: chosenDb?.id || null, // ensure type is correct
                                                                            custom_db_url: chosenDb?.file_url || null,
                                                                            assigned_challenge_ids: []
                                                                        })
                                                                        .eq('id', team.id);
                                                                    if (!error) {
                                                                        queryClient.invalidateQueries(['teams', hackathonId]);
                                                                        toast.success(`DB updated for ${team.name}`);
                                                                    }
                                                                }}
                                                            >
                                                                <SelectTrigger className="bg-slate-50">
                                                                    <SelectValue placeholder="Use hackathon default" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(() => {
                                                                        const defaultDbName = hackathon?.database_source === 'library'
                                                                            ? hackathonDbs.find(d => d.file_url === hackathon.database_file_url)?.name || 'Library Database'
                                                                            : 'Own Database (Manual/File)';
                                                                        return (
                                                                            <SelectItem value="__default__">🌐 Default ({defaultDbName})</SelectItem>
                                                                        );
                                                                    })()}
                                                                    {dbOptions.map(db => (
                                                                        <SelectItem key={db.id} value={String(db.id)}>{db.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            {team.custom_db_id && (
                                                                <p className="text-xs text-blue-600">Custom DB assigned</p>
                                                            )}
                                                        </div>

                                                        {/* Challenge assignment */}
                                                        <div className="space-y-2">
                                                            <Label className="flex items-center gap-1.5 text-slate-700">
                                                                <Target className="w-3.5 h-3.5 text-emerald-500" />
                                                                Assigned Challenges
                                                                <span className="text-xs text-slate-400 font-normal ml-auto">
                                                                    {assignedIds.length === 0 ? 'All (default)' : `${assignedIds.length} selected`}
                                                                </span>
                                                            </Label>
                                                            <div className="max-h-36 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-slate-50">
                                                                {availableChallenges.length === 0 ? (
                                                                    <p className="text-xs text-slate-400 text-center py-2">No challenges yet</p>
                                                                ) : (
                                                                    availableChallenges.map(ch => {
                                                                        const isChecked = assignedIds.length === 0 || assignedIds.includes(ch.id);
                                                                        return (
                                                                            <label key={ch.id} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded p-1 transition-colors">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={isChecked}
                                                                                    className="w-3.5 h-3.5 rounded accent-emerald-500"
                                                                                    onChange={async (e) => {
                                                                                        let newIds;
                                                                                        if (assignedIds.length === 0) {
                                                                                            // Start from all, remove this one
                                                                                            newIds = availableChallenges
                                                                                                .map(c => c.id)
                                                                                                .filter(id => id !== ch.id);
                                                                                        } else if (e.target.checked) {
                                                                                            newIds = [...assignedIds, ch.id];
                                                                                            if (newIds.length === availableChallenges.length) newIds = [];
                                                                                        } else {
                                                                                            newIds = assignedIds.filter(id => id !== ch.id);
                                                                                        }
                                                                                        await supabase.from('teams')
                                                                                            .update({ assigned_challenge_ids: newIds })
                                                                                            .eq('id', team.id);
                                                                                        queryClient.invalidateQueries(['teams', hackathonId]);
                                                                                    }}
                                                                                />
                                                                                <span className="text-xs flex-1 truncate text-slate-700">{ch.title}</span>
                                                                                <Badge className={`text-[10px] px-1 py-0 ${ch.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : ch.difficulty === 'hard' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                                    {ch.difficulty}
                                                                                </Badge>
                                                                            </label>
                                                                        );
                                                                    })
                                                                )}
                                                            </div>
                                                            {assignedIds.length > 0 && (
                                                                <button
                                                                    className="text-xs text-slate-400 hover:text-slate-600 underline"
                                                                    onClick={async () => {
                                                                        await supabase.from('teams').update({ assigned_challenge_ids: [] }).eq('id', team.id);
                                                                        queryClient.invalidateQueries(['teams', hackathonId]);
                                                                    }}
                                                                >
                                                                    Reset to all challenges
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Anti-Cheat Violations */}
                                                    {(() => {
                                                        const { totalViolations, tabSwitches, pastes, fullscreenExits } = getTeamViolations(team.id);
                                                        const risk = totalViolations >= 10 ? 'high' : totalViolations >= 3 ? 'medium' : 'low';
                                                        const riskColors = {
                                                            high: 'bg-red-50 border-red-200',
                                                            medium: 'bg-amber-50 border-amber-200',
                                                            low: 'bg-emerald-50 border-emerald-200',
                                                        };
                                                        const badgeColors = {
                                                            high: 'bg-red-100 text-red-700',
                                                            medium: 'bg-amber-100 text-amber-700',
                                                            low: 'bg-emerald-100 text-emerald-700',
                                                        };
                                                        return (
                                                            <div className={`mt-4 p-3 rounded-lg border ${riskColors[risk]}`}>
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                                                                        🛡️ Anti-Cheat Monitor
                                                                        <span className="text-[9px] text-emerald-600 font-normal ml-1 border border-emerald-300 rounded px-1">● LIVE</span>
                                                                    </span>
                                                                    <Badge className={`text-[10px] px-2 py-0.5 ${badgeColors[risk]}`}>
                                                                        {risk === 'high' ? '⚠️ High Risk' : risk === 'medium' ? '⚡ Medium Risk' : '✅ Clean'}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex gap-4 text-xs text-slate-600 flex-wrap">
                                                                    <span>🔄 Tab switches: <strong>{tabSwitches}</strong></span>
                                                                    <span>📋 Pastes: <strong>{pastes}</strong></span>
                                                                    {fullscreenExits > 0 && <span>📺 Fullscreen exits: <strong>{fullscreenExits}</strong></span>}
                                                                    <span>⚠️ Total events: <strong>{totalViolations}</strong></span>
                                                                </div>
                                                                {totalViolations === 0 && (
                                                                    <p className="text-xs text-emerald-600 mt-1">No suspicious activity detected.</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>

                    {/* Leaderboard Tab */}
                    <TabsContent value="leaderboard">
                        <Leaderboard teams={teams} />
                    </TabsContent>

                    {/* Database Tab */}
                    {/* Database Tab */}
                    <TabsContent value="database">
                        
                        {/* ── DEFAULT DATABASE CONFIGURATION ── */}
                        <Card className="mb-6 border-emerald-500/30 bg-emerald-50/50 shadow-sm">
                            <CardHeader className="pb-3 border-b border-emerald-500/10">
                                <CardTitle className="text-emerald-800 flex items-center gap-2 text-lg">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    Default Hackathon Database
                                </CardTitle>
                                <p className="text-sm text-emerald-700/80">
                                    This database will be assigned to all teams unless explicitly overridden in the Teams tab.
                                </p>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <Select
                                    value={
                                        hackathon?.database_source === 'library'
                                            ? String(hackathonDbs.find(d => d.file_url === hackathon.database_file_url)?.id || 'own')
                                            : 'own'
                                    }
                                    onValueChange={(val) => {
                                        if (val === 'own') {
                                            updateHackathonMutation.mutate({
                                                database_source: 'manual',
                                                database_file_url: uploadedFileUrl || '',
                                                database_schema: dbSchema || '',
                                                sample_data: sampleData || ''
                                            });
                                            setDbSource('manual');
                                        } else {
                                            const selectedDb = hackathonDbs.find(d => String(d.id) === val);
                                            if (selectedDb) {
                                                updateHackathonMutation.mutate({
                                                    database_source: 'library',
                                                    database_file_url: selectedDb.file_url,
                                                    database_schema: '',
                                                    sample_data: ''
                                                });
                                                setDbSource('library');
                                            }
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-full md:w-[400px] bg-white border-emerald-200 shadow-sm">
                                        <SelectValue placeholder="Select Default Database" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="own">
                                            <div className="flex items-center gap-2 w-full text-slate-700">
                                                <Edit2 className="w-4 h-4 text-emerald-600" />
                                                Own Database (Manual SQL / Direct Upload)
                                            </div>
                                        </SelectItem>
                                        {hackathonDbs.length > 0 && (
                                            <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase mt-1 border-t">
                                                Hackathon Library Databases
                                            </div>
                                        )}
                                        {hackathonDbs.map(db => (
                                            <SelectItem key={db.id} value={String(db.id)}>
                                                <div className="flex items-center gap-2 w-full text-blue-700 font-medium">
                                                    <Database className="w-4 h-4 text-blue-500" />
                                                    {db.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>

                        {/* Top-level choice: Own DB vs Library */}
                        <div className="flex gap-3 mb-6">
                            <button
                                onClick={() => { if (dbSource === 'library') setDbSource('file'); }}
                                className={`flex-1 flex items-center gap-3 p-5 rounded-2xl border-2 text-left transition-all ${
                                    dbSource !== 'library'
                                        ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                                }`}
                            >
                                <div className={`p-3 rounded-xl ${dbSource !== 'library' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                    <Database className={`w-6 h-6 ${dbSource !== 'library' ? 'text-emerald-600' : 'text-slate-500'}`} />
                                </div>
                                <div>
                                    <div className={`font-semibold ${dbSource !== 'library' ? 'text-emerald-800' : 'text-slate-800'}`}>Use Your Own Database</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Write SQL manually or upload a .db file</div>
                                </div>
                                {dbSource !== 'library' && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto flex-shrink-0" />}
                            </button>

                            <button
                                onClick={() => setDbSource('library')}
                                className={`flex-1 flex items-center gap-3 p-5 rounded-2xl border-2 text-left transition-all ${
                                    dbSource === 'library'
                                        ? 'border-blue-500 bg-blue-50 shadow-md'
                                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                                }`}
                            >
                                <div className={`p-3 rounded-xl ${dbSource === 'library' ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                    <FileJson className={`w-6 h-6 ${dbSource === 'library' ? 'text-blue-600' : 'text-slate-500'}`} />
                                </div>
                                <div>
                                    <div className={`font-semibold ${dbSource === 'library' ? 'text-blue-800' : 'text-slate-800'}`}>Use Database Library</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Pick from existing public databases</div>
                                </div>
                                {dbSource === 'library' && <CheckCircle2 className="w-5 h-5 text-blue-500 ml-auto flex-shrink-0" />}
                            </button>
                        </div>

                        {/* ── OWN DATABASE ── */}
                        {dbSource !== 'library' && (
                            <div className="space-y-4">
                                {/* Sub-options: Manual vs Upload */}
                                <div className="flex gap-2 p-1 rounded-xl bg-slate-900 border border-slate-800 w-fit">
                                    <button
                                        onClick={() => setDbSource('manual')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${dbSource === 'manual' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        <Edit2 className="w-4 h-4" /> Write SQL Manually
                                    </button>
                                    <button
                                        onClick={() => setDbSource('file')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${dbSource === 'file' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        <Upload className="w-4 h-4" /> Upload File
                                    </button>
                                </div>

                                {/* Manual SQL Entry */}
                                {dbSource === 'manual' && (
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <Card className="border-0 shadow-lg">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Database className="w-5 h-5 text-emerald-500" />
                                                    Database Schema
                                                </CardTitle>
                                                <p className="text-sm text-slate-500">Define the SQL schema (CREATE TABLE statements)</p>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <CodeEditor
                                                    value={dbSchema}
                                                    onChange={setDbSchema}
                                                    placeholder={`-- Example schema:\nCREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  email TEXT UNIQUE,\n  age INTEGER\n);\n\nCREATE TABLE orders (\n  id INTEGER PRIMARY KEY,\n  user_id INTEGER,\n  product TEXT,\n  amount DECIMAL(10,2),\n  order_date DATE\n);`}
                                                    className="min-h-[300px]"
                                                />
                                                <Button
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => updateHackathonMutation.mutate({ database_schema: dbSchema, database_source: 'manual' })}
                                                >
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Save Schema
                                                </Button>
                                            </CardContent>
                                        </Card>

                                        <Card className="border-0 shadow-lg">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Database className="w-5 h-5 text-blue-500" />
                                                    Sample Data
                                                </CardTitle>
                                                <p className="text-sm text-slate-500">INSERT statements to populate the database</p>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <CodeEditor
                                                    value={sampleData}
                                                    onChange={setSampleData}
                                                    placeholder={`-- Example data:\nINSERT INTO users (id, name, email, age) VALUES\n  (1, 'John Doe', 'john@example.com', 28),\n  (2, 'Jane Smith', 'jane@example.com', 34);\n\nINSERT INTO orders (id, user_id, product, amount, order_date) VALUES\n  (1, 1, 'Laptop', 999.99, '2024-01-15'),\n  (2, 1, 'Mouse', 29.99, '2024-01-16');`}
                                                    className="min-h-[300px]"
                                                />
                                                <Button
                                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                                    onClick={() => updateHackathonMutation.mutate({ sample_data: sampleData, database_source: 'manual' })}
                                                >
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Save Sample Data
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* ── Save manual SQL to library ── */}
                                {dbSource === 'manual' && (dbSchema || hackathon?.database_schema) && (
                                    <Card className="border border-violet-500/30 bg-violet-950/20 shadow-lg">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="flex items-center gap-2 text-violet-300 text-base">
                                                <Database className="w-4 h-4" />
                                                Save to Database Library
                                            </CardTitle>
                                            <p className="text-xs text-slate-400">
                                                Export this schema + data as a reusable database entry in the library.
                                            </p>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                                <Input
                                                    className="flex-1 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                                                    placeholder="Database name (e.g. Sales DB 2024)"
                                                    value={saveLibName}
                                                    onChange={e => setSaveLibName(e.target.value)}
                                                />
                                                {/* Public / Private toggle */}
                                                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-700 flex-shrink-0">
                                                    <button
                                                        onClick={() => setSaveLibPublic(false)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                                            !saveLibPublic ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                                                        }`}
                                                    >
                                                        <Lock className="w-3 h-3" /> Private
                                                    </button>
                                                    <button
                                                        onClick={() => setSaveLibPublic(true)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                                            saveLibPublic ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                                                        }`}
                                                    >
                                                        <Globe className="w-3 h-3" /> Public
                                                    </button>
                                                </div>
                                                <Button
                                                    disabled={isSavingToLib || !SQL}
                                                    className="bg-violet-600 hover:bg-violet-700 flex-shrink-0"
                                                    onClick={async () => {
                                                        if (!SQL) return;
                                                        const name = saveLibName.trim() || hackathon?.title || 'Untitled DB';
                                                        setIsSavingToLib(true);
                                                        try {
                                                            // Build SQLite DB from schema + data
                                                            const database = new SQL.Database();
                                                            const schema = dbSchema || hackathon?.database_schema || '';
                                                            const data = sampleData || hackathon?.sample_data || '';
                                                            if (schema) database.run(schema);
                                                            if (data) database.run(data);
                                                            const bytes = database.export();
                                                            database.close();
                                                            const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
                                                            const fileName = `library/${Date.now()}_${name.replace(/\s+/g, '_')}.db`;
                                                            const { data: { session } } = await supabase.auth.getSession();
                                                            if (!session) throw new Error('Not authenticated');
                                                            // Upload to storage
                                                            await new Promise((resolve, reject) => {
                                                                const xhr = new XMLHttpRequest();
                                                                xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/hackathon-assets/${fileName}`);
                                                                xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
                                                                xhr.setRequestHeader('x-upsert', 'true');
                                                                xhr.setRequestHeader('Content-Type', 'application/x-sqlite3');
                                                                xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed'));
                                                                xhr.onerror = () => reject(new Error('Network error'));
                                                                xhr.send(blob);
                                                            });
                                                            const { data: { publicUrl } } = supabase.storage.from('hackathon-assets').getPublicUrl(fileName);
                                                            const { error } = await supabase
                                                                .from('database_library')
                                                                .insert({ name, file_url: publicUrl, uploaded_by: session.user.id, is_public: saveLibPublic });
                                                            if (error) throw error;
                                                            toast.success(`"${name}" saved to library as ${saveLibPublic ? 'public' : 'private'}!`);
                                                            setSaveLibName('');
                                                        } catch (e) {
                                                            toast.error(`Failed to save: ${e.message}`);
                                                        } finally {
                                                            setIsSavingToLib(false);
                                                        }
                                                    }}
                                                >
                                                    {isSavingToLib ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                                    Save to Library
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Upload File */}
                                {dbSource === 'file' && (
                                    <div className="space-y-6">
                                        <Card className="border-0 shadow-lg bg-slate-900">
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2 text-white">
                                                    <Database className="w-5 h-5 text-blue-400" />
                                                    Your Database Library
                                                </CardTitle>
                                                <p className="text-sm text-slate-400">
                                                    Upload a new database or select one you've already uploaded.
                                                </p>
                                            </CardHeader>
                                            <CardContent>
                                                <DatabaseManager
                                                    selectedUrl={uploadedFileUrl}
                                                    SQL={SQL}
                                                    onSelect={async (url) => {
                                                        setUploadedFileUrl(url);
                                                        setDbSource('file');
                                                        await updateHackathonMutation.mutateAsync({
                                                            database_source: 'file',
                                                            database_file_url: url,
                                                            database_schema: '',
                                                            sample_data: ''
                                                        });
                                                        toast.success('Hackathon database updated!');
                                                    }}
                                                    onLargeFileExtract={async (schemaSQL, dataSQL, tableStats) => {
                                                        const totalRows = tableStats.reduce((s, t) => s + t.extracted, 0);
                                                        await updateHackathonMutation.mutateAsync({
                                                            database_source: 'file',
                                                            database_schema: schemaSQL,
                                                            sample_data: dataSQL,
                                                            database_file_url: ''
                                                        });
                                                        setSchemaTables(parseTables(schemaSQL));
                                                        toast.success(`Extracted ${tableStats.length} tables (${totalRows} rows) from large file`);
                                                    }}
                                                    showOnlyOwn={true}
                                                    onAddToHackathon={addDbToHackathon}
                                                    hackathonDbIds={hackathonDbIds}
                                                />
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                            </div>
                        )}

                        {/* ── DATABASE LIBRARY ── */}
                        {dbSource === 'library' && (
                            <div className="space-y-4">
                                {/* Active database indicator */}
                                {(uploadedFileUrl || hackathon.database_file_url) && (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                        <span className="text-sm text-emerald-300">Active database set from library</span>
                                        <button
                                            onClick={() => setDbSource('file')}
                                            className="ml-auto text-xs text-slate-400 hover:text-white underline"
                                        >
                                            Switch to own database
                                        </button>
                                    </div>
                                )}

                                <Card className="border-0 shadow-lg bg-slate-900">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-white">
                                            <FileJson className="w-5 h-5 text-blue-400" />
                                            Public Database Library
                                        </CardTitle>
                                        <p className="text-sm text-slate-400">
                                            Browse databases shared publicly by all admins. Select one to use for this hackathon.
                                        </p>
                                    </CardHeader>
                                    <CardContent>
                                        <DatabaseManager
                                            selectedUrl={uploadedFileUrl || hackathon.database_file_url}
                                            SQL={SQL}
                                            showOnlyPublic={true}
                                            onSelect={async (url) => {
                                                setUploadedFileUrl(url);
                                                await updateHackathonMutation.mutateAsync({
                                                    database_source: 'file',
                                                    database_file_url: url,
                                                    database_schema: '',
                                                    sample_data: ''
                                                });
                                                toast.success('Library database selected!');
                                            }}
                                            onAddToHackathon={addDbToHackathon}
                                            hackathonDbIds={hackathonDbIds}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* ── HACKATHON DATABASES LIST ── */}
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4 text-violet-500" />
                                Databases in this Hackathon
                                <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-violet-100 text-violet-700 font-bold">{hackathonDbs.length}</span>
                            </h3>
                            {hackathonDbs.length === 0 ? (
                                <div className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-sm">
                                    No databases added yet — click &ldquo;Add&rdquo; on any database card above
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {hackathonDbs.map(dbEntry => (
                                        <div
                                            key={dbEntry.id}
                                            className="group relative rounded-xl p-4 bg-white border border-violet-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
                                            onClick={() => {
                                                setSelectedHackathonDb(dbEntry);
                                                loadTablesFromFile(dbEntry.file_url).then(() => {});
                                            }}
                                        >
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeDbFromHackathon(dbEntry.id); }}
                                                className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 hover:bg-red-50"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-violet-100">
                                                    <Database className="w-4 h-4 text-violet-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-800 text-sm truncate">{dbEntry.name}</p>
                                                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                        {dbEntry.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                        {dbEntry.is_public ? 'Public' : 'Private'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── DATABASE BROWSER (always visible) ── */}
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4" /> Database Browser
                                {selectedHackathonDb && (
                                    <span className="ml-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-semibold normal-case">
                                        {selectedHackathonDb.name}
                                    </span>
                                )}
                            </h3>
                            {selectedHackathonDb ? (
                                /* Show the clicked hackathon DB */
                                <AdminDbPreview dbFileUrl={selectedHackathonDb.file_url} />
                            ) : dbSource === 'manual' ? (
                                (dbSchema || hackathon?.database_schema || sampleData || hackathon?.sample_data) ? (
                                    <AdminDbPreview
                                        schema={dbSchema || hackathon?.database_schema}
                                        sampleData={sampleData || hackathon?.sample_data}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-32 rounded-xl border-2 border-dashed border-slate-700 text-slate-500 text-sm">
                                        Write your SQL schema above to see the database browser here
                                    </div>
                                )
                            ) : (
                                (uploadedFileUrl || hackathon?.database_file_url) ? (
                                    <AdminDbPreview
                                        dbFileUrl={uploadedFileUrl || hackathon?.database_file_url}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-32 rounded-xl border-2 border-dashed border-slate-700 text-slate-500 text-sm">
                                        Select a database above to preview its tables here
                                    </div>
                                )
                            )}
                        </div>

                        <Card className="border-0 shadow-lg mt-6">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-amber-100">
                                        <Zap className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-slate-900">How it works</h4>
                                        <p className="text-sm text-slate-500 mt-1">
                                            Each team gets their own in-memory SQLite database loaded with your schema and sample data.
                                            Teams can run queries to test their solutions before submitting.
                                            The database resets if the page is refreshed.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>



                    {/* Settings Tab */}
                    <TabsContent value="settings">
                        {/* ── Hackathon Join Code ── */}
                        <Card className="border-0 shadow-lg mb-6 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-xl bg-violet-100 flex-shrink-0">
                                        <UserPlus className="w-6 h-6 text-violet-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-900 text-lg mb-1">Student Join Code</h3>
                                        <p className="text-sm text-slate-500 mb-4">
                                            Share this code with students. They enter it on the platform to land directly on the team registration page for this hackathon.
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 flex items-center gap-3 bg-white rounded-xl border-2 border-violet-200 px-4 py-3">
                                                <code className="text-2xl font-bold tracking-[0.3em] text-violet-700 flex-1 text-center">
                                                    {hackathon.hackathon_code || '——'}
                                                </code>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="border-violet-300 text-violet-700 hover:bg-violet-100 h-14 px-4"
                                                disabled={!hackathon.hackathon_code}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(hackathon.hackathon_code);
                                                    toast.success('Join code copied!');
                                                }}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                className="bg-violet-600 hover:bg-violet-700 h-14 px-4"
                                                onClick={() => {
                                                    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
                                                    updateHackathonMutation.mutate({ hackathon_code: code });
                                                    toast.success('New code generated!');
                                                }}
                                            >
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                {hackathon.hackathon_code ? 'Regenerate' : 'Generate Code'}
                                            </Button>
                                        </div>
                                        {hackathon.hackathon_code && (
                                            <p className="text-xs text-slate-400 mt-3">
                                                Students go to <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{window.location.origin}</span> → enter code <span className="font-mono font-bold text-violet-600">{hackathon.hackathon_code}</span> → land on team creation page
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle>Hackathon Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select
                                        value={hackathon.status}
                                        onValueChange={(v) => {
                                            setPendingStatus(v);
                                            setShowStatusConfirmDialog(true);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="draft">Draft</SelectItem>
                                            <SelectItem value="registration_open">Registration Open</SelectItem>
                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                            <SelectItem value="completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {/* Status Change Confirmation */}
                                    <AlertDialog open={showStatusConfirmDialog} onOpenChange={setShowStatusConfirmDialog}>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Change Hackathon Status?</AlertDialogTitle>
                                                <AlertDialogDescription className="space-y-2">
                                                    <p>Are you sure you want to change the status to <strong>{pendingStatus?.replace('_', ' ')}</strong>?</p>
                                                    {pendingStatus === 'in_progress' && (
                                                        <p className="text-amber-600 font-medium">⚠️ This will start the contest. Participants will be able to see challenges and start their timers.</p>
                                                    )}
                                                    {pendingStatus === 'completed' && (
                                                        <p className="text-red-600 font-medium">⚠️ This will end the contest immediately. No further submissions will be allowed.</p>
                                                    )}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel onClick={() => setPendingStatus(null)}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => {
                                                        if (pendingStatus) {
                                                            updateHackathonMutation.mutate({ status: pendingStatus });
                                                        }
                                                        setPendingStatus(null);
                                                        setShowStatusConfirmDialog(false);
                                                    }}
                                                >
                                                    Confirm Change
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>

                                <div className="space-y-2">
                                    <Label>Max Teams</Label>
                                    <Input
                                        type="number"
                                        defaultValue={hackathon.max_teams || 50}
                                        onBlur={(e) => updateHackathonMutation.mutate({ max_teams: parseInt(e.target.value) })}
                                    />
                                </div>

                                {/* Number of Rounds */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1.5">
                                        <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                        Number of Rounds
                                    </Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={10}
                                        defaultValue={hackathon.total_rounds || 1}
                                        onBlur={(e) => {
                                            const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                                            // Build default rounds_config if not already set
                                            const existing = hackathon.rounds_config || [];
                                            const newConfig = Array.from({ length: val }, (_, i) => {
                                                const rn = i + 1;
                                                return existing.find(r => r.round_number === rn) || {
                                                    round_number: rn,
                                                    name: `Round ${rn}`,
                                                    status: rn === 1 ? 'upcoming' : 'upcoming',
                                                    qualification_score: null
                                                };
                                            });
                                            updateHackathonMutation.mutate({
                                                total_rounds: val,
                                                rounds_config: newConfig,
                                                current_round: hackathon.current_round || 1
                                            });
                                        }}
                                    />
                                    <p className="text-xs text-slate-400">
                                        Set to 1 for a standard single-round hackathon. Up to 10 rounds supported.
                                        After saving, go to the <strong>Rounds</strong> tab to manage each round.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Start Time</Label>
                                        <Input
                                            type="datetime-local"
                                            defaultValue={formatDatetimeLocal(hackathon.start_time)}
                                            onBlur={(e) => updateHackathonMutation.mutate({ start_time: e.target.value ? new Date(e.target.value).toISOString() : null })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Duration</Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Select
                                                defaultValue={(() => {
                                                    if (!hackathon.start_time || !hackathon.end_time) return '';
                                                    const mins = Math.round((new Date(hackathon.end_time) - new Date(hackathon.start_time)) / 60000);
                                                    const opts = [30, 60, 90, 120, 180, 240, 360];
                                                    return opts.includes(mins) ? String(mins) : 'custom';
                                                })()}
                                                onValueChange={(val) => {
                                                    if (val === 'custom' || !val) return;
                                                    const base = hackathon.start_time ? new Date(hackathon.start_time) : new Date();
                                                    const endTime = new Date(base.getTime() + parseInt(val) * 60000);
                                                    updateHackathonMutation.mutate({ end_time: endTime.toISOString() });
                                                    toast.success(`Contest duration set to ${val >= 60 ? val / 60 + 'h' : val + 'm'}`);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Pick duration…" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="30">30 minutes</SelectItem>
                                                    <SelectItem value="60">1 hour</SelectItem>
                                                    <SelectItem value="90">1.5 hours</SelectItem>
                                                    <SelectItem value="120">2 hours</SelectItem>
                                                    <SelectItem value="180">3 hours</SelectItem>
                                                    <SelectItem value="240">4 hours</SelectItem>
                                                    <SelectItem value="360">6 hours</SelectItem>
                                                    <SelectItem value="custom">Custom end time</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 rounded-md px-3 border">
                                                <span className="text-xs text-slate-400">Ends:</span>
                                                <span className="font-medium text-slate-700">
                                                    {hackathon.end_time
                                                        ? new Date(hackathon.end_time).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                                                        : '—'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Duration is calculated from start time. Submissions are automatically blocked when time runs out.
                                        </p>
                                    </div>
                                </div>

                                {/* Publish Results */}
                                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-slate-900">Publish Results</h4>
                                            <p className="text-sm text-slate-500 mt-0.5">
                                                {hackathon.results_published
                                                    ? 'Results are visible to all participants'
                                                    : 'Results are hidden from participants'}
                                            </p>
                                        </div>
                                        <Button
                                            className={hackathon.results_published
                                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                                : 'bg-amber-600 hover:bg-amber-700'}
                                            onClick={() => updateHackathonMutation.mutate({
                                                results_published: !hackathon.results_published
                                            })}
                                        >
                                            {hackathon.results_published ? '✅ Published' : '📢 Publish Now'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Certificate Settings & Preview */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="p-4 rounded-lg border border-purple-100 bg-purple-50/50">
                                        <h4 className="font-semibold text-slate-900 flex items-center gap-2 mb-1">
                                            🎓 Certificate Settings
                                        </h4>
                                        <p className="text-sm text-slate-500 mb-4">Customize how generated certificates look for participants.</p>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <Label className="text-sm">Organizer Name</Label>
                                                <Input
                                                    value={certSettings?.organizerName || ''}
                                                    placeholder="SQL Spark Team"
                                                    onChange={(e) => handleCertChange('organizerName', e.target.value)}
                                                    onBlur={handleCertBlur}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <Label className="text-sm">College / Institution Name</Label>
                                                <Input
                                                    value={certSettings?.collegeName || ''}
                                                    placeholder="e.g., R.G.M College of Engineering & Technology"
                                                    onChange={(e) => handleCertChange('collegeName', e.target.value)}
                                                    onBlur={handleCertBlur}
                                                />
                                            </div>

                                            <div className="space-y-1">
                                                <Label className="text-sm">Custom Sub-text (Optional)</Label>
                                                <Input
                                                    value={certSettings?.customText || ''}
                                                    placeholder="e.g., In association with CSI Student Chapter"
                                                    onChange={(e) => handleCertChange('customText', e.target.value)}
                                                    onBlur={handleCertBlur}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label className="text-sm">Signature Name</Label>
                                                    <Input
                                                        value={certSettings?.signatureName || ''}
                                                        placeholder="e.g., Dr. John Doe"
                                                        onChange={(e) => handleCertChange('signatureName', e.target.value)}
                                                        onBlur={handleCertBlur}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-sm">Signature Role</Label>
                                                    <Input
                                                        value={certSettings?.signatureRole || ''}
                                                        placeholder="e.g., HEAD OF DEPARTMENT"
                                                        onChange={(e) => handleCertChange('signatureRole', e.target.value)}
                                                        onBlur={handleCertBlur}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-2">
                                                <div className="space-y-1">
                                                    <Label className="text-sm flex items-center gap-1.5">
                                                        <span style={{ background: certSettings?.winnerAccent || '#fbbf24', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }} />
                                                        Winner Accent Color
                                                    </Label>
                                                    <input
                                                        type="color"
                                                        value={certSettings?.winnerAccent || '#fbbf24'}
                                                        className="w-full h-9 rounded-md border cursor-pointer"
                                                        onChange={(e) => handleCertChange('winnerAccent', e.target.value)}
                                                        onBlur={handleCertBlur}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-sm flex items-center gap-1.5">
                                                        <span style={{ background: certSettings?.participationAccent || '#34d399', width: 12, height: 12, borderRadius: '50%', display: 'inline-block' }} />
                                                        Participation Accent Color
                                                    </Label>
                                                    <input
                                                        type="color"
                                                        value={certSettings?.participationAccent || '#34d399'}
                                                        className="w-full h-9 rounded-md border cursor-pointer"
                                                        onChange={(e) => handleCertChange('participationAccent', e.target.value)}
                                                        onBlur={handleCertBlur}
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400">Changes are saved automatically when you click away from inputs.</p>
                                        </div>
                                    </div>

                                    {/* Preview pane */}
                                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col pt-8">
                                        <h4 className="font-semibold text-slate-700 w-full mb-4 pl-4 text-center">Live Preview</h4>
                                        <div style={{ transform: 'scale(0.45)', transformOrigin: 'top center', height: 290, width: '100%', maxWidth: 405, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
                                            <Certificate
                                                type="winner"
                                                recipientName="Student Name"
                                                teamName="Example Team"
                                                hackathonTitle={hackathon.title}
                                                date={(new Date()).toLocaleDateString()}
                                                rank={1}
                                                certSettings={certSettings || {}}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-400 mt-2 text-center">Preview of 1st Place Winner Certificate</p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t mt-8">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive" className="w-full">
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete Hackathon
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Hackathon?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete this hackathon and all associated data.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    className="bg-red-600 hover:bg-red-700"
                                                    onClick={async () => {
                                                        await db.entities.Hackathon.delete(hackathonId);
                                                        navigate(createPageUrl('AdminDashboard'));
                                                    }}
                                                >
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── ROUNDS TAB ── */}
                    <TabsContent value="rounds">
                        {(() => {
                            const totalRounds = hackathon.total_rounds || 1;
                            const currentRound = hackathon.current_round || 1;
                            const roundsConfig = hackathon.rounds_config || [];

                            const startRound = async (roundNumber) => {
                                const newConfig = roundsConfig.map(r =>
                                    r.round_number === roundNumber
                                        ? { ...r, status: 'active' }
                                        : r
                                );
                                await updateHackathonMutation.mutateAsync({
                                    rounds_config: newConfig,
                                    current_round: roundNumber
                                });
                                toast.success(`Round ${roundNumber} is now active!`);
                            };

                            const endRound = async (roundNumber, qualScore) => {
                                setIsEndingRound(true);
                                try {
                                    const threshold = parseInt(qualScore) || 0;

                                    // 1. Mark round as completed
                                    const newConfig = roundsConfig.map(r =>
                                        r.round_number === roundNumber
                                            ? { ...r, status: 'completed', qualification_score: threshold }
                                            : r
                                    );

                                    // 2. Qualify/disqualify teams based on cumulative score
                                    let qualCount = 0, disqualCount = 0;
                                    for (const t of teams) {
                                        const cumulative = t.total_score || 0;
                                        const passes = cumulative >= threshold;
                                        await supabase
                                            .from('teams')
                                            .update({ qualified: passes })
                                            .eq('id', t.id);
                                        passes ? qualCount++ : disqualCount++;
                                    }

                                    // 3. Advance to next round, or complete hackathon if last round
                                    const isLastRound = roundNumber >= totalRounds;
                                    const nextRound = isLastRound ? roundNumber : roundNumber + 1;

                                    await updateHackathonMutation.mutateAsync({
                                        rounds_config: newConfig,
                                        current_round: nextRound,
                                        ...(isLastRound ? { status: 'completed' } : {})
                                    });

                                    queryClient.invalidateQueries(['teams', hackathonId]);
                                    if (isLastRound) {
                                        toast.success(`🏁 Round ${roundNumber} ended — all rounds complete! Hackathon is now Completed.`);
                                    } else {
                                        toast.success(`Round ${roundNumber} ended. ${qualCount} qualified, ${disqualCount} eliminated.`);
                                    }
                                    setShowQualifyDialog(false);
                                    setQualificationScoreInput('');
                                } finally {
                                    setIsEndingRound(false);
                                }
                            };

                            return (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-xl font-semibold text-slate-900">Round Management</h2>
                                            <p className="text-sm text-slate-500 mt-0.5">
                                                Currently on <strong>Round {currentRound}</strong> of <strong>{totalRounds}</strong>.
                                                Scores accumulate across all rounds.
                                            </p>
                                        </div>
                                        <Badge className="bg-emerald-100 text-emerald-700 border-0 text-sm px-3 py-1">
                                            Round {currentRound} / {totalRounds}
                                        </Badge>
                                    </div>

                                    {/* Round cards */}
                                    <div className="space-y-4">
                                        {Array.from({ length: totalRounds }, (_, i) => {
                                            const rn = i + 1;
                                            const cfg = roundsConfig.find(r => r.round_number === rn) || {
                                                round_number: rn, name: `Round ${rn}`, status: 'upcoming', qualification_score: null
                                            };
                                            const isActive = cfg.status === 'active';
                                            const isCompleted = cfg.status === 'completed';
                                            const isUpcoming = cfg.status === 'upcoming';
                                            const isCurrent = rn === currentRound;

                                            // Per-round stats from teams
                                            // Cumulative = sum of round_scores up to (and including) this round
                                            const roundTeams = teams.map(t => {
                                                const rs = t.round_scores || {};
                                                const thisRoundScore = rs[String(rn)] || 0;
                                                // Sum scores for rounds 1..rn
                                                let cumulativeUpToRound = 0;
                                                for (let r = 1; r <= rn; r++) {
                                                    cumulativeUpToRound += rs[String(r)] || 0;
                                                }
                                                // Fallback: if round_scores aren't populated yet, use total_score for the last round
                                                if (cumulativeUpToRound === 0 && rn === currentRound) {
                                                    cumulativeUpToRound = t.total_score || 0;
                                                }
                                                return { ...t, thisRoundScore, cumulative: cumulativeUpToRound };
                                            }).sort((a, b) => b.cumulative - a.cumulative);

                                            return (
                                                <Card key={rn} className={`border-0 shadow-lg overflow-hidden ${
                                                    isActive
                                                        ? 'ring-2 ring-emerald-400'
                                                        : isCompleted
                                                            ? 'opacity-80'
                                                            : ''
                                                }`}>
                                                    <div className={`h-1.5 ${
                                                        isActive ? 'bg-emerald-500' : isCompleted ? 'bg-slate-300' : 'bg-slate-200'
                                                    }`} />
                                                    <CardContent className="p-5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                                                                    isActive ? 'bg-emerald-100 text-emerald-700' :
                                                                    isCompleted ? 'bg-slate-100 text-slate-500' :
                                                                    'bg-slate-100 text-slate-400'
                                                                }`}>
                                                                    {rn}
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-semibold text-slate-900">{cfg.name}</h3>
                                                                    <div className="flex items-center gap-2 mt-0.5">
                                                                        <Badge className={`text-xs border-0 ${
                                                                            isActive ? 'bg-emerald-100 text-emerald-700' :
                                                                            isCompleted ? 'bg-slate-100 text-slate-600' :
                                                                            'bg-amber-100 text-amber-700'
                                                                        }`}>
                                                                            {isActive ? '🟢 Active' : isCompleted ? '✅ Completed' : '⏳ Upcoming'}
                                                                        </Badge>
                                                                        {isCompleted && cfg.qualification_score != null && (
                                                                            <span className="text-xs text-slate-500">
                                                                                Cutoff: <strong>{cfg.qualification_score} pts</strong>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Action buttons */}
                                                            <div className="flex items-center gap-2">
                                                                {isUpcoming && isCurrent && (
                                                                    <Button
                                                                        className="bg-emerald-600 hover:bg-emerald-700"
                                                                        onClick={() => startRound(rn)}
                                                                        disabled={updateHackathonMutation.isPending}
                                                                    >
                                                                        <Flag className="w-4 h-4 mr-2" />
                                                                        Start Round {rn}
                                                                    </Button>
                                                                )}
                                                                {isActive && (
                                                                    <Button
                                                                        variant="outline"
                                                                        className="border-red-200 text-red-600 hover:bg-red-50"
                                                                        onClick={() => {
                                                                            setQualifyingRoundNumber(rn);
                                                                            setQualificationScoreInput('');
                                                                            setShowQualifyDialog(true);
                                                                        }}
                                                                    >
                                                                        <CheckCircle className="w-4 h-4 mr-2" />
                                                                        End Round & Qualify
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Per-round timings */}
                                                        <div className="grid grid-cols-2 gap-3 mt-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                            <div className="space-y-1">
                                                                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> Round Start Time
                                                                </label>
                                                                <input
                                                                    type="datetime-local"
                                                                    defaultValue={formatDatetimeLocal(cfg.start_time)}
                                                                    className="w-full text-sm rounded-lg border border-slate-200 px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                                                    onBlur={(e) => {
                                                                        const updatedConfig = roundsConfig.map(r =>
                                                                            r.round_number === rn
                                                                                ? { ...r, start_time: e.target.value ? new Date(e.target.value).toISOString() : null }
                                                                                : r
                                                                        );
                                                                        updateHackathonMutation.mutate({ rounds_config: updatedConfig });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" /> Round End Time
                                                                </label>
                                                                <input
                                                                    type="datetime-local"
                                                                    defaultValue={formatDatetimeLocal(cfg.end_time)}
                                                                    className="w-full text-sm rounded-lg border border-slate-200 px-2 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                                                    onBlur={(e) => {
                                                                        const updatedConfig = roundsConfig.map(r =>
                                                                            r.round_number === rn
                                                                                ? { ...r, end_time: e.target.value ? new Date(e.target.value).toISOString() : null }
                                                                                : r
                                                                        );
                                                                        updateHackathonMutation.mutate({ rounds_config: updatedConfig });
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Team table for this round */}
                                                        {(isActive || isCompleted) && roundTeams.length > 0 && (
                                                            <div className="mt-3 border rounded-xl overflow-hidden">
                                                                <table className="w-full text-sm">
                                                                    <thead className="bg-slate-50">
                                                                        <tr>
                                                                            <th className="text-left px-3 py-2 font-medium text-slate-600">#</th>
                                                                            <th className="text-left px-3 py-2 font-medium text-slate-600">Team</th>
                                                                            <th className="text-right px-3 py-2 font-medium text-slate-600">Rnd {rn}</th>
                                                                            <th className="text-right px-3 py-2 font-medium text-slate-600">Cumulative</th>
                                                                            {isCompleted && (
                                                                                <th className="text-center px-3 py-2 font-medium text-slate-600">Status</th>
                                                                            )}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {roundTeams.map((t, idx) => (
                                                                            <tr key={t.id} className={`border-t ${
                                                                                isCompleted && t.qualified === false
                                                                                    ? 'bg-red-50'
                                                                                    : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                                                                            }`}>
                                                                                <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                                                                <td className="px-3 py-2 font-medium text-slate-800">{t.name}</td>
                                                                                <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{t.thisRoundScore}</td>
                                                                                <td className="px-3 py-2 text-right text-slate-700 font-bold">{t.cumulative}</td>
                                                                                {isCompleted && (
                                                                                    <td className="px-3 py-2 text-center">
                                                                                        {t.qualified === false ? (
                                                                                            <Badge className="bg-red-100 text-red-700 border-0 text-xs">Eliminated</Badge>
                                                                                        ) : (
                                                                                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Qualified</Badge>
                                                                                        )}
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}

                                                        {isUpcoming && !isCurrent && (
                                                            <p className="text-sm text-slate-400 italic mt-2">
                                                                This round will become available after Round {rn - 1} is ended.
                                                            </p>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>

                                    {/* Qualify Dialog */}
                                    <Dialog open={showQualifyDialog} onOpenChange={setShowQualifyDialog}>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>End Round {qualifyingRoundNumber} & Set Qualification Score</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 py-2">
                                                <p className="text-sm text-slate-600">
                                                    Teams whose <strong>cumulative score</strong> (total across all rounds so far) is
                                                    below the qualification score will be <strong className="text-red-600">eliminated</strong> and
                                                    won't see Round {(qualifyingRoundNumber || 0) + 1} challenges.
                                                </p>
                                                <div className="space-y-2">
                                                    <Label>Minimum Cumulative Score to Qualify</Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        placeholder="e.g. 50"
                                                        value={qualificationScoreInput}
                                                        onChange={e => setQualificationScoreInput(e.target.value)}
                                                    />
                                                    <p className="text-xs text-slate-400">
                                                        Set to 0 to advance all teams. Teams with score ≥ this value advance.
                                                    </p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1"
                                                        onClick={() => setShowQualifyDialog(false)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        className="flex-1 bg-red-600 hover:bg-red-700"
                                                        disabled={isEndingRound}
                                                        onClick={() => endRound(qualifyingRoundNumber, qualificationScoreInput)}
                                                    >
                                                        {isEndingRound ? (
                                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                                                        ) : (
                                                            <>End Round & Qualify Teams</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            );
                        })()}
                    </TabsContent>

                    {/* Activity Tab */}
                    <TabsContent value="activity">
                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="w-5 h-5" />
                                    Live Activity Feed
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {allSubmissions?.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p>No submissions yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                        {[...(allSubmissions || [])].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map((sub, i) => {
                                            const subTeam = teams.find(t => t.id === sub.team_id);
                                            const challenge = challenges.find(c => c.id === sub.challenge_id);
                                            const violations = sub.violation_data ? (typeof sub.violation_data === 'string' ? JSON.parse(sub.violation_data) : sub.violation_data) : null;
                                            return (
                                                <div key={sub.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition">
                                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sub.status === 'correct' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-slate-900 truncate">{subTeam?.name || 'Unknown'}</span>
                                                            <span className="text-slate-400">→</span>
                                                            <span className="text-slate-600 truncate">{challenge?.title || 'Unknown'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                                            <span>{sub.status === 'correct' ? '✅ Correct' : '❌ Incorrect'}</span>
                                                            {sub.score > 0 && <span className="text-emerald-600 font-medium">+{sub.score} pts</span>}
                                                            {violations?.total_violations > 0 && (
                                                                <span className="text-red-500 flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    {violations.total_violations} violations
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400 flex-shrink-0">
                                                        {new Date(sub.created_date).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Bulk Import Dialog */}
                <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Import Challenges (JSON)</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <Textarea
                                value={bulkJson}
                                onChange={(e) => setBulkJson(e.target.value)}
                                placeholder={`[\n  {\n    "title": "Find All Users",\n    "description": "Write a query to get all users",\n    "difficulty": "easy",\n    "points": 50,\n    "solution_query": "SELECT * FROM users",\n    "expected_output": "name, email"\n  }\n]`}
                                rows={10}
                                className="font-mono text-sm"
                            />
                            <div className="flex items-center gap-2">
                                <label className="flex-1">
                                    <input
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => setBulkJson(ev.target.result);
                                                reader.readAsText(file);
                                            }
                                        }}
                                    />
                                    <Button variant="outline" className="w-full" asChild>
                                        <span><Upload className="w-4 h-4 mr-2" />Upload .json file</span>
                                    </Button>
                                </label>
                            </div>
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                                disabled={!bulkJson.trim() || isImporting}
                                onClick={async () => {
                                    setIsImporting(true);
                                    try {
                                        const parsed = JSON.parse(bulkJson);
                                        if (!Array.isArray(parsed)) throw new Error('JSON must be an array');
                                        let count = 0;
                                        for (const ch of parsed) {
                                            await db.entities.Challenge.create({
                                                hackathon_id: hackathonId,
                                                title: ch.title,
                                                description: ch.description || '',
                                                difficulty: ch.difficulty || 'medium',
                                                points: ch.points || 100,
                                                expected_output: ch.expected_output || '',
                                                solution_query: ch.solution_query || '',
                                                hints: ch.hints || [],
                                                required_keywords: ch.required_keywords || [],
                                                forbidden_keywords: ch.forbidden_keywords || [],
                                                order: count
                                            });
                                            count++;
                                        }
                                        queryClient.invalidateQueries(['challenges', hackathonId]);
                                        toast.success(`Imported ${count} challenges!`);
                                        setShowBulkImport(false);
                                        setBulkJson('');
                                    } catch (err) {
                                        toast.error(`Import failed: ${err.message}`);
                                    } finally {
                                        setIsImporting(false);
                                    }
                                }}
                            >
                                {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileJson className="w-4 h-4 mr-2" />}
                                Import Challenges
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
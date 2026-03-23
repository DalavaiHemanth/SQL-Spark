import React, { useState, useRef, useEffect, useCallback } from 'react';
import { db } from '@/api/dataClient';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useNavigate } from 'react-router-dom';
import { createPageUrl, getEffectiveHackathonStatus } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
    ArrowLeft,
    Users,
    Trophy,
    Copy,
    CheckCircle2,
    Play,
    Loader2,
    Lightbulb,
    Send,
    RotateCcw,
    X,
    Database,
    Terminal,
    Eye,
    Clock,
    History,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import CodeEditor from '@/components/ui/CodeEditor';
import ChallengeCard from '@/components/hackathon/ChallengeCard';
import Leaderboard from '@/components/hackathon/Leaderboard';
import SqlEngine from '@/components/hackathon/SqlEngine';
import QueryResultsTable from '@/components/hackathon/QueryResultsTable';
import SchemaViewer from '@/components/hackathon/SchemaViewer';
import DatabaseExplorer from '@/components/hackathon/DatabaseExplorer';
import useAntiCheat from '@/hooks/useAntiCheat';
import { notificationUtils } from '@/lib/notifications';
import { logger } from '@/lib/logger';

export default function TeamDashboard() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const sqlEngineRef = useRef(null);

    const { user } = useAuth();
    const [selectedChallenge, setSelectedChallenge] = useState(null);
    const [sqlQuery, setSqlQuery] = useState('');
    const [showHints, setShowHints] = useState(false);
    const [hintsUsed, setHintsUsed] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [queryResult, setQueryResult] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [dbReady, setDbReady] = useState(false);
    const [showDbExplorer, setShowDbExplorer] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const [isTimeUp, setIsTimeUp] = useState(false);
    // Per-round countdown
    const [roundTimeLeft, setRoundTimeLeft] = useState(null);  // 'HH:MM:SS' | 'Not Started' | null
    const [isRoundTimeUp, setIsRoundTimeUp] = useState(false);
    const [queryHistory, setQueryHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [hackathonNotStarted, setHackathonNotStarted] = useState(false);
    const [startCountdown, setStartCountdown] = useState('');
    const [interRoundCountdown, setInterRoundCountdown] = useState(''); // between-rounds gap
    const [isInInterRound, setIsInInterRound] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [timerId, setTimerId] = useState(null);
    const [showNavWarning, setShowNavWarning] = useState(false);
    const [isDisqualified, setIsDisqualified] = useState(false);

    // Timer offset for Server Synchronization to prevent local clock spoofing
    const serverTimeOffsetRef = useRef(0);

    // Fetch server time on mount
    useEffect(() => {
        if (window.IS_MOCK_MODE) return;
        const syncServerTime = async () => {
            try {
                const { data, error } = await supabase.rpc('get_server_time');
                if (!error && data) {
                    const serverTime = new Date(data).getTime();
                    serverTimeOffsetRef.current = serverTime - Date.now();
                }
            } catch (err) {}
        };
        syncServerTime();
        const interval = setInterval(syncServerTime, 5 * 60 * 1000); // 5 min
        return () => clearInterval(interval);
    }, []);

    const urlParams = new URLSearchParams(window.location.search);
    const teamId = urlParams.get('teamId');

    // Fetch Team & Hackathon data first so we can use it to determine anti-cheat status
    const { data: team, isLoading: teamLoading } = useQuery({
        queryKey: ['team', teamId],
        queryFn: async () => {
            const teams = await db.entities.Team.filter({ id: teamId });
            return teams[0];
        },
        refetchInterval: 10000, // Sync team status changes every 10s
        enabled: !!teamId
    });

    const { data: hackathon } = useQuery({
        queryKey: ['hackathon', team?.hackathon_id],
        queryFn: async () => {
            const hackathons = await db.entities.Hackathon.filter({ id: team.hackathon_id });
            const h = hackathons[0];
            return h;
        },
        refetchInterval: 10000, // Sync hackathon status changes (like results_published) every 10s
        enabled: !!team?.hackathon_id
    });

    // Disable anti-cheat for admin/organizer users OR when not in an active round
    // (waiting room, between-rounds countdown, and end screen should never log violations)
    const isRoleAllowed = !!teamId && user?.role !== 'admin' && user?.role !== 'organizer';
    // Note: isContestActive is computed below (after hackathon query), so we pass a ref-like
    // approach: always mount the hook but pass enabled=false until we're truly in the active session.
    // We re-derive this simply: enabled = roleOK && hackathon in_progress && round is active.
    const currentRoundCfgEarly = hackathon?.rounds_config?.find(
        r => r.round_number === (hackathon?.current_round || 1)
    );
    // Round is active if no config exists OR if Round 1 is upcoming/active (if no config) OR specifically marked 'active'
    const isRoundCurrentlyActive = !hackathon?.rounds_config || 
        hackathon.rounds_config.length === 0 || 
        currentRoundCfgEarly?.status === 'active';

    const antiCheatEnabled = isRoleAllowed && !hackathonNotStarted && isRoundCurrentlyActive && !isTimeUp;
    const antiCheat = useAntiCheat(teamId, antiCheatEnabled);

    // Load query history from localStorage
    useEffect(() => {
        if (!teamId) return;
        try {
            const saved = localStorage.getItem(`queryHistory_${teamId}`);
            if (saved) setQueryHistory(JSON.parse(saved));
        } catch { /* ignore */ }
    }, [teamId]);

    // Redirect to Home if no teamId provided
    useEffect(() => {
        if (!teamId) navigate(createPageUrl('Home'));
    }, [teamId]);

    // Item 8: Request notification permission on mount
    useEffect(() => {
        notificationUtils.requestPermission();
    }, []);

    // Periodically sync violations to Supabase so admin can see them live
    useEffect(() => {
        if (!teamId || window.IS_MOCK_MODE) return;

        const syncViolations = async () => {
            const summary = antiCheat.getViolationSummary();
            // Optimistically update the query cache so local Admin Forgive checks do not race
            queryClient.setQueryData(['team', teamId], old => old ? { ...old, violations: summary } : old);
            // Only sync if there's something to update
            await supabase
                .from('teams')
                .update({ violations: summary })
                .eq('id', teamId);
        };

        // Sync immediately on any violation change
        syncViolations();
    }, [
        antiCheat.violations.length,
        antiCheat.tabSwitchCount,
        antiCheat.pasteCount,
        antiCheat.fullscreenExitCount,
        teamId
    ]);


    // Save query to history
    const saveToHistory = useCallback((query, challengeId, success) => {
        const entry = {
            query,
            challengeId,
            success,
            timestamp: new Date().toISOString()
        };
        setQueryHistory(prev => {
            const updated = [entry, ...prev].slice(0, 50); // Keep last 50
            try { localStorage.setItem(`queryHistory_${teamId}`, JSON.stringify(updated)); } catch { }
            return updated;
        });
    }, [teamId]);



    // Monitor Admin actions (Perm-Disqualify & Forgive)
    useEffect(() => {
        if (!team) return;

        // 1. Permanent Disqualification (Admin clicked 'Grade as 0')
        // OR the team's backend violations explicitly say they were disqualified locally
        if (team.status === 'disqualified') {
            setIsDisqualified(true);
            return;
        }

        // 2. Forgive Action (Admin clicked 'Forgive')
        // If the backend has NO violations for this team, but our local state has ANY violations,
        // it means the Admin intentionally wiped the DB. We should clear local storage and let them back in!
        const backendViols = team.violations?.total_violations || 0;
        if (backendViols === 0 && (antiCheat.violations.length > 0 || isDisqualified || antiCheat.fullscreenExitCount > 0)) {
            antiCheat.clearAllViolations();
            setIsDisqualified(false); // remove the block screen
            toast.success('Admin has forgiven your violations. You may resume the contest.', { duration: 10000 });
        }
    }, [team, antiCheat, antiCheat.fullscreenExitCount, isDisqualified]);

    // Multi-device sync: on first load, seed local violation state from Supabase.
    // This ensures a participant who already earned violations on another device
    // (phone, lab PC, etc.) has those counts correctly restored here.
    // We take the MAX of backend vs local so no device can go backwards.
    const hasSyncedFromBackend = useRef(false);
    useEffect(() => {
        if (!team?.violations || hasSyncedFromBackend.current) return;
        hasSyncedFromBackend.current = true;
        antiCheat.syncFromBackend(team.violations);
    }, [team?.violations, antiCheat]);



    // Navigation lock: block browser back button and page unload during active contest
    // Also check that the CURRENT ROUND is 'active' — not 'upcoming' (inter-round gap)
    // Contest is active if anti-cheat is enabled (covers role, not started, round, time)
    const isContestActive = antiCheatEnabled;

    useEffect(() => {
        if (!isContestActive) return;

        // Block tab close / refresh
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = 'The contest is still running. Leaving now will be logged as a violation.';
            return e.returnValue;
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Trap back button by pushing a dummy state and re-pushing on popstate
        window.history.pushState({ contestLock: true }, '');
        const handlePopState = () => {
            // Re-push so they can't go further back
            window.history.pushState({ contestLock: true }, '');
            setShowNavWarning(true);
        };
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [isContestActive]);

    // Item 1: Auto-status transition when end_time passes
    useEffect(() => {
        if (!hackathon?.end_time) return;
        const checkEndTime = () => {
            const now = new Date(Date.now() + serverTimeOffsetRef.current);
            const endTime = new Date(hackathon.end_time);
            if (now >= endTime && hackathon.status === 'in_progress') {
                db.entities.Hackathon.update(hackathon.id, { status: 'completed' })
                    .then(() => queryClient.invalidateQueries(['hackathon']))
                    .catch(() => { });
            }
        };
        checkEndTime();
        const interval = setInterval(checkEndTime, 10000);
        return () => clearInterval(interval);
    }, [hackathon?.end_time, hackathon?.status, hackathon?.id]);

    // Waiting room — gate on status AND start_time
    useEffect(() => {
        if (!hackathon) return;

        const checkAccess = () => {
            const status = hackathon.status;
            const now = new Date(Date.now() + serverTimeOffsetRef.current);

            let isStarted = status === 'in_progress' || status === 'completed';

            // Determine the effective start time
            let effectiveStartTime = null;
            if (hackathon.total_rounds > 1 && hackathon.rounds_config) {
                const rn = hackathon.current_round || 1;
                const activeRound = hackathon.rounds_config.find(r => r.round_number === rn);
                if (activeRound && activeRound.start_time) {
                    effectiveStartTime = new Date(activeRound.start_time);
                }
            } else if (hackathon.start_time) {
                effectiveStartTime = new Date(hackathon.start_time);
            }

            // If time is reached, allow them in (auto-start from user perspective)
            if (effectiveStartTime && now >= effectiveStartTime) {
                isStarted = true;
                
                let updates = {};
                let needsUpdate = false;

                // Sync hackathon status to in_progress if it was open
                if (status === 'registration_open') {
                     updates.status = 'in_progress';
                     needsUpdate = true;
                }

                // Sync current round status to active if it's upcoming
                if (hackathon.total_rounds > 1 && hackathon.rounds_config) {
                    const rn = hackathon.current_round || 1;
                    const roundIdx = hackathon.rounds_config.findIndex(r => r.round_number === rn);
                    if (roundIdx !== -1 && hackathon.rounds_config[roundIdx].status === 'upcoming') {
                        const newConfig = [...hackathon.rounds_config];
                        newConfig[roundIdx] = { ...newConfig[roundIdx], status: 'active' };
                        updates.rounds_config = newConfig;
                        needsUpdate = true;
                    }
                }

                if (needsUpdate && !window.IS_MOCK_MODE) {
                     db.entities.Hackathon.update(hackathon.id, updates)
                        .then(() => queryClient.invalidateQueries(['hackathon']))
                        .catch(() => {});
                }
            }

            // Note: If Admin manually set to 'in_progress', isStarted is true regardless of effectiveStartTime.

            if (isStarted) {
                if (hackathonNotStarted) {
                    notificationUtils.hackathonStarted(hackathon.title || 'Hackathon');
                }
                setHackathonNotStarted(false);
                setStartCountdown('');
                return;
            }

            // Not started yet — gate access
            setHackathonNotStarted(true);

            // Show countdown based on effectiveStartTime
            if (effectiveStartTime) {
                const diff = effectiveStartTime - now;
                if (diff > 0) {
                    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                    const m = Math.floor((diff / 1000 / 60) % 60);
                    const s = Math.floor((diff / 1000) % 60);
                    
                    const parts = [];
                    if (d > 0) parts.push(`${d}d`);
                    if (h > 0 || d > 0) parts.push(`${h}h`);
                    parts.push(`${m}m`);
                    parts.push(`${s}s`);

                    setStartCountdown(parts.join(' '));
                } else {
                    setStartCountdown('Starting soon...');
                }
            } else {
                setStartCountdown('');
            }
        };

        checkAccess();
        const interval = setInterval(checkAccess, 1000); // check locally every 1s
        return () => clearInterval(interval);
    }, [hackathon?.status, hackathon?.start_time, hackathon?.title]);

    const { data: challenges = [] } = useQuery({
        queryKey: ['challenges', team?.hackathon_id, hackathon?.current_round],
        queryFn: async () => {
            const all = await db.entities.Challenge.filter(
                { hackathon_id: team.hackathon_id },
                'order'
            );
            const r = hackathon?.current_round || 1;
            return all.filter(c => !c.round_number || c.round_number === r);
        },
        enabled: !!team?.hackathon_id && !!hackathon
    });

    const { data: submissions = [] } = useQuery({
        queryKey: ['submissions', teamId],
        queryFn: () => db.entities.Submission.filter({ team_id: teamId }),
        enabled: !!teamId
    });

    const { data: allTeams = [] } = useQuery({
        queryKey: ['all-teams', team?.hackathon_id],
        queryFn: () => db.entities.Team.filter({ hackathon_id: team.hackathon_id }),
        enabled: !!team?.hackathon_id
    });

    // REAL-TIME LEADERBOARD: Subscribe to changes in teams table for this hackathon
    useEffect(() => {
        if (!team?.hackathon_id || window.IS_MOCK_MODE) return;

        const channel = supabase
            .channel(`hackathon-teams-${team.hackathon_id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'teams',
                    filter: `hackathon_id=eq.${team.hackathon_id}`
                },
                (payload) => {
                    // Invalidate the teams list to trigger a refresh
                    queryClient.invalidateQueries(['all-teams', team.hackathon_id]);
                    
                    // Also invalidate the current team if it was the one modified
                    if (payload.new && payload.new.id === teamId) {
                        queryClient.invalidateQueries(['team', teamId]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [team?.hackathon_id, teamId, queryClient]);

    // The effective DB URL: team custom DB > hackathon default
    const effectiveDbUrl = team?.custom_db_url || hackathon?.database_file_url;

    const getChallengeStatus = (challenge) => {
        const correctSubmission = submissions.find(
            s => s.challenge_id === challenge.id && s.status === 'correct'
        );
        if (correctSubmission) return { status: 'completed', score: correctSubmission.score };

        const hasAttempt = submissions.some(s => s.challenge_id === challenge.id);
        if (hasAttempt) return { status: 'in_progress', score: 0 };

        return { status: 'available', score: 0 };
    };

    // Run query without submitting (for testing)
    const runQuery = () => {
        if (!sqlQuery.trim() || !sqlEngineRef.current) return;

        setIsRunning(true);
        setQueryResult(null);

        setTimeout(() => {
            const result = sqlEngineRef.current.executeQuery(sqlQuery);
            setQueryResult(result);
            setIsRunning(false);
            saveToHistory(sqlQuery, selectedChallenge?.id, result.success);
        }, 100);
    };

    // Check if query contains required/forbidden keywords
    const validateQueryStructure = (query, challenge) => {
        const upperQuery = query.toUpperCase();
        const errors = [];

        // Check required keywords
        if (challenge.required_keywords?.length > 0) {
            const missing = challenge.required_keywords.filter(
                kw => !upperQuery.includes(kw.toUpperCase())
            );
            if (missing.length > 0) {
                errors.push(`Missing required keywords: ${missing.join(', ')}`);
            }
        }

        // Check forbidden keywords
        if (challenge.forbidden_keywords?.length > 0) {
            const found = challenge.forbidden_keywords.filter(
                kw => upperQuery.includes(kw.toUpperCase())
            );
            if (found.length > 0) {
                errors.push(`Forbidden keywords used: ${found.join(', ')}`);
            }
        }

        return errors;
    };

    // Item 7: Handle confirmed submission
    const handleSubmitClick = () => {
        if (!sqlQuery.trim() || !selectedChallenge || !sqlEngineRef.current) return;
        setShowSubmitConfirm(true);
    };

    // Submit solution for scoring (called after confirmation)
    const submitSolution = async () => {
        setShowSubmitConfirm(false);
        if (!sqlQuery.trim() || !selectedChallenge || !sqlEngineRef.current) return;

        // Enforce cooldown
        if (!antiCheat.canSubmit()) {
            const remaining = antiCheat.getCooldownRemaining();
            toast.error(`Please wait ${remaining}s before submitting again`);
            setCooldownSeconds(remaining);
            const interval = setInterval(() => {
                setCooldownSeconds(prev => {
                    if (prev <= 1) { clearInterval(interval); return 0; }
                    return prev - 1;
                });
            }, 1000);
            return;
        }

        antiCheat.recordSubmission();
        setIsSubmitting(true);
        setSubmissionResult(null);

        // Check query structure (required/forbidden keywords)
        const structureErrors = validateQueryStructure(sqlQuery, selectedChallenge);
        if (structureErrors.length > 0) {
            setSubmissionResult({
                isCorrect: false,
                score: 0,
                feedback: structureErrors.join('. ')
            });
            setIsSubmitting(false);
            return;
        }

        // Execute the query
        const result = sqlEngineRef.current.executeQuery(sqlQuery);
        setQueryResult(result);

        if (!result.success) {
            setSubmissionResult({
                isCorrect: false,
                score: 0,
                feedback: `SQL Error: ${result.error}`
            });
            setIsSubmitting(false);
            return;
        }

        // Compare results with expected output
        let outputMatches = false;
        let feedback = '';

        try {
            const rawExpected = selectedChallenge.expected_output;

            // If no expected output is set, just check the query runs without error
            if (!rawExpected || rawExpected === '[]' || rawExpected === '') {
                outputMatches = result.success && result.data.length >= 0;
                if (outputMatches) feedback = 'Query ran successfully.';
            } else {
                const expectedOutput = JSON.parse(rawExpected);
                const orderSensitive = selectedChallenge.order_sensitive || false;

                // Helper: extract ordered values from a row object (ignores column names)
                const rowValues = (row) => Object.values(row).map(v => String(v ?? ''));

                // Helper: canonical sort key using only values
                const sortKey = (row) => rowValues(row).join('|');

                if (Array.isArray(expectedOutput) && expectedOutput.length === result.data.length) {
                    if (orderSensitive) {
                        outputMatches = expectedOutput.every((expRow, i) => {
                            const expVals = rowValues(expRow);
                            const actVals = rowValues(result.data[i]);
                            return expVals.length === actVals.length &&
                                expVals.every((v, j) => v === actVals[j]);
                        });
                    } else {
                        // Sort both by values then compare positionally
                        const sortedExp = [...expectedOutput].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
                        const sortedAct = [...result.data].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
                        outputMatches = sortedExp.every((expRow, i) => {
                            const expVals = rowValues(expRow);
                            const actVals = rowValues(sortedAct[i]);
                            return expVals.length === actVals.length &&
                                expVals.every((v, j) => v === actVals[j]);
                        });
                    }
                }

                if (!outputMatches) {
                    feedback = `Output mismatch: Your query returned ${result.data.length} rows, expected ${expectedOutput.length}.`;
                }
            }
        } catch (e) {
            // Can't parse expected output
        }

        // Local evaluation: check output match only (no LLM)
        const isCorrect = outputMatches;
        if (outputMatches) {
            feedback = 'Correct! Your query output matches the expected result.';
        } else {
            feedback = feedback || 'Incorrect. Your query output does not match the expected result. Please review your query and try again.';
        }

        // Calculate score
        let score = 0;
        if (isCorrect) {
            score = selectedChallenge.points;
            const hintPenalty = selectedChallenge.hints?.slice(0, hintsUsed).reduce(
                (sum, h) => sum + (h.point_penalty || 0), 0
            ) || 0;
            score = Math.max(0, score - hintPenalty);
        }

        // Create submission
        await db.entities.Submission.create({
            team_id: teamId,
            challenge_id: selectedChallenge.id,
            hackathon_id: team.hackathon_id,
            query: sqlQuery,
            status: isCorrect ? 'correct' : 'incorrect',
            score,
            hints_used: hintsUsed,
            feedback,
            execution_time_ms: result.executionTime,
            violations: JSON.stringify(antiCheat.getViolationSummary()),
            submitted_by: user?.email // Track who actually submitted this
        });

        // Update team score if correct
        if (isCorrect) {
            const alreadySolved = submissions.some(
                s => s.challenge_id === selectedChallenge.id && s.status === 'correct'
            );

            if (!alreadySolved) {
                // We no longer manually update total_score and challenges_completed here.
                // The SQL Trigger 'trg_sync_team_stats' will handle these automatically 
                // when the submission is created above.
                
                // However, we still track round_scores and member_scores for better breakdown
                const roundKey = String(hackathon?.current_round || 1);
                const existingRoundScores = team.round_scores || {};
                const updatedRoundScores = {
                    ...existingRoundScores,
                    [roundKey]: (existingRoundScores[roundKey] || 0) + score
                };

                const memberEmail = user?.email || 'unknown';
                const existingMemberScores = team.member_scores || {};
                const updatedMemberScores = {
                    ...existingMemberScores,
                    [memberEmail]: (existingMemberScores[memberEmail] || 0) + score
                };

                await db.entities.Team.update(teamId, {
                    round_scores: updatedRoundScores,
                    member_scores: updatedMemberScores
                });
            }
        }

        setSubmissionResult({ isCorrect, score, feedback });

        queryClient.invalidateQueries(['submissions', teamId]);
        queryClient.invalidateQueries(['team', teamId]);
        queryClient.invalidateQueries(['all-teams']);

        setIsSubmitting(false);
    };

    const copyJoinCode = () => {
        navigator.clipboard.writeText(team.join_code);
        toast.success('Join code copied!');
    };

    const resetWorkspace = () => {
        setSqlQuery('');
        setQueryResult(null);
        setSubmissionResult(null);
        if (sqlEngineRef.current) {
            sqlEngineRef.current.resetDatabase?.();
        }
        setDbReady(false);
        setTimeout(() => setDbReady(true), 100);
    };

    // --- Timer / Countdown with warnings ---
    useEffect(() => {
        if (!hackathon?.end_time) return;
        const endTime = new Date(hackathon.end_time).getTime();
        const warned = new Set(); // track which thresholds already fired

        const WARNINGS = [
            { mins: 30, msg: '⏰ 30 minutes remaining!', style: 'warning' },
            { mins: 10, msg: '⚠️ 10 minutes remaining — wrap up!', style: 'warning' },
            { mins: 5,  msg: '🔴 Only 5 minutes left!', style: 'error' },
            { mins: 1,  msg: '🚨 1 minute left — submit now!', style: 'error' },
        ];

        const updateTimer = () => {
            const now = Date.now() + serverTimeOffsetRef.current;
            const diff = endTime - now;
            if (diff <= 0) {
                setTimeRemaining('00:00:00');
                setIsTimeUp(true);
                if (!warned.has('done')) {
                    warned.add('done');
                    toast.error('⏱ Time is up! No more submissions allowed.', { duration: 10000 });
                    notificationUtils.sendNotification?.('Time is up!', { body: 'The hackathon has ended. No more submissions.' });
                }
                return;
            }
            const hours = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeRemaining(
                `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
            );

            // Fire threshold warnings
            const minsLeft = Math.floor(diff / 60000);
            WARNINGS.forEach(({ mins: threshold, msg, style }) => {
                if (minsLeft <= threshold && !warned.has(threshold)) {
                    warned.add(threshold);
                    if (style === 'error') {
                        toast.error(msg, { duration: 8000 });
                    } else {
                        toast.warning(msg, { duration: 6000 });
                    }
                    // Browser notification (works even in background tab)
                    if (Notification.permission === 'granted') {
                        new Notification('SQL Spark — Time Warning', { body: msg, icon: '/favicon.ico' });
                    }
                }
            });

            // Check if hackathon hasn't started yet
            if (hackathon.start_time) {
                const startTime = new Date(hackathon.start_time).getTime();
                if (now < startTime) {
                    setTimeRemaining('Not Started');
                }
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [hackathon?.end_time, hackathon?.start_time]);

    // --- Per-Round countdown timer ---
    useEffect(() => {
        const roundsConfig = hackathon?.rounds_config || [];
        const rn = hackathon?.current_round || 1;
        const roundCfg = roundsConfig.find(r => r.round_number === rn);
        const roundEnd = roundCfg?.end_time ? new Date(roundCfg.end_time).getTime() : null;
        const roundStart = roundCfg?.start_time ? new Date(roundCfg.start_time).getTime() : null;

        if (!roundEnd) {
            setRoundTimeLeft(null);
            setIsRoundTimeUp(false);
            return;
        }

        const warned = new Set();
        const ROUND_WARNINGS = [
            { mins: 10, msg: `⏰ Round ${rn}: 10 minutes remaining!`, style: 'warning' },
            { mins: 5,  msg: `⚠️ Round ${rn}: 5 minutes left — wrap up!`, style: 'warning' },
            { mins: 1,  msg: `🔴 Round ${rn}: 1 minute left — submit now!`, style: 'error' },
        ];

        const updateRoundTimer = () => {
            const now = Date.now() + serverTimeOffsetRef.current;
            if (roundStart && now < roundStart) {
                setRoundTimeLeft('Not Started');
                setIsRoundTimeUp(false);
                return;
            }
            const diff = roundEnd - now;
            if (diff <= 0) {
                setRoundTimeLeft('00:00:00');
                setIsRoundTimeUp(true);
                if (!warned.has('done')) {
                    warned.add('done');
                    toast.error(`⏱ Round ${rn} time is up! No more submissions for this round.`, { duration: 10000 });
                }
                return;
            }
            const hours = Math.floor(diff / 3600000);
            const mins  = Math.floor((diff % 3600000) / 60000);
            const secs  = Math.floor((diff % 60000) / 1000);
            setRoundTimeLeft(
                `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
            );
            setIsRoundTimeUp(false);
            const minsLeft = Math.floor(diff / 60000);
            ROUND_WARNINGS.forEach(({ mins: threshold, msg, style }) => {
                if (minsLeft <= threshold && !warned.has(threshold)) {
                    warned.add(threshold);
                    if (style === 'error') toast.error(msg, { duration: 8000 });
                    else toast.warning(msg, { duration: 6000 });
                }
            });
        };

        updateRoundTimer();
        const interval = setInterval(updateRoundTimer, 1000);
        return () => clearInterval(interval);
    }, [hackathon?.rounds_config, hackathon?.current_round]);

    // Timer color based on remaining time
    const getTimerColor = () => {
        if (!hackathon?.end_time || isTimeUp) return 'bg-red-100 text-red-700';
        const endTime = new Date(hackathon.end_time).getTime();
        const startTime = hackathon.start_time ? new Date(hackathon.start_time).getTime() : Date.now() + serverTimeOffsetRef.current;
        const total = endTime - startTime;
        const remaining = endTime - (Date.now() + serverTimeOffsetRef.current);
        const pct = remaining / total;
        if (pct > 0.5) return 'bg-emerald-100 text-emerald-700';
        if (pct > 0.1) return 'bg-yellow-100 text-yellow-700';
        return 'bg-red-100 text-red-700';
    };

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
                e.preventDefault();
                if (selectedChallenge && sqlQuery.trim() && !isTimeUp) handleSubmitClick();
            } else if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                if (sqlQuery.trim()) runQuery();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sqlQuery, selectedChallenge, isTimeUp]);

    // --- Fullscreen enforcement ---
    // isInFullscreenRef persists the last-known fullscreen state across effect re-runs.
    // Using a ref (not a local var) prevents the cleanup/re-mount cycle from resetting it.
    const isInFullscreenRef = useRef(false);

    useEffect(() => {
        if (!hackathon || hackathonNotStarted || isTimeUp) return;

        const enterFullscreen = async () => {
            try {
                const el = document.documentElement;
                if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                    antiCheat.suppressNextBlur();
                    if (el.requestFullscreen) await el.requestFullscreen();
                    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
                    else if (el.msRequestFullscreen) await el.msRequestFullscreen();
                }
            } catch { /* user may deny — handled by overlay */ }
        };

        const handleFullscreenChange = () => {
            if (isDisqualified) return;
            const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
            setIsFullscreen(inFs);
            if (!inFs) {
                antiCheat.logFullscreenExit();
            }
            isInFullscreenRef.current = inFs;
        };

        if (!isDisqualified) {
            enterFullscreen();
        }
        const currentFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
        setIsFullscreen(currentFs);
        isInFullscreenRef.current = currentFs;

        const events = ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'];
        events.forEach(e => document.addEventListener(e, handleFullscreenChange));
        return () => events.forEach(e => document.removeEventListener(e, handleFullscreenChange));
    }, [hackathon?.status, isTimeUp, isDisqualified]);

    // Dedicated effect to handle disqualification limits and toasts
    // This avoids stale closures because it runs anytime the hook state changes
    useEffect(() => {
        const count = antiCheat.fullscreenExitCount;
        if (count === 1 && !isDisqualified) {
            toast.error(`⚠️ WARNING: Fullscreen exited. This is violation 1/2. You will be disqualified on the 2nd exit!`, { duration: 8000 });
            logger.warn('security', 'Fullscreen exited warning (1/2)', { teamId, hackathonId: hackathon?.id }, user?.email);
        } else if (count >= 2 && !isDisqualified) {
            setIsDisqualified(true);
            antiCheat.addViolation('disqualified', 'Exceeded maximum fullscreen exits (2/2)');
            logger.error('security', 'User disqualified for exceeding fullscreen exits', { teamId, hackathonId: hackathon?.id }, user?.email);
            toast.error('❌ DISQUALIFIED: You have exceeded the maximum number of fullscreen exits.', { duration: 15000 });
            
            // Sync to backend so they can't bypass by clearing localStorage or joining again
            if (!window.IS_MOCK_MODE && teamId) {
                queryClient.setQueryData(['team', teamId], old => old ? { ...old, status: 'disqualified' } : old);
                db.entities.Team.update(teamId, { status: 'disqualified' })
                    .then(() => queryClient.invalidateQueries(['team', teamId]))
                    .catch(console.error);
            }
        }
    }, [antiCheat.fullscreenExitCount, isDisqualified, teamId, queryClient, antiCheat]);

    // --- Progress Calculation ---
    const completedChallenges = challenges.filter(ch =>
        submissions.some(s => s.challenge_id === ch.id && s.status === 'correct')
    ).length;
    const totalChallenges = challenges.length;
    const progressPercent = totalChallenges > 0 ? (completedChallenges / totalChallenges) * 100 : 0;

    if (teamLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (!team) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <h2 className="text-xl font-semibold text-slate-900 mb-2">Team Not Found</h2>
                        <Button onClick={() => navigate(createPageUrl('Dashboard'))}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Mobile device gate — hackathon participation requires a desktop browser
    const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
    if (isMobileDevice) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6">
                <div className="max-w-sm w-full text-center">
                    <div className="flex justify-center mb-8">
                        <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center">
                            <span className="text-5xl">📵</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">Desktop Required</h1>
                    <p className="text-slate-400 text-base mb-6">
                        Hackathon participation is only available on a <strong className="text-white">desktop or laptop</strong> browser. Mobile devices are not supported for the contest.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8 text-left space-y-2">
                        <p className="text-sm font-semibold text-slate-300">Your team details:</p>
                        <p className="text-emerald-400 font-bold">{team.name}</p>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Join Code:</span>
                            <code className="text-emerald-400 font-mono font-bold">{team.join_code}</code>
                        </div>
                    </div>
                    <Button
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                        onClick={() => navigate(createPageUrl('Dashboard'))}
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                    <p className="text-slate-500 text-xs mt-4">You can still browse the dashboard and view results on mobile.</p>
                </div>
            </div>
        );
    }

    // Waiting Room gate — blocked if not in_progress or completed
    if (hackathonNotStarted && hackathon) {
        const isRegistrationOpen = hackathon.status === 'registration_open';
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6">
                <div className="max-w-lg w-full">
                    {/* Pulsing icon */}
                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                                <Clock className="w-12 h-12 text-amber-400" />
                            </div>
                            <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 animate-ping" />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {isRegistrationOpen ? 'Registration Open' : 'Hackathon Not Started'}
                        </h1>
                        <p className="text-slate-400 text-lg">{hackathon.title}</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 mb-6 text-center">
                        {startCountdown ? (
                            <>
                                <p className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
                                    {startCountdown === 'Starting soon...' ? 'Status' : 'Challenges unlock in'}
                                </p>
                                <p className={`font-bold font-mono tracking-wider ${startCountdown === 'Starting soon...' ? 'text-3xl text-emerald-400 animate-pulse' : 'text-5xl text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]'}`}>
                                    {startCountdown}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-slate-400 mb-2">Waiting for the organiser to start the hackathon</p>
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                            <p className="text-xs text-slate-400 mb-1">Your Team</p>
                            <p className="text-white font-semibold text-sm truncate">{team.name}</p>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                            <p className="text-xs text-slate-400 mb-1">Join Code</p>
                            <p className="text-emerald-400 font-mono font-bold">{team.join_code}</p>
                        </div>
                    </div>

                    <p className="text-center text-xs text-slate-500">This page refreshes automatically. You'll be let in the moment the hackathon starts.</p>
                </div>
            </div>
        );
    }

    // Not-Qualified gate (multi-round: team was eliminated after a round)
    const currentRound = hackathon?.current_round || 1;
    const totalRounds  = hackathon?.total_rounds  || 1;
    if (
        hackathon?.status === 'in_progress' &&
        team.qualified === false &&
        totalRounds > 1
    ) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 p-6">
                <div className="max-w-lg w-full text-center">
                    <div className="flex justify-center mb-8">
                        <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center">
                            <span className="text-5xl">❌</span>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-3">Eliminated from Round {currentRound}</h1>
                    <p className="text-slate-400 mb-2 text-lg">
                        Your team <strong className="text-white">{team.name}</strong> did not meet the qualification score
                        to advance to Round {currentRound}.
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 my-8">
                        <p className="text-sm text-slate-400 uppercase tracking-wider mb-1">Your Cumulative Score</p>
                        <p className="text-5xl font-bold text-red-400 font-mono">{team.total_score || 0}</p>
                    </div>
                    <Button
                        onClick={() => navigate(createPageUrl('Dashboard'))}
                        className="bg-slate-700 hover:bg-slate-600 text-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Return to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    // Between-Rounds gate — shown when hackathon is in_progress but current round hasn't started yet
    {
        const currentRoundCfg = hackathon?.rounds_config?.find(r => r.round_number === currentRound);
        const isRoundUpcoming = currentRoundCfg?.status === 'upcoming';
        const nextRoundStart = currentRoundCfg?.start_time ? new Date(currentRoundCfg.start_time) : null;
        const now = new Date();
        const isGapPeriod = hackathon?.status === 'in_progress' && totalRounds > 1 && isRoundUpcoming && currentRound > 1;

        if (isGapPeriod) {
            // Countdown string
            let cdText = '';
            if (nextRoundStart) {
                const diff = nextRoundStart - now;
                if (diff > 0) {
                    const h = Math.floor(diff / 3600000);
                    const m = Math.floor((diff % 3600000) / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    cdText = `${h > 0 ? h + 'h ' : ''}${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
                } else {
                    cdText = 'Starting soon...';
                }
            }

            const prevRound = currentRound - 1;
            const prevRoundScore = team.round_scores?.[String(prevRound)] || 0;

            return (
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6">
                    <div className="max-w-lg w-full">
                        {/* Icon */}
                        <div className="flex justify-center mb-8">
                            <div className="relative">
                                <div className="w-24 h-24 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
                                    <Clock className="w-12 h-12 text-indigo-400" />
                                </div>
                                <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30 animate-ping" />
                            </div>
                        </div>

                        <div className="text-center mb-8">
                            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
                                <span>✅ Round {prevRound} Complete</span>
                            </div>
                            <h1 className="text-4xl font-bold text-white mb-2">Get Ready for Round {currentRound}!</h1>
                            <p className="text-slate-400 text-lg">{hackathon.title}</p>
                        </div>

                        {/* Score summary */}
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Round {prevRound} Score</p>
                                <p className="text-4xl font-bold text-emerald-400 font-mono">{prevRoundScore}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Score</p>
                                <p className="text-4xl font-bold text-white font-mono">{team.total_score || 0}</p>
                            </div>
                        </div>

                        {/* Countdown */}
                        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 mb-6 text-center">
                            {cdText ? (
                                <>
                                    <p className="text-sm text-slate-400 mb-2">Round {currentRound} starts in</p>
                                    <p className="text-5xl font-bold text-indigo-300 font-mono tracking-wider">{cdText}</p>
                                </>
                            ) : (
                                <p className="text-slate-400">Waiting for the organiser to set Round {currentRound} schedule...</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xs text-slate-400 mb-1">Your Team</p>
                                <p className="text-white font-semibold text-sm truncate">{team.name}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xs text-slate-400 mb-1">Progress</p>
                                <p className="text-indigo-400 font-bold text-sm">Round {currentRound} / {totalRounds}</p>
                            </div>
                        </div>

                        <p className="text-center text-xs text-slate-500 mt-6">This page refreshes automatically. You'll be let in when Round {currentRound} starts.</p>
                    </div>
                </div>
            );
        }
    }

    // End Screen gate - blocked if completed or time is up
    const effectiveStatus = hackathon ? getEffectiveHackathonStatus(hackathon) : null;
    if (isTimeUp || effectiveStatus === 'completed') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-purple-950 p-6">
                <div className="max-w-lg w-full">
                    <div className="flex justify-center mb-8">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center animate-pulse">
                                <Trophy className="w-12 h-12 text-purple-400" />
                            </div>
                            <div className="absolute inset-0 rounded-full border-2 border-purple-400/30 animate-ping" />
                        </div>
                    </div>

                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-white mb-2">Hackathon Concluded</h1>
                        <p className="text-slate-400 text-lg">Amazing work, <strong>{team.name}</strong>!</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 mb-6 text-center shadow-xl">
                        <p className="text-slate-300 text-sm mb-6 uppercase tracking-wider font-semibold">Your Final Stats</p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                <p className="text-3xl font-bold text-emerald-400 font-mono mb-1">{team.total_score || 0}</p>
                                <p className="text-xs text-slate-400 uppercase tracking-wide">Total Points</p>
                            </div>
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                <p className="text-3xl font-bold text-blue-400 font-mono mb-1">{team.challenges_completed || 0}</p>
                                <p className="text-xs text-slate-400 uppercase tracking-wide">Challenges Solved</p>
                            </div>
                        </div>

                        {hackathon.results_published ? (
                            <div className="space-y-4">
                                <p className="text-emerald-400 text-sm font-semibold">
                                    Results have been published!
                                </p>
                                <Button 
                                    onClick={() => navigate(createPageUrl(`HackathonResults?id=${hackathon.id}`))}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6 rounded-xl text-lg shadow-lg shadow-emerald-600/20"
                                >
                                    <Trophy className="w-5 h-5 mr-3" />
                                    View Full Leaderboard
                                </Button>
                                <Button 
                                    variant="ghost"
                                    onClick={() => navigate(createPageUrl('Dashboard'))}
                                    className="w-full text-slate-400 hover:text-white"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Return to Dashboard
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-slate-400 text-sm">
                                    The organisers are currently reviewing the submissions. Results will be published soon!
                                </p>
                                <Button 
                                    onClick={() => navigate(createPageUrl('Dashboard'))}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-6 rounded-xl text-lg shadow-lg shadow-purple-600/20"
                                >
                                    <ArrowLeft className="w-5 h-5 mr-3" />
                                    Return to Dashboard
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Get SQL engine status
    const sqlEngineStatus = sqlEngineRef.current ?
        { isLoading: !dbReady, error: null, isReady: dbReady } :
        { isLoading: true, error: null, isReady: false };

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 overflow-hidden">
            {/* SQL Engine - Hidden component */}
            {hackathon && (
                <div style={{ display: 'none' }}>
                    <SqlEngine
                        ref={sqlEngineRef}
                        schema={hackathon.database_schema}
                        sampleData={hackathon.sample_data}
                        dbFileUrl={effectiveDbUrl}
                        onReady={() => setDbReady(true)}
                    />
                </div>
            )}

            {isDisqualified ? (
                <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-white p-8 rounded-2xl max-w-lg w-full shadow-2xl space-y-6">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">❌</span>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900">Disqualified</h2>
                        <p className="text-slate-600">
                            You have been removed from the contest for exiting fullscreen mode too many times. Your access has been revoked.
                        </p>
                        <Button
                            className="bg-red-600 hover:bg-red-700 w-full"
                            onClick={() => navigate(createPageUrl('Home'))}
                        >
                            Return to Home
                        </Button>
                    </div>
                </div>
            ) : (!isFullscreen && isContestActive) ? (
                <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                    <div className="mb-6 w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                        <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Fullscreen Required</h2>
                    <p className="text-slate-400 mb-2 max-w-md">
                        This contest must be taken in fullscreen mode. Exiting fullscreen has been logged as a violation.
                    </p>
                    <p className="text-red-400 text-sm mb-8 font-medium">
                        ⚠️ {antiCheat.violations.filter(v => v.type === 'fullscreen_exit').length} fullscreen exit(s) recorded
                    </p>
                    <button
                        onClick={async () => {
                            try { 
                                const el = document.documentElement;
                                // Suppress the blur that fires during fullscreen transition
                                antiCheat.suppressNextBlur();
                                if (el.requestFullscreen) await el.requestFullscreen();
                                else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
                                else if (el.msRequestFullscreen) await el.msRequestFullscreen();
                            } catch { }
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-10 py-4 rounded-xl text-lg transition-all hover:scale-105 active:scale-95 shadow-xl shadow-emerald-500/30"
                    >
                        ↕ Enter Fullscreen to Continue
                    </button>
                    <p className="text-slate-500 text-xs mt-6">Your timer is still running. Enter immediately.</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Anti-Cheat Warning Overlay */}
            {antiCheat.isWarningVisible && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-start justify-center pt-20">
                    <div className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-bounce pointer-events-auto">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <span className="font-semibold">⚠️ Activity Monitored — This action has been logged</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Lock Warning */}
            <AlertDialog open={showNavWarning} onOpenChange={setShowNavWarning}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            🚫 Contest In Progress — Navigation Blocked
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <p>You cannot leave the contest page while the hackathon is running. This attempt has been <strong>logged as a violation</strong>.</p>
                            <p className="text-slate-500 text-sm mt-2">Repeated attempts to navigate away may affect your score or result in disqualification.</p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction
                            className="bg-emerald-600 hover:bg-emerald-700 w-full"
                            onClick={() => setShowNavWarning(false)}
                        >
                            ✅ Stay in Contest
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Anti-Cheat Status Bar — always visible during active contest */}
            {isContestActive && (
                <div className={`border-b px-4 py-2 ${antiCheat.violations.length > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm flex-wrap">
                            <span className={`font-semibold ${antiCheat.violations.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {antiCheat.violations.length > 0 ? '⚠️ Anti-Cheat Monitor' : '✅ Anti-Cheat Monitor'}
                            </span>
                            {antiCheat.violations.length === 0 ? (
                                <span className="text-emerald-600 text-sm">No violations detected</span>
                            ) : (
                                <span className="text-red-500 flex gap-3 flex-wrap">
                                    {antiCheat.tabSwitchCount > 0 && <span>🔄 {antiCheat.tabSwitchCount} tab switch{antiCheat.tabSwitchCount !== 1 ? 'es' : ''}</span>}
                                    {antiCheat.pasteCount > 0 && <span>📋 {antiCheat.pasteCount} paste{antiCheat.pasteCount !== 1 ? 's' : ''}</span>}
                                    {antiCheat.fullscreenExitCount > 0 && <span>📺 {antiCheat.fullscreenExitCount} fullscreen exit{antiCheat.fullscreenExitCount !== 1 ? 's' : ''}</span>}
                                </span>
                            )}
                        </div>
                        <Badge className={antiCheat.violations.length > 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                            {antiCheat.violations.length} violation{antiCheat.violations.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (isContestActive) {
                                        setShowNavWarning(true);
                                    } else {
                                        navigate(createPageUrl('Dashboard'));
                                    }
                                }}
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900">{team.name}</h1>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <p className="text-sm text-slate-500">{hackathon?.title}</p>
                                    {totalRounds > 1 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                                            Round {currentRound} of {totalRounds}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Database Status */}
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${dbReady ? 'bg-emerald-100' : 'bg-amber-100'
                                }`}>
                                <Database className={`w-4 h-4 ${dbReady ? 'text-emerald-600' : 'text-amber-600'}`} />
                                <span className={`text-sm font-medium ${dbReady ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {dbReady ? 'DB Ready' : 'Loading DB...'}
                                </span>
                            </div>

                            {/* Reset Database Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => {
                                    if (window.confirm("Are you sure you want to reset your database? All your manual inserts or drops will be lost, and the original hackathon schema will be restored.")) {
                                        resetWorkspace();
                                        toast.success("Database restored to original state");
                                    }
                                }}
                                disabled={!dbReady}
                                title="Reset database to initial state"
                            >
                                <RotateCcw className="w-4 h-4 md:mr-1.5" />
                                <span className="hidden md:inline">Reset DB</span>
                            </Button>

                            {/* Browse Database Toggle */}
                            <Button
                                variant={showDbExplorer ? 'default' : 'outline'}
                                size="sm"
                                className={showDbExplorer ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'border-violet-200 text-violet-600 hover:bg-violet-50'}
                                onClick={() => setShowDbExplorer(!showDbExplorer)}
                                disabled={!dbReady}
                            >
                                <Eye className="w-4 h-4 mr-1.5" />
                                {showDbExplorer ? 'Back to Challenges' : 'Browse Database'}
                            </Button>

                            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                                <span className="text-xs text-slate-500">Join Code:</span>
                                <code className="font-mono font-bold text-slate-900">{team.join_code}</code>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyJoinCode}>
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>

                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-100 rounded-lg">
                                <Trophy className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-emerald-700">{team.total_score || 0} pts</span>
                            </div>

                            {/* Round Timer — shown only in multi-round hackathons with per-round end_time */}
                            {roundTimeLeft && hackathon?.total_rounds > 1 && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                                    isRoundTimeUp ? 'bg-red-100 text-red-700' :
                                    roundTimeLeft === 'Not Started' ? 'bg-slate-100 text-slate-600' :
                                    'bg-violet-100 text-violet-700'
                                }`}>
                                    <Clock className="w-4 h-4" />
                                    <div className="text-xs">
                                        <div className="font-semibold text-[10px] uppercase tracking-wider opacity-70">Round {currentRound}</div>
                                        <span className="font-mono font-bold text-sm">{roundTimeLeft}</span>
                                    </div>
                                </div>
                            )}

                            {/* Overall hackathon timer */}
                            {timeRemaining && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${getTimerColor()}`}>
                                    <Clock className="w-4 h-4" />
                                    <div className="text-xs">
                                        {hackathon?.total_rounds > 1 && <div className="font-semibold text-[10px] uppercase tracking-wider opacity-70">Overall</div>}
                                        <span className="font-mono font-bold text-sm">{timeRemaining}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {totalChallenges > 0 && (
                        <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                <span>{completedChallenges} of {totalChallenges} challenges completed</span>
                                <span>{Math.round(progressPercent)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                            {/* Member Contributions */}
                            {team.member_scores && Object.keys(team.member_scores).length > 0 && (
                                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Contributions:</span>
                                    {Object.entries(team.member_scores).map(([email, score]) => {
                                        const memberName = team.members?.find(m => m.email === email)?.name || email.split('@')[0];
                                        const isMe = user?.email === email;
                                        return (
                                            <div key={email} className={`flex items-center gap-1.5 border rounded-full px-2.5 py-0.5 text-xs ${isMe ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                                                <span className={`font-medium ${isMe ? 'text-emerald-800' : 'text-slate-700'}`}>{memberName} {isMe && '(You)'}</span>
                                                <span className={isMe ? 'text-emerald-200' : 'text-slate-300'}>|</span>
                                                <span className={`font-bold ${isMe ? 'text-emerald-600' : 'text-emerald-500'}`}>{score} pts</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl w-full mx-auto p-4 flex-1 min-h-0">
                {showDbExplorer ? (
                    /* ===== Full Database Browser Mode ===== */
                    <div className="space-y-4 h-full flex flex-col">
                        <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                            <Database className="w-6 h-6 text-violet-500" />
                            <h2 className="text-xl font-bold text-slate-900">Database Browser</h2>
                            <p className="text-sm text-slate-500">Explore tables, columns, and data — just like a SQLite browser</p>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border bg-white shadow-sm">
                            <DatabaseExplorer sqlEngineRef={sqlEngineRef} dbReady={dbReady} />
                        </div>
                    </div>
                ) : (
                    /* ===== Challenge Mode ===== */
                    <div className="grid lg:grid-cols-4 gap-6 h-full pb-8">
                        {/* Left Sidebar - Challenges & Schema */}
                        <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1 pb-4 custom-scrollbar">
                            <h2 className="text-lg font-semibold text-slate-900 mb-4">Challenges</h2>
                            {challenges.length === 0 ? (
                                <Card className="border-0 shadow-sm">
                                    <CardContent className="p-6 text-center text-slate-500">
                                        No challenges available yet
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-3">
                                    {challenges.map(challenge => {
                                        const { status, score } = getChallengeStatus(challenge);
                                        return (
                                            <ChallengeCard
                                                key={challenge.id}
                                                challenge={challenge}
                                                status={status}
                                                score={score}
                                                isSelected={selectedChallenge?.id === challenge.id}
                                                onClick={() => {
                                                    setSelectedChallenge(challenge);
                                                    setSqlQuery('');
                                                    setHintsUsed(0);
                                                    setSubmissionResult(null);
                                                    setQueryResult(null);
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            )}

                            {/* Schema Viewer */}
                            {(hackathon?.database_schema || effectiveDbUrl) && (
                                <SchemaViewer schema={hackathon.database_schema} dbFileUrl={effectiveDbUrl} />
                            )}

                            {/* Team Members */}
                            <Card className="border-0 shadow-sm">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        Team Members
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {team.members?.map((member, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium">
                                                    {member.name?.[0] || member.email?.[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{member.name || member.email}</div>
                                                    <div className="text-xs text-slate-400">{member.role}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Main Workspace */}
                        <div className="lg:col-span-2 overflow-y-auto pr-1 pb-4 custom-scrollbar">
                            {selectedChallenge ? (
                                <div className="space-y-4">
                                    <Card className="border-0 shadow-lg">
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <Badge className={`mb-2 ${selectedChallenge.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                        selectedChallenge.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                            selectedChallenge.difficulty === 'hard' ? 'bg-orange-100 text-orange-700' :
                                                                'bg-red-100 text-red-700'
                                                        }`}>
                                                        {selectedChallenge.difficulty}
                                                    </Badge>
                                                    <CardTitle>{selectedChallenge.title}</CardTitle>
                                                </div>
                                                <Badge variant="outline" className="text-lg">
                                                    {selectedChallenge.points} pts
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="prose prose-sm text-slate-600 whitespace-pre-wrap">
                                                {selectedChallenge.description}
                                            </div>

                                            {/* Hints */}
                                            {selectedChallenge.hints?.length > 0 && (
                                                <div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setShowHints(true)}
                                                    >
                                                        <Lightbulb className="w-4 h-4 mr-2" />
                                                        View Hints ({selectedChallenge.hints.length})
                                                    </Button>
                                                </div>
                                            )}

                                            {/* SQL Editor */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-slate-700">Your Query</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={resetWorkspace}
                                                    >
                                                        <RotateCcw className="w-4 h-4 mr-1" />
                                                        Reset
                                                    </Button>
                                                </div>
                                                <CodeEditor
                                                    value={sqlQuery}
                                                    onChange={setSqlQuery}
                                                    placeholder="-- Write your SQL query here..."
                                                />
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-3">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 h-12"
                                                    onClick={runQuery}
                                                    disabled={!sqlQuery.trim() || isRunning || !dbReady}
                                                >
                                                    {isRunning ? (
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <Terminal className="w-4 h-4 mr-2" />
                                                    )}
                                                    Run Query
                                                </Button>
                                                <Button
                                                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={handleSubmitClick}
                                                    disabled={
                                                        !sqlQuery.trim() || isSubmitting || !dbReady ||
                                                        hackathon?.status === 'completed' ||
                                                        (hackathon?.end_time && new Date() >= new Date(hackathon.end_time)) ||
                                                        isRoundTimeUp
                                                    }
                                                >
                                                    {isSubmitting ? (
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <Send className="w-4 h-4 mr-2" />
                                                    )}
                                                    {isRoundTimeUp
                                                        ? 'Round Time Up'
                                                        : (hackathon?.status === 'completed' || (hackathon?.end_time && new Date() >= new Date(hackathon.end_time)))
                                                            ? 'Contest Ended'
                                                            : 'Submit Solution'}
                                                </Button>
                                            </div>

                                            {/* Keyboard Shortcut Hints */}
                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                <span><kbd className="px-1.5 py-0.5 bg-slate-100 rounded border text-[10px]">Ctrl+Enter</kbd> Run Query</span>
                                                <span><kbd className="px-1.5 py-0.5 bg-slate-100 rounded border text-[10px]">Ctrl+Shift+Enter</kbd> Submit</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Query Results */}
                                    {queryResult && (
                                        <QueryResultsTable
                                            result={queryResult}
                                            expectedOutput={selectedChallenge.expected_output}
                                            orderSensitive={selectedChallenge.order_sensitive}
                                        />
                                    )}

                                    {/* Submission Result */}
                                    {submissionResult && (
                                        <Card className={`border-0 shadow-md ${submissionResult.isCorrect
                                            ? 'bg-emerald-50'
                                            : 'bg-red-50'
                                            }`}>
                                            <CardContent className="p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {submissionResult.isCorrect ? (
                                                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                                    ) : (
                                                        <X className="w-6 h-6 text-red-600" />
                                                    )}
                                                    <span className={`font-semibold text-lg ${submissionResult.isCorrect ? 'text-emerald-700' : 'text-red-700'
                                                        }`}>
                                                        {submissionResult.isCorrect ? '🎉 Correct!' : 'Not quite right'}
                                                    </span>
                                                    {submissionResult.score > 0 && (
                                                        <Badge className="ml-auto bg-emerald-100 text-emerald-700 text-lg px-3 py-1">
                                                            +{submissionResult.score} pts
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-slate-600">{submissionResult.feedback}</p>
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Query History */}
                                    {queryHistory.length > 0 && (
                                        <Card className="border-0 shadow-sm">
                                            <CardContent className="p-3">
                                                <button
                                                    onClick={() => setShowHistory(!showHistory)}
                                                    className="flex items-center justify-between w-full text-sm font-medium text-slate-700 hover:text-slate-900"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <History className="w-4 h-4" />
                                                        Query History ({queryHistory.length})
                                                    </span>
                                                    {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                                {showHistory && (
                                                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                                                        {queryHistory.map((entry, i) => (
                                                            <button
                                                                key={i}
                                                                onClick={() => setSqlQuery(entry.query)}
                                                                className="w-full text-left p-2 rounded hover:bg-slate-50 text-xs border border-slate-100 flex items-center gap-2"
                                                            >
                                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                                <code className="flex-1 truncate text-slate-600">{entry.query}</code>
                                                                <span className="text-slate-400 flex-shrink-0">
                                                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            ) : (
                                <Card className="border-0 shadow-lg h-96 flex items-center justify-center">
                                    <div className="text-center">
                                        <Play className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a Challenge</h3>
                                        <p className="text-slate-500 mb-4">Choose a challenge from the list to start coding</p>
                                        <Button
                                            variant="outline"
                                            className="border-violet-200 text-violet-600 hover:bg-violet-50"
                                            onClick={() => setShowDbExplorer(true)}
                                            disabled={!dbReady}
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            Browse Database First
                                        </Button>
                                    </div>
                                </Card>
                            )}
                        </div>

                        {/* Right Sidebar - Leaderboard */}
                        <div className="lg:col-span-1 overflow-y-auto pr-1 pb-4 custom-scrollbar">
                            <Leaderboard teams={allTeams} currentTeamId={teamId} />
                        </div>
                    </div>
                )}
            </div>

            {/* Hints Dialog */}
            <Dialog open={showHints} onOpenChange={setShowHints}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hints</DialogTitle>
                        <DialogDescription>
                            Using hints will reduce your points for this challenge
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        {selectedChallenge?.hints?.map((hint, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded-lg border ${index < hintsUsed
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-slate-50 border-slate-200'
                                    }`}
                            >
                                {index < hintsUsed ? (
                                    <p className="text-sm text-slate-700">{hint.text}</p>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-500">Hint {index + 1}</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setHintsUsed(index + 1)}
                                        >
                                            Reveal (-{hint.point_penalty} pts)
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Item 7: Submit Confirmation Dialog */}
            <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to submit your final SQL query for scoring? This action will use your attempt and evaluate the result.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-emerald-600 hover:bg-emerald-700" onClick={submitSolution}>
                            Confirm Submission
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

                </div>
            )}
        </div>
    );
}
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useAntiCheat — Monitors participant behavior during a hackathon.
 * 
 * Detects:
 * - Tab/window focus switches (visibilitychange + blur/focus)
 * - Paste events in the SQL editor
 * - Rapid submission attempts (cooldown enforcement)
 * - Right-click / context menu (potential copy attempts)
 * - Fullscreen exits
 * 
 * Stores violations in localStorage keyed by teamId and
 * exposes them for display/submission to the backend.
 * 
 * Multi-device: call syncFromBackend(team.violations) after team data
 * loads to restore violations from Supabase on any device.
 */
export default function useAntiCheat(teamId, enabled = true) {
    const [violations, setViolations] = useState([]);
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [pasteCount, setPasteCount] = useState(0);
    const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
    const [lastSubmitTime, setLastSubmitTime] = useState(0);
    const [isWarningVisible, setIsWarningVisible] = useState(false);
    const warningTimeoutRef = useRef(null);

    // Guard: suppress blur events briefly after requestFullscreen() is called.
    // When fullscreen is requested the browser blurs the window momentarily — without
    // this guard that registers a spurious 'window_blur' violation.
    const enteringFullscreenRef = useRef(false);

    const SUBMIT_COOLDOWN_MS = 10000; // 10 second cooldown between submissions
    const STORAGE_KEY = `anticheat_${teamId}`;

    // Load saved violations from localStorage (same-device persistence)
    useEffect(() => {
        if (!teamId) return;
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                setViolations(data.violations || []);
                setTabSwitchCount(data.tabSwitchCount || 0);
                setPasteCount(data.pasteCount || 0);
                setFullscreenExitCount(data.fullscreenExitCount || 0);
            }
        } catch { /* ignore */ }
    }, [teamId, STORAGE_KEY]);

    // Save violations to localStorage whenever any count changes
    // FIX: fullscreenExitCount was missing from the dep array — it is now included
    // so fullscreen exit counts survive same-device page reloads.
    useEffect(() => {
        if (!teamId) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                violations,
                tabSwitchCount,
                pasteCount,
                fullscreenExitCount
            }));
        } catch { /* ignore */ }
    }, [violations, tabSwitchCount, pasteCount, fullscreenExitCount, teamId, STORAGE_KEY]);

    // Add a violation
    const addViolation = useCallback((type, detail) => {
        const violation = {
            type,
            detail,
            timestamp: new Date().toISOString()
        };
        setViolations(prev => [...prev, violation]);

        // Show warning overlay briefly
        setIsWarningVisible(true);
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = setTimeout(() => setIsWarningVisible(false), 3000);

        return violation;
    }, []);

    // --- Tab/Focus Switch Detection ---
    useEffect(() => {
        if (!enabled || !teamId) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setTabSwitchCount(prev => prev + 1);
                addViolation('tab_switch', 'Switched away from hackathon tab');
            }
        };

        const handleBlur = () => {
            // Suppress blur that fires when requestFullscreen() is called —
            // the browser momentarily loses focus during the fullscreen transition.
            if (enteringFullscreenRef.current) return;

            // window blur can fire even within the same page (e.g. devtools)
            // We only count it if the document is also hidden
            setTimeout(() => {
                if (document.hidden) {
                    // Already handled by visibilitychange
                    return;
                }
                // Still suppress if we just entered fullscreen
                if (enteringFullscreenRef.current) return;
                setTabSwitchCount(prev => prev + 1);
                addViolation('window_blur', 'Window lost focus');
            }, 100);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [enabled, teamId, addViolation]);

    // --- Copy/Cut/Paste/Screenshot/Right-click Detection ---
    useEffect(() => {
        if (!enabled || !teamId) return;

        const handleCopy = (e) => {
            // FIX: Allow copying from within the SQL code editor — participants must
            // be able to copy/paste their own typed queries. Only flag copies of
            // challenge descriptions, expected outputs, etc. from the rest of the page.
            if (e.target.closest?.('.cm-editor, .cm-content, .cm-line, textarea')) return;
            e.preventDefault();
            addViolation('copy', 'Copied content from the page');
        };

        const handleCut = (e) => {
            // Same logic: allow cut within the editor
            if (e.target.closest?.('.cm-editor, .cm-content, .cm-line, textarea')) return;
            e.preventDefault();
            addViolation('cut', 'Cut content from the page');
        };

        const handleDocPaste = (e) => {
            // Paste anywhere on the document (including the editor) is flagged.
            // We prevent it so the code editor's onPaste never fires either,
            // avoiding a double-count.
            e.preventDefault();
            setPasteCount(prev => prev + 1);
            addViolation('paste', 'Pasted content into the page');
        };

        const handleKeyUp = (e) => {
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                addViolation('screenshot', 'Screenshot attempt detected (PrintScreen)');
            }
        };

        const handleContextMenu = (e) => {
            e.preventDefault();
            addViolation('right_click', 'Right-click context menu opened');
        };

        document.addEventListener('copy', handleCopy);
        document.addEventListener('cut', handleCut);
        document.addEventListener('paste', handleDocPaste);
        window.addEventListener('keyup', handleKeyUp);
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('cut', handleCut);
            document.removeEventListener('paste', handleDocPaste);
            window.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [enabled, teamId, addViolation]);

    // --- Paste Detection (kept for API compatibility; document listener is the authority) ---
    // FIX: Previously calling this from CodeEditor caused double-counting because
    // handleDocPaste (above) already fires on document paste and calls preventDefault(),
    // which stops the event from reaching the editor's onPaste handler anyway.
    // This is now a no-op so callers don't need to be updated.
    const handlePaste = useCallback(() => {
        // No-op: document-level paste listener handles detection and prevention.
    }, []);

    // --- Submission Cooldown ---
    const canSubmit = useCallback(() => {
        const now = Date.now();
        const timeSinceLastSubmit = now - lastSubmitTime;
        return timeSinceLastSubmit >= SUBMIT_COOLDOWN_MS;
    }, [lastSubmitTime, SUBMIT_COOLDOWN_MS]);

    const getCooldownRemaining = useCallback(() => {
        const now = Date.now();
        const remaining = SUBMIT_COOLDOWN_MS - (now - lastSubmitTime);
        return Math.max(0, Math.ceil(remaining / 1000));
    }, [lastSubmitTime, SUBMIT_COOLDOWN_MS]);

    const recordSubmission = useCallback(() => {
        setLastSubmitTime(Date.now());
    }, []);

    // --- Get violation summary for storing with submissions ---
    const getViolationSummary = useCallback(() => {
        return {
            tab_switches: tabSwitchCount,
            paste_count: pasteCount,
            fullscreen_exits: fullscreenExitCount,
            total_violations: violations.length,
            violations: violations.slice(-20) // Last 20 violations
        };
    }, [tabSwitchCount, pasteCount, fullscreenExitCount, violations]);

    // Log a fullscreen exit
    const logFullscreenExit = useCallback(() => {
        setFullscreenExitCount(prev => prev + 1);
        addViolation('fullscreen_exit', 'Exited fullscreen mode');
    }, [addViolation]);

    /**
     * suppressNextBlur — call this BEFORE calling requestFullscreen().
     * Prevents the blur event that fires during the fullscreen transition
     * from being logged as a window_blur violation.
     */
    const suppressNextBlur = useCallback(() => {
        enteringFullscreenRef.current = true;
        setTimeout(() => { enteringFullscreenRef.current = false; }, 1500);
    }, []);

    /**
     * syncFromBackend — Multi-device sync.
     * Call this once after the team's Supabase row has loaded.
     * Takes the MAX of backend vs local counts so no device can go backwards.
     * This ensures a participant who earned violations on device A will have
     * those counts correctly initialised on device B.
     */
    const syncFromBackend = useCallback((summary) => {
        if (!summary) return;
        setTabSwitchCount(prev => Math.max(prev, summary.tab_switches || 0));
        setPasteCount(prev => Math.max(prev, summary.paste_count || 0));
        setFullscreenExitCount(prev => Math.max(prev, summary.fullscreen_exits || 0));
        // If backend has more violations than we have locally, pad the log
        const backendTotal = summary.total_violations || 0;
        setViolations(prev => {
            if (backendTotal > prev.length && summary.violations?.length) {
                // Use backend's violation log as the authoritative list
                return summary.violations;
            }
            return prev;
        });
    }, []);

    // Clear all violations (for Admin "Forgive" feature)
    const clearAllViolations = useCallback(() => {
        setViolations([]);
        setTabSwitchCount(0);
        setPasteCount(0);
        setFullscreenExitCount(0);
        setIsWarningVisible(false);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* ignore */ }
    }, [STORAGE_KEY]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        };
    }, []);

    return {
        violations,
        tabSwitchCount,
        pasteCount,
        fullscreenExitCount,
        isWarningVisible,
        handlePaste,
        canSubmit,
        getCooldownRemaining,
        recordSubmission,
        getViolationSummary,
        addViolation,
        logFullscreenExit,
        suppressNextBlur,
        syncFromBackend,
        clearAllViolations
    };
}

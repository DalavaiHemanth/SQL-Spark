import { supabase } from '@/api/supabaseClient';

export const logger = {
    /**
     * Submit an event to the audit_logs table to detect suspicious activity.
     */
    async logAudit({ level = 'info', eventType = 'general', message, details = {}, userEmail = null }) {
        if (window.IS_MOCK_MODE) {
            console.log(`[AUDIT - ${level.toUpperCase()}] [${eventType}] ${message}`, details);
            return;
        }

        try {
            await supabase.from('audit_logs').insert({
                level,
                event_type: eventType,
                message,
                details: details,
                user_email: userEmail
            });
        } catch (error) {
            console.error('Failed to write audit log:', error);
        }
    },

    info(eventType, message, details = {}, userEmail = null) {
        return this.logAudit({ level: 'info', eventType, message, details, userEmail });
    },
    
    warn(eventType, message, details = {}, userEmail = null) {
        return this.logAudit({ level: 'warn', eventType, message, details, userEmail });
    },
    
    error(eventType, message, details = {}, userEmail = null) {
        return this.logAudit({ level: 'error', eventType, message, details, userEmail });
    }
};

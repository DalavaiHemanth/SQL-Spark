// Browser Notification utility (free, no server needed)
// Uses the Web Notifications API — works in all modern browsers

export const notificationUtils = {
    // Request permission on first use
    async requestPermission() {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        const result = await Notification.requestPermission();
        return result === 'granted';
    },

    // Check if allowed
    isSupported() {
        return 'Notification' in window;
    },

    isEnabled() {
        return 'Notification' in window && Notification.permission === 'granted';
    },

    // Send notification
    async send(title, options = {}) {
        const allowed = await this.requestPermission();
        if (!allowed) return null;

        return new Notification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options
        });
    },

    // Common notification templates
    hackathonStarted(hackathonTitle) {
        return this.send('🚀 Hackathon Started!', {
            body: `${hackathonTitle} has started. Go solve some SQL challenges!`,
            tag: 'hackathon-start'
        });
    },

    hackathonEnding(hackathonTitle, minutesLeft) {
        return this.send('⏰ Time Running Out!', {
            body: `Only ${minutesLeft} minutes left in ${hackathonTitle}!`,
            tag: 'hackathon-ending'
        });
    },

    resultsPublished(hackathonTitle) {
        return this.send('🏆 Results Published!', {
            body: `Results for ${hackathonTitle} are now available. Check your ranking!`,
            tag: 'results-published'
        });
    },

    submissionResult(isCorrect, challengeTitle) {
        return this.send(
            isCorrect ? '✅ Correct Answer!' : '❌ Incorrect',
            {
                body: isCorrect
                    ? `Your solution for "${challengeTitle}" is correct! Points awarded.`
                    : `Your solution for "${challengeTitle}" needs work. Try again!`,
                tag: 'submission-result'
            }
        );
    }
};

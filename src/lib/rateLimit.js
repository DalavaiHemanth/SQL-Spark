export class RateLimiter {
    constructor(keyPrefix, limit, windowMs) {
        this.keyPrefix = keyPrefix;
        this.limit = limit;
        this.windowMs = windowMs;
    }

    _getKey(identifier) {
        return `ratelimit_${this.keyPrefix}_${identifier}`;
    }

    _getHistory(identifier) {
        const key = this._getKey(identifier);
        const rawData = localStorage.getItem(key);
        let history = [];
        if (rawData) {
            try {
                history = JSON.parse(rawData);
            } catch (e) {
                history = [];
            }
        }
        
        // Filter history to requests entirely within the current sliding window
        const now = Date.now();
        history = history.filter(timestamp => now - timestamp < this.windowMs);
        return history;
    }

    /**
     * Attempts to consume a token. Returns false if limit is exceeded.
     */
    check(identifier = 'global') {
        // Exclude mock mode testing
        if (window.IS_MOCK_MODE) return true;

        const history = this._getHistory(identifier);
        if (history.length >= this.limit) {
            return false;
        }

        history.push(Date.now());
        localStorage.setItem(this._getKey(identifier), JSON.stringify(history));
        return true;
    }

    /**
     * Get remaining time in seconds until the lockout is cleared.
     */
    getRemainingTimeSeconds(identifier = 'global') {
        const history = this._getHistory(identifier);
        if (history.length >= this.limit && history.length > 0) {
            const oldest = history[0];
            const now = Date.now();
            return Math.ceil((oldest + this.windowMs - now) / 1000);
        }
        return 0;
    }
    
    /**
     * Reset the limiter after a successful operation (e.g., successful login)
     */
    clear(identifier = 'global') {
        localStorage.removeItem(this._getKey(identifier));
    }
}

// Global configurations:
// generic API operations: 300 requests per 1 minute
export const apiLimiter = new RateLimiter('api', 300, 60000);

// authentication brute force: 5 attempts per 30 seconds
export const loginLimiter = new RateLimiter('login', 5, 30000);

// mass registration script protection: 3 registrations per hour per IP/browser
export const registerLimiter = new RateLimiter('register', 3, 3600000);

// template generation spam protection: 10 generations per minute
export const generationLimiter = new RateLimiter('generation', 10, 60000);

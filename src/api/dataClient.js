// Supabase-backed data client — same API shape as the old localStorage version
// Pages use db.entities.X.create/list/filter/update/delete — no page changes needed

import { supabase } from './supabaseClient';
import { logger } from '@/lib/logger';
import { apiLimiter, registerLimiter } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/utils';

function createEntityStore(tableName) {
    const localStorageKey = `sqlspark_${tableName}`;

    const getLocalData = () => JSON.parse(localStorage.getItem(localStorageKey) || '[]');
    const setLocalData = (data) => localStorage.setItem(localStorageKey, JSON.stringify(data));

    return {
        async create(data) {
            if (!apiLimiter.check('write')) {
                logger.warn('abuse', `API Rate limit exceeded on create ${tableName}`);
                throw new Error('429: Too many requests. Please slow down.');
            }
            if (window.IS_MOCK_MODE) {
                const items = getLocalData();
                const newItem = {
                    id: crypto.randomUUID(),
                    created_at: new Date().toISOString(),
                    ...data
                };
                items.push(newItem);
                setLocalData(items);
                return newItem;
            }
            const { data: result, error } = await supabase
                .from(tableName)
                .insert(data)
                .select()
                .single();
            if (error) {
                logger.error('api', `Failed to create entity in ${tableName}`, { error: error.message, data });
                throw error;
            }
            return result;
        },

        async list(sortField) {
            if (window.IS_MOCK_MODE) {
                let items = getLocalData();
                if (sortField) {
                    const desc = sortField.startsWith('-');
                    const field = desc ? sortField.slice(1) : sortField;
                    items.sort((a, b) => {
                        if (a[field] < b[field]) return desc ? 1 : -1;
                        if (a[field] > b[field]) return desc ? -1 : 1;
                        return 0;
                    });
                }
                return items;
            }
            let query = supabase.from(tableName).select('*');
            if (sortField) {
                const desc = sortField.startsWith('-');
                const field = desc ? sortField.slice(1) : sortField;
                query = query.order(field, { ascending: !desc });
            }
            const { data, error } = await query;
            if (error) {
                logger.error('api', `List query failed on ${tableName}`, { error: error.message, sortField });
                throw error;
            }
            return data || [];
        },

        async filter(criteria, sortField) {
            if (window.IS_MOCK_MODE) {
                let items = getLocalData();
                items = items.filter(item => {
                    return Object.entries(criteria).every(([key, value]) => {
                        if (value && typeof value === 'object' && value.$in) {
                            return value.$in.includes(item[key]);
                        }
                        return item[key] === value;
                    });
                });
                if (sortField) {
                    const desc = sortField.startsWith('-');
                    const field = desc ? sortField.slice(1) : sortField;
                    items.sort((a, b) => {
                        if (a[field] < b[field]) return desc ? 1 : -1;
                        if (a[field] > b[field]) return desc ? -1 : 1;
                        return 0;
                    });
                }
                return items;
            }
            let query = supabase.from(tableName).select('*');

            for (const [key, value] of Object.entries(criteria)) {
                if (value && typeof value === 'object' && value.$in) {
                    query = query.in(key, value.$in);
                } else {
                    query = query.eq(key, value);
                }
            }

            if (sortField) {
                const desc = sortField.startsWith('-');
                const field = desc ? sortField.slice(1) : sortField;
                query = query.order(field, { ascending: !desc });
            }

            const { data, error } = await query;
            if (error) {
                logger.error('api', `Filter query failed on ${tableName}`, { error: error.message, criteria });
                throw error;
            }
            return data || [];
        },

        async update(id, data) {
            if (!apiLimiter.check('write')) {
                logger.warn('abuse', `API Rate limit exceeded on update ${tableName}`);
                throw new Error('429: Too many requests. Please slow down.');
            }
            if (window.IS_MOCK_MODE) {
                const items = getLocalData();
                const index = items.findIndex(item => item.id === id);
                if (index === -1) throw new Error('Item not found');
                items[index] = { ...items[index], ...data, updated_at: new Date().toISOString() };
                setLocalData(items);
                return items[index];
            }
            const { data: result, error } = await supabase
                .from(tableName)
                .update(data)
                .eq('id', id)
                .select()
                .single();
            if (error) {
                logger.error('api', `Update failed on ${tableName}`, { error: error.message, id, data });
                throw error;
            }
            return result;
        },

        async delete(id) {
            if (!apiLimiter.check('write')) {
                logger.warn('abuse', `API Rate limit exceeded on delete ${tableName}`);
                throw new Error('429: Too many requests. Please slow down.');
            }
            if (window.IS_MOCK_MODE) {
                const items = getLocalData();
                const newItems = items.filter(item => item.id !== id);
                setLocalData(newItems);
                return;
            }
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', id);
            if (error) {
                logger.error('api', `Delete failed on ${tableName}`, { error: error.message, id });
                throw error;
            }
        }
    };
}

// Auth wrapper using Supabase Auth (with Mock Mode fallback)
const auth = {
    async login({ email, password }) {
        if (!isValidEmail(email)) {
            throw { status: 403, message: 'Only @gmail.com and @rgmcet.edu accounts are allowed' };
        }
        if (window.IS_MOCK_MODE) {
            // Mock admin for local dev only
            if (email === 'admin@sqlspark.com' && password === 'admin123') {
                const user = { email, full_name: 'System Admin', role: 'organizer' };
                localStorage.setItem('sqlspark_session', JSON.stringify(user));
                return user;
            }
            // For other users, check "users" table in mock mode
            const users = JSON.parse(localStorage.getItem('sqlspark_users') || '[]');
            const user = users.find(u => u.email === email && u.password === password);
            if (!user) throw { status: 401, message: 'Invalid email or password' };

            const sessionUser = { email: user.email, full_name: user.full_name, role: user.role };
            localStorage.setItem('sqlspark_session', JSON.stringify(sessionUser));
            return sessionUser;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            logger.warn('auth', 'Failed login attempt', { error: error.message }, email);
            throw { status: 401, message: error.message };
        }
        
        logger.info('auth', 'User logged in successfully', {}, email);
        return {
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || '',
            role: data.user.user_metadata?.role || 'user',
            avatar_style: data.user.user_metadata?.avatar_style || 'initials',
            avatar_seed: data.user.user_metadata?.avatar_seed || data.user.email,
        };
    },

    async register({ email, password, full_name, role = 'user' }) {
        if (!isValidEmail(email)) {
            throw { status: 400, message: 'Only @gmail.com and @rgmcet.edu accounts are allowed' };
        }
        if (!registerLimiter.check(email)) {
             const remaining = registerLimiter.getRemainingTimeSeconds(email);
             logger.warn('abuse', 'Excessive registration attempt blocked', { email, remaining });
             throw { status: 429, message: `Registration rate limit exceeded. Please try again in ${Math.ceil(remaining / 60)} minutes.` };
        }
        if (window.IS_MOCK_MODE) {
            const users = JSON.parse(localStorage.getItem('sqlspark_users') || '[]');
            if (users.some(u => u.email === email)) throw { status: 400, message: 'User already exists' };

            const newUser = { email, password, full_name, role };
            users.push(newUser);
            localStorage.setItem('sqlspark_users', JSON.stringify(users));

            const sessionUser = { email, full_name, role };
            localStorage.setItem('sqlspark_session', JSON.stringify(sessionUser));
            return sessionUser;
        }
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name, role }
            }
        });

        if (error) {
            logger.warn('auth', 'Failed registration attempt', { error: error.message }, email);
            throw { status: 400, message: error.message };
        }
        
        // Handle case where email verification is required (session is null)
        if (!data.session && data.user) {
            logger.info('auth', 'New user registered - awaiting email verification', { role }, email);
            throw { status: 201, message: 'Account created! Please check your email to verify your account before logging in.' };
        }

        logger.info('auth', 'New user registered and logged in', { role }, email);
        return {
            email: data.user.email,
            full_name,
            role,
        };
    },

    async me() {
        if (window.IS_MOCK_MODE) {
            // Check for mock session first (allows mock admin to stay logged in)
            const session = localStorage.getItem('sqlspark_session');
            if (session) return JSON.parse(session);
            throw { status: 401, message: 'Not authenticated' };
        }
        const { data: { session: supabaseSession }, error } = await supabase.auth.getSession();
        if (error || !supabaseSession) {
            throw { status: 401, message: 'Not authenticated' };
        }
        const user = supabaseSession.user;
        return {
            email: user.email,
            full_name: user.user_metadata?.full_name || '',
            role: user.user_metadata?.role || 'user',
            avatar_style: user.user_metadata?.avatar_style || 'initials',
            avatar_seed: user.user_metadata?.avatar_seed || user.email,
        };
    },

    logout() {
        // Always remove mock session to prevent state bleed
        localStorage.removeItem('sqlspark_session');
        if (window.IS_MOCK_MODE) {
            return;
        }
        supabase.auth.signOut();
    },

    async updateUser(payload) {
        if (window.IS_MOCK_MODE) {
            const session = localStorage.getItem('sqlspark_session');
            if (session) {
                const user = JSON.parse(session);
                const updatedUser = { ...user, ...payload };
                localStorage.setItem('sqlspark_session', JSON.stringify(updatedUser));
                return { user: updatedUser };
            }
            throw new Error("Not authenticated");
        }
        const { data, error } = await supabase.auth.updateUser({
            data: payload
        });
        if (error) throw error;
        return data;
    },

    redirectToLogin() {
        window.location.href = '/Login';
    }
};

export const db = {
    auth,
    entities: {
        Hackathon: createEntityStore('hackathons'),
        Challenge: createEntityStore('challenges'),
        Team: createEntityStore('teams'),
        Submission: createEntityStore('submissions'),
    },
};

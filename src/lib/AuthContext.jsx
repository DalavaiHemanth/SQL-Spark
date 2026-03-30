import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { db } from '@/api/dataClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [authError, setAuthError] = useState(null);

    useEffect(() => {
        // Check current session on mount
        checkAuth();

        // Listen for auth state changes (login/logout/token refresh)
        let subscription;
        if (!window.IS_MOCK_MODE) {
            const { data } = supabase.auth.onAuthStateChange(
                (event, session) => {
                    console.log('Auth State Change:', event, session?.user?.email); // DEBUG LOG
                    if (session?.user) {
                        const u = session.user;
                        setUser({
                            email: u.email,
                            full_name: u.user_metadata?.full_name || '',
                            role: u.user_metadata?.role || 'user',
                            avatar_style: u.user_metadata?.avatar_style || 'initials',
                            avatar_seed: u.user_metadata?.avatar_seed || u.email,
                        });
                        setIsAuthenticated(true);
                        setAuthError(null);
                    } else {
                        setUser(null);
                        setIsAuthenticated(false);
                    }
                }
            );
            subscription = data.subscription;
        }

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const checkAuth = async () => {
        console.log('checkAuth called'); // DEBUG LOG
        try {
            setIsLoadingAuth(true);
            const user = await db.auth.me();
            console.log('checkAuth result:', user); // DEBUG LOG

            if (user) {
                setUser(user);
                setIsAuthenticated(true);
                setAuthError(null);
            } else {
                setUser(null);
                setIsAuthenticated(false);
                setAuthError({ type: 'auth_required', message: 'Please log in' });
            }
        } catch (error) {
            // Only log if it's not a standard "unauthenticated" error (which is normal on first load)
            if (error.status !== 401) {
                console.error('checkAuth error:', error);
            }
            setUser(null);
            setIsAuthenticated(false);
            setAuthError({ type: 'auth_required', message: 'Please log in' });
        } finally {
            setIsLoadingAuth(false);
        }
    };

    const logout = async () => {
        await db.auth.logout();
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required', message: 'Please log in' });
    };

    const onLoginSuccess = () => {
        checkAuth();
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoadingAuth,
            isLoadingPublicSettings: false,
            authError,
            logout,
            onLoginSuccess,
            navigateToLogin: () => {
                setAuthError({ type: 'auth_required', message: 'Please log in' });
            },
            checkAppState: checkAuth
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

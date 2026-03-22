import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Database,
    LogIn,
    UserPlus,
    Loader2,
    Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/api/dataClient';
import { logger } from '@/lib/logger';
import { loginLimiter } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/utils'; // Assuming utils.js is in '@/lib'

export default function Login({ onLoginSuccess }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [showResetForm, setShowResetForm] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [loginError, setLoginError] = useState('');
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [lockoutUntil, setLockoutUntil] = useState(null);
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const [registerData, setRegisterData] = useState({
        email: '', password: '', full_name: '', role: 'user'
    });

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (!resetEmail) { toast.error('Please enter your email'); return; }
        if (window.IS_MOCK_MODE) {
            toast.info('Password reset is not available in mock mode. Use admin@sqlspark.com / admin123');
            return;
        }
        setIsLoading(true);
        try {
            const { supabase } = await import('../api/supabaseClient');
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: window.location.origin + '/Login'
            });
            if (error) throw error;
            toast.success('Password reset email sent! Check your inbox.');
            setShowResetForm(false);
        } catch (err) {
            toast.error(err.message || 'Failed to send reset email');
        } finally {
            setIsLoading(false);
        }
    };

    // Redirect if already logged in (and not in modal mode)
    React.useEffect(() => {
        if (user && !onLoginSuccess) {
            navigate('/Dashboard');
        }
    }, [user, onLoginSuccess, navigate]);

    // Handle lockout timer
    const [lockoutRemaining, setLockoutRemaining] = useState(0);
    React.useEffect(() => {
        if (lockoutUntil) {
            setLockoutRemaining(Math.ceil((lockoutUntil - Date.now()) / 1000));
            const timer = setInterval(() => {
                const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
                if (remaining <= 0) {
                    setLockoutUntil(null);
                    setFailedAttempts(0);
                    setLockoutRemaining(0);
                } else {
                    setLockoutRemaining(remaining);
                }
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [lockoutUntil]);

    const handleLogin = async (e) => {
        e.preventDefault();
        
        if (!isValidEmail(loginData.email)) {
            toast.error('Only @gmail.com and @rgmcet.edu accounts are allowed');
            return;
        }

        // Block upfront if local storage limiter says no (prevents refresh bypass)
        if (!loginLimiter.check(loginData.email)) {
            const delay = loginLimiter.getRemainingTimeSeconds(loginData.email);
            setLockoutUntil(Date.now() + delay * 1000);
            toast.error(`Too many attempts. Try again in ${delay}s`);
            return;
        }

        setIsLoading(true);
        setLoginError('');
        try {
            await db.auth.login(loginData);
            toast.success('Welcome back!');
            loginLimiter.clear(loginData.email); // Clear lockout on success
            setFailedAttempts(0);
            if (onLoginSuccess) onLoginSuccess();
            else window.location.reload();
        } catch (err) {
            const msg = err.message || 'Invalid email or password';
            setLoginError(msg);
            
            const remaining = loginLimiter.getRemainingTimeSeconds(loginData.email);
            if (remaining > 0) {
                setLockoutUntil(Date.now() + remaining * 1000);
                logger.warn('abuse', 'Brute force login lockout triggered', { email: loginData.email }, loginData.email);
                toast.error(`Too many failed attempts. Login locked for ${remaining} seconds.`);
            } else {
                toast.error(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (!isValidEmail(registerData.email)) {
            toast.error('Only @gmail.com and @rgmcet.edu accounts are allowed');
            return;
        }

        setIsLoading(true);
        try {
            await db.auth.register(registerData);
            toast.success('Account created!');
            if (onLoginSuccess) onLoginSuccess();
            else window.location.reload();
        } catch (err) {
            console.error('Registration error:', err);
            if (err.status === 201) {
                toast.success(err.message, { duration: 10000 });
                // Switch back to login view or clear fields (optional)
                setRegisterData({ ...registerData, password: '' }); 
            } else {
                toast.error(err.message || 'Registration failed');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
            <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-40 right-10 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
                        <Database className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        SQL <span className="bg-gradient-to-r from-emerald-500 to-blue-500 bg-clip-text text-transparent">Spark</span>
                    </h1>
                    <p className="text-slate-500">Sign in to start competing</p>
                </div>

                <Card className="border-0 shadow-xl">
                    <CardContent className="pt-6">
                        <Tabs defaultValue="login" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-6">
                                <TabsTrigger value="login">
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Sign In
                                </TabsTrigger>
                                <TabsTrigger value="register">
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Register
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="login">

                                <form onSubmit={handleLogin} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="login-email">Email</Label>
                                        <Input
                                            id="login-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={loginData.email}
                                            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                            required
                                            className="h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="login-password">Password</Label>
                                        <Input
                                            id="login-password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={loginData.password}
                                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                            required
                                            className="h-12"
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                                        disabled={isLoading || !!lockoutUntil}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <LogIn className="w-4 h-4 mr-2" />
                                        )}
                                        {lockoutUntil ? `Locked (${lockoutRemaining}s)` : 'Sign In'}
                                    </Button>

                                    {loginError && (
                                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                            </svg>
                                            {loginError}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-center">
                                        <Button
                                            type="button"
                                            variant="link"
                                            className="text-sm text-slate-500 hover:text-emerald-600 px-0"
                                            onClick={() => setShowResetForm(!showResetForm)}
                                        >
                                            Forgot Password?
                                        </Button>
                                    </div>
                                </form>

                                {showResetForm && (
                                    <form onSubmit={handleResetPassword} className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                                        <p className="text-sm font-medium text-blue-800">Reset your password</p>
                                        <Input
                                            type="email"
                                            placeholder="Enter your email"
                                            value={resetEmail}
                                            onChange={(e) => setResetEmail(e.target.value)}
                                            required
                                            className="h-10"
                                        />
                                        <Button type="submit" className="w-full h-10 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                                            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                            Send Reset Link
                                        </Button>
                                    </form>
                                )}
                            </TabsContent>

                            <TabsContent value="register">
                                <form onSubmit={handleRegister} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-name">Full Name</Label>
                                        <Input
                                            id="reg-name"
                                            placeholder="John Doe"
                                            value={registerData.full_name}
                                            onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
                                            required
                                            className="h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-email">Email</Label>
                                        <Input
                                            id="reg-email"
                                            type="email"
                                            placeholder="you@example.com"
                                            value={registerData.email}
                                            onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                            required
                                            className="h-12"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reg-password">Password</Label>
                                        <Input
                                            id="reg-password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={registerData.password}
                                            onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                                            required
                                            className="h-12"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 py-4">
                                        <input
                                            type="checkbox"
                                            id="role-checkbox"
                                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                                            checked={registerData.role === 'organizer'}
                                            onChange={(e) => setRegisterData({ ...registerData, role: e.target.checked ? 'organizer' : 'user' })}
                                        />
                                        <Label htmlFor="role-checkbox" className="font-normal text-slate-700 cursor-pointer select-none">
                                            I want to <strong>Host Hackathons</strong>
                                        </Label>
                                    </div>
                                    <Button
                                        type="submit"
                                        className="w-full h-12 bg-slate-900 hover:bg-slate-800"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <UserPlus className="w-4 h-4 mr-2" />
                                        )}
                                        Create Account
                                    </Button>
                                </form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

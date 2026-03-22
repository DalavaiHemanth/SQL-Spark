import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Database, Home, LayoutDashboard, LogOut, Trophy, User } from 'lucide-react';
import { Toaster } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function Layout({ children, currentPageName }) {
    const hideNav = ['JoinHackathon', 'TeamDashboard', 'AdminHackathon'].includes(currentPageName);
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50">
            <Toaster position="top-center" richColors />

            {!hideNav && (
                <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
                    <div className="max-w-6xl mx-auto px-6">
                        <div className="flex items-center justify-between h-16">
                            <Link to={createPageUrl('Home')} className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
                                    <Database className="w-5 h-5 text-white" />
                                </div>
                                <span className="font-bold text-slate-900">SQL Spark</span>
                            </Link>

                            <div className="flex items-center gap-2">
                                <Link to={createPageUrl('Home')}>
                                    <button className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2">
                                        <Home className="w-4 h-4" />
                                        Home
                                    </button>
                                </Link>
                                {user && (
                                    <Link to={createPageUrl('Profile')}>
                                        <button className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2">
                                            <User className="w-4 h-4" />
                                            Profile
                                        </button>
                                    </Link>
                                )}
                                <Link to={createPageUrl('GlobalLeaderboard')}>
                                    <button className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2">
                                        <Trophy className="w-4 h-4" />
                                        Leaderboard
                                    </button>
                                </Link>
                                <Link to={createPageUrl('Dashboard')}>
                                    <button className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2">
                                        <LayoutDashboard className="w-4 h-4" />
                                        Dashboard
                                    </button>
                                </Link>
                                {user && (
                                    <button
                                        onClick={logout}
                                        className="px-4 py-2 text-sm text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Logout
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </nav>
            )}

            <main>{children}</main>
        </div>
    );
}
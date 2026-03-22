import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Login from '@/pages/Login';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

// Admin route names that require organizer/admin role
const ADMIN_ROUTES = ['AdminDashboard', 'AdminHackathon', 'AdminUsers'];

const AdminGuard = ({ children }) => {
    const { user } = useAuth();
    if (!user || !['admin', 'organizer'].includes(user.role)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Not Authorized</h2>
                    <p className="text-slate-500 mb-4">You don't have permission to access this page.</p>
                    <a href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">← Go Home</a>
                </div>
            </div>
        );
    }
    return children;
};

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
    <Layout currentPageName={currentPageName}>{children}</Layout>
    : <>{children}</>;

const AuthenticatedApp = () => {
    const { isLoadingAuth, authError, onLoginSuccess } = useAuth();


    // Show loading spinner while checking auth
    if (isLoadingAuth) {
        // ... rest of file (loading check, login page, protected routes)
        return (
            <div className="fixed inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
        );
    }

    // Show login page if not authenticated
    if (authError && authError.type === 'auth_required') {
        return <Login onLoginSuccess={onLoginSuccess} />;
    }

    // Render the main app
    return (
        <Routes>
            <Route path="/" element={
                <LayoutWrapper currentPageName={mainPageKey}>
                    <MainPage />
                </LayoutWrapper>
            } />
            {Object.entries(Pages).map(([path, Page]) => {
                const isAdmin = ADMIN_ROUTES.includes(path);
                return (
                    <Route
                        key={path}
                        path={`/${path}`}
                        element={
                            <LayoutWrapper currentPageName={path}>
                                {isAdmin ? (
                                    <AdminGuard><Page /></AdminGuard>
                                ) : (
                                    <Page />
                                )}
                            </LayoutWrapper>
                        }
                    />
                );
            })}
            <Route path="*" element={<PageNotFound />} />
        </Routes>
    );
};


function App() {

    return (
        <AuthProvider>
            <QueryClientProvider client={queryClientInstance}>
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <AuthenticatedApp />
                </Router>
                <Toaster />
            </QueryClientProvider>
        </AuthProvider>
    )
}

export default App

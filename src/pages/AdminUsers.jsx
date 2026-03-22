import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient'; // Direct supabase access for RPC
import { useAuth } from '@/lib/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, MoreHorizontal, Shield, ArrowLeft, UserCog, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsers() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [userToDelete, setUserToDelete] = React.useState(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

    // Redirect non-admins
    React.useEffect(() => {
        if (user && user.role !== 'admin') {
            navigate(createPageUrl('Home'));
        }
    }, [user, navigate]);

    // Fetch users via RPC
    const { data: users = [], isLoading, error } = useQuery({
        queryKey: ['admin-users'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_users');
            if (error) throw error;
            return data;
        },
        retry: false
    });

    // Update role mutation
    const updateRoleMutation = useMutation({
        mutationFn: async ({ email, role }) => {
            const { error } = await supabase.rpc('update_user_role', {
                target_email: email,
                new_role: role
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['admin-users']);
            toast.success('User role updated successfully');
        },
        onError: (err) => {
            toast.error(`Failed to update role: ${err.message}`);
        }
    });

    // Delete user mutation
    const deleteUserMutation = useMutation({
        mutationFn: (email) => db.auth.deleteUserPermanently(email),
        onSuccess: () => {
            queryClient.invalidateQueries(['admin-users']);
            toast.success('User deleted permanently');
            setIsDeleteDialogOpen(false);
            setUserToDelete(null);
        },
        onError: (err) => {
            toast.error(`Failed to delete user: ${err.message}`);
        }
    });

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="text-center">
                    <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied or Error</h2>
                    <p className="text-slate-500 mb-4">{error.message}</p>
                    <p className="text-sm text-slate-400 mb-6">
                        Did you run the <code>admin_setup.sql</code> script in Supabase?
                    </p>
                    <Link to={createPageUrl('AdminDashboard')}>
                        <Button variant="outline">Back to Dashboard</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link to={createPageUrl('AdminDashboard')}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                            <UserCog className="w-8 h-8 text-emerald-600" />
                            User Management
                        </h1>
                        <p className="text-slate-500">Manage user roles and permissions</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>All Users ({users.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead>Last Sign In</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium text-slate-900">
                                            {u.email}
                                            {u.email === user?.email && (
                                                <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={
                                                    u.role === 'admin' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-0' :
                                                        u.role === 'organizer' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-0' :
                                                            'bg-slate-100 text-slate-700 hover:bg-slate-200 border-0'
                                                }
                                            >
                                                {u.role || 'user'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-500">
                                            {new Date(u.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-slate-500">
                                            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : 'Never'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={u.email === user?.email}>
                                                        <MoreHorizontal className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => updateRoleMutation.mutate({ email: u.email, role: 'user' })}
                                                        disabled={u.role !== 'admin' && u.role !== 'organizer'}
                                                    >
                                                        Demote to User
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => updateRoleMutation.mutate({ email: u.email, role: 'organizer' })}
                                                        disabled={u.role === 'organizer'}
                                                    >
                                                        Make Organizer
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-purple-600 focus:text-purple-700 focus:bg-purple-50"
                                                        onClick={() => updateRoleMutation.mutate({ email: u.email, role: 'admin' })}
                                                        disabled={u.role === 'admin'}
                                                    >
                                                        <Shield className="w-3 h-3 mr-2" />
                                                        Make Admin
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                                        onClick={() => {
                                                            setUserToDelete(u.email);
                                                            setIsDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="w-3 h-3 mr-2" />
                                                        Delete User
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete <strong>{userToDelete}</strong> and remove them from all teams. 
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => deleteUserMutation.mutate(userToDelete)}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={deleteUserMutation.isPending}
                            >
                                {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                Delete Permanently
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { db } from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl, getEffectiveHackathonStatus } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
    Plus,
    Trophy,
    Users,
    Target,
    Calendar,
    Loader2,
    Clock,
    Copy,
    Download
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import HackathonCard from '@/components/hackathon/HackathonCard';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [newHackathon, setNewHackathon] = useState({
        title: '',
        description: '',
        status: 'draft',
        max_teams: 50,
        start_time: '',
        end_time: ''
    });

    useEffect(() => {
        if (user && !['admin', 'organizer'].includes(user.role)) {
            navigate(createPageUrl('Home'));
        }
    }, [user, navigate]);

    const { data: hackathons = [], isLoading } = useQuery({
        queryKey: ['all-hackathons'],
        queryFn: async () => {
            const all = await db.entities.Hackathon.list('-created_date');
            if (user?.role === 'admin') return all;
            return all.filter(h => h.created_by === user?.email);
        }
    });

    const isSuperAdmin = user?.role === 'admin';

    const { data: teams = [] } = useQuery({
        queryKey: ['all-teams'],
        queryFn: () => db.entities.Team.list()
    });

    const { data: challenges = [] } = useQuery({
        queryKey: ['all-challenges'],
        queryFn: () => db.entities.Challenge.list()
    });

    const createMutation = useMutation({
        mutationFn: (data) => db.entities.Hackathon.create({
            ...data,
            created_by: user.email // Inject current user email
        }),
        onSuccess: () => {
            queryClient.invalidateQueries(['all-hackathons']);
            setShowCreateDialog(false);
            setNewHackathon({ title: '', description: '', status: 'draft', max_teams: 50, start_time: '', end_time: '' });
            toast.success('Hackathon created!');
        }
    });

    const cloneMutation = useMutation({
        mutationFn: async (hackathon) => {
            const cloned = await db.entities.Hackathon.create({
                title: hackathon.title + ' (Copy)',
                description: hackathon.description,
                status: 'draft',
                max_teams: hackathon.max_teams,
                start_time: '',
                end_time: '',
                database_schema: hackathon.database_schema,
                sample_data: hackathon.sample_data,
                database_source: hackathon.database_source,
                database_file_url: hackathon.database_file_url,
                created_by: user.email
            });
            // Clone all challenges
            const origChallenges = await db.entities.Challenge.filter({ hackathon_id: hackathon.id });
            for (const ch of origChallenges) {
                await db.entities.Challenge.create({
                    hackathon_id: cloned.id,
                    title: ch.title,
                    description: ch.description,
                    difficulty: ch.difficulty,
                    points: ch.points,
                    expected_output: ch.expected_output,
                    solution_query: ch.solution_query,
                    hints: ch.hints,
                    required_keywords: ch.required_keywords,
                    forbidden_keywords: ch.forbidden_keywords,
                    order: ch.order
                });
            }
            return cloned;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['all-hackathons']);
            queryClient.invalidateQueries(['all-challenges']);
            toast.success('Hackathon cloned successfully!');
        },
        onError: () => toast.error('Failed to clone hackathon')
    });

    const getTeamCount = (hackathonId) =>
        teams.filter(t => t.hackathon_id === hackathonId).length;

    const handleDownloadCSV = (hackathon) => {
        const hackathonTeams = teams
            .filter(t => t.hackathon_id === hackathon.id)
            .sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

        // Create CSV Header
        const headers = [
            'Rank',
            'Team Name',
            'Team Status',
            'Team Total Score',
            'Challenges Solved',
            'Participant Name',
            'Participant Email',
            'Participant Contribution (Pts)',
            'Tab Switches',
            'Paste Violations',
            'Fullscreen Exits'
        ];

        const rows = [];
        hackathonTeams.forEach((team, index) => {
            const rank = index + 1;
            const violations = team.violations || {};
            const tabSwitches = violations.tab_switches || 0;
            const pastes = violations.pastes || 0;
            const fullscreenExits = violations.fullscreen_exits || 0;
            
            // If team has no members yet, still output the team row
            if (!team.members || team.members.length === 0) {
                rows.push([
                    rank,
                    `"${team.name}"`,
                    team.status || 'active',
                    team.total_score || 0,
                    team.challenges_completed || 0,
                    'N/A',
                    'N/A',
                    '0',
                    tabSwitches,
                    pastes,
                    fullscreenExits
                ]);
                return;
            }

            // Generate a row for each participant
            team.members.forEach(member => {
                const isObject = member && typeof member === 'object';
                const email = isObject ? member.email : member;
                const name = isObject ? (member.name || email.split('@')[0]) : email.split('@')[0];
                const individualScore = team.member_scores?.[email] || 0;
                
                rows.push([
                    rank,
                    `"${team.name}"`,
                    team.status || 'active',
                    team.total_score || 0,
                    team.challenges_completed || 0,
                    `"${name}"`,
                    email,
                    individualScore,
                    tabSwitches,
                    pastes,
                    fullscreenExits
                ]);
            });
        });

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${hackathon.title.replace(/\s+/g, '_')}_Results.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Downloaded results for ${hackathon.title}`);
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">
                            {isSuperAdmin ? 'Super Admin Dashboard' : 'Organizer Dashboard'}
                        </h1>
                        <p className="text-slate-500">
                            {isSuperAdmin ? 'Manage ALL SQL hackathons' : 'Manage your hackathons'}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        {isSuperAdmin && (
                            <Link to={createPageUrl('AdminUsers')}>
                                <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                                    <Users className="w-4 h-4 mr-2" />
                                    Manage Users
                                </Button>
                            </Link>
                        )}
                        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Hackathon
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Create New Hackathon</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Title</Label>
                                        <Input
                                            value={newHackathon.title}
                                            onChange={(e) => setNewHackathon({ ...newHackathon, title: e.target.value })}
                                            placeholder="SQL Challenge 2024"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            value={newHackathon.description}
                                            onChange={(e) => setNewHackathon({ ...newHackathon, description: e.target.value })}
                                            placeholder="Describe the hackathon..."
                                            rows={3}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Status</Label>
                                            <Select
                                                value={newHackathon.status}
                                                onValueChange={(v) => setNewHackathon({ ...newHackathon, status: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="draft">Draft</SelectItem>
                                                    <SelectItem value="registration_open">Registration Open</SelectItem>
                                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                                    <SelectItem value="completed">Completed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Max Teams</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={newHackathon.max_teams}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setNewHackathon({ ...newHackathon, max_teams: isNaN(val) ? '' : Math.max(1, val) });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> Start Time</Label>
                                            <Input
                                                type="datetime-local"
                                                value={newHackathon.start_time}
                                                onChange={(e) => setNewHackathon({ ...newHackathon, start_time: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-1"><Clock className="w-3 h-3" /> End Time</Label>
                                            <Input
                                                type="datetime-local"
                                                value={newHackathon.end_time}
                                                onChange={(e) => setNewHackathon({ ...newHackathon, end_time: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => {
                                            const payload = { ...newHackathon };
                                            if (payload.start_time) payload.start_time = new Date(payload.start_time).toISOString();
                                            if (payload.end_time) payload.end_time = new Date(payload.end_time).toISOString();
                                            createMutation.mutate(payload);
                                        }}
                                        disabled={!newHackathon.title || createMutation.isPending}
                                    >
                                        {createMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : null}
                                        Create Hackathon
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Hackathons', value: hackathons.length, icon: Trophy, color: 'text-amber-500' },
                        { label: 'Total Teams', value: teams.length, icon: Users, color: 'text-blue-500' },
                        { label: 'Total Challenges', value: challenges.length, icon: Target, color: 'text-emerald-500' },
                        { label: 'Active Now', value: hackathons.filter(h => getEffectiveHackathonStatus(h) === 'in_progress').length, icon: Calendar, color: 'text-purple-500' }
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <Card className="border-0 shadow-sm">
                                <CardContent className="p-5">
                                    <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
                                    <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                                    <div className="text-sm text-slate-500">{stat.label}</div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Hackathons List */}
                <div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-4">
                        {isSuperAdmin ? 'All Hackathons (Super Admin View)' : 'My Hackathons'}
                    </h2>

                    {isLoading ? (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : hackathons.length === 0 ? (
                        <Card className="border-0 shadow-sm">
                            <CardContent className="p-8 text-center">
                                <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Hackathons Yet</h3>
                                <p className="text-slate-500 mb-4">Create your first hackathon to get started!</p>
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    onClick={() => setShowCreateDialog(true)}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Hackathon
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {hackathons.map((hackathon, i) => (
                                <motion.div
                                    key={hackathon.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <HackathonCard
                                        hackathon={hackathon}
                                        teamCount={getTeamCount(hackathon.id)}
                                        isAdmin={true}
                                        onClone={() => cloneMutation.mutate(hackathon)}
                                        isCloning={cloneMutation.isPending}
                                        onDownload={() => handleDownloadCSV(hackathon)}
                                    />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
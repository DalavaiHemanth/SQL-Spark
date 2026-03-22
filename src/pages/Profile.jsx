import React, { useState, useEffect } from 'react';
import { db } from '@/api/dataClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { User, Mail, Shield, Star, Award, Loader2, Save, RefreshCw, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { getTier, STAR_TIERS } from '@/utils/ranking';

const AVATAR_STYLES = [
    { id: 'initials', name: 'Initials' },
    { id: 'bottts', name: 'Robots' },
    { id: 'adventurer', name: 'Adventurer' },
    { id: 'lorelei', name: 'Lorelei' },
    { id: 'avataaars', name: 'Avatars' },
    { id: 'pixel-art', name: 'Pixels' },
];

export default function Profile() {
    const { user, checkAppState } = useAuth();
    const queryClient = useQueryClient();
    
    // Edit state
    const [fullName, setFullName] = useState('');
    const [avatarStyle, setAvatarStyle] = useState('initials');
    const [avatarSeed, setAvatarSeed] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (user) {
            setFullName(user.full_name || '');
            setAvatarStyle(user.avatar_style || 'initials');
            setAvatarSeed(user.avatar_seed || user.email);
        }
    }, [user]);

    // Fetch user's teams to calculate total score and participation
    const { data: myTeams = [], isLoading: isLoadingTeams } = useQuery({
        queryKey: ['my-teams', user?.email],
        queryFn: async () => {
            if (!user?.email) return [];
            const allTeams = await db.entities.Team.list();
            return allTeams.filter(team =>
                team.members?.some(m => (typeof m === 'string' ? m : m.email) === user.email) ||
                team.created_by === user.email
            );
        },
        enabled: !!user?.email
    });

    const updateProfileMutation = useMutation({
        mutationFn: async (payload) => {
            return await db.auth.updateUser(payload);
        },
        onSuccess: async () => {
            toast.success("Profile updated successfully");
            setIsEditing(false);
            await checkAppState(); // refresh user context
        },
        onError: (e) => {
            toast.error(e.message || "Failed to update profile");
        }
    });

    const handleSave = (e) => {
        if (e) e.preventDefault();
        if (!fullName.trim()) {
            toast.error("Name cannot be empty");
            return;
        }
        updateProfileMutation.mutate({ 
            full_name: fullName,
            avatar_style: avatarStyle,
            avatar_seed: avatarSeed
        });
    };

    const handleAvatarClick = (styleId) => {
        setAvatarStyle(styleId);
        if (!isEditing) setIsEditing(true);
    };

    const randomizeSeed = () => {
        setAvatarSeed(Math.random().toString(36).substring(7));
        if (!isEditing) setIsEditing(true);
    };

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    // Calculate participation stats
    const totalScore = myTeams.reduce((sum, team) => sum + (team.total_score || 0), 0);
    const totalChallenges = myTeams.reduce((sum, team) => sum + (team.challenges_completed || 0), 0);
    const participations = myTeams.length;

    // Determine star tier
    const currentTier = getTier(totalScore);

    // Generate avatar URL from DiceBear
    const getAvatarUrl = (style, seed) => {
        if (style === 'initials') {
            return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || fullName || user.email)}`;
        }
        return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
    };

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-8">
                
                {/* Header Profile Summary */}
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="relative">
                        <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg overflow-hidden">
                            <img 
                                src={getAvatarUrl(avatarStyle, avatarSeed)} 
                                alt="Profile Avatar" 
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className={`absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-xs font-bold border-2 border-white shadow-sm flex items-center gap-1 ${currentTier.bg} ${currentTier.color}`}>
                            {currentTier.stars} <Star className="w-3 h-3 fill-current" />
                        </div>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-center md:justify-start">
                            <h1 className="text-3xl font-bold text-slate-900">{user.full_name || 'Anonymous User'}</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${currentTier.bg} ${currentTier.color} border border-current/20`}>
                                {currentTier.label}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1 font-medium"><Mail className="w-4 h-4" /> {user.email}</span>
                            <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> {user.role === 'admin' ? 'Administrator' : 'Participant'}</span>
                        </div>
                        
                        <div className="pt-4 flex flex-wrap items-center justify-center md:justify-start gap-2">
                            {/* Render Stars */}
                            <div className="flex gap-1" title={`${currentTier.label} Tier`}>
                                {[1, 2, 3, 4, 5].map((starIdx) => (
                                    <Star 
                                        key={starIdx} 
                                        className={`w-7 h-7 stroke-[1.5] ${starIdx <= currentTier.stars ? `${currentTier.color} fill-current` : 'text-slate-200 fill-slate-100'}`} 
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    
                    {/* Stats Card */}
                    <Card className="md:col-span-1 shadow-sm border-0">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Award className="w-5 h-5 text-emerald-500" />
                                Your Stats
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoadingTeams ? (
                                <div className="space-y-4 animate-pulse">
                                    <div className="h-10 bg-slate-100 rounded"></div>
                                    <div className="h-10 bg-slate-100 rounded"></div>
                                    <div className="h-10 bg-slate-100 rounded"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="text-slate-500 text-sm italic">Total Points</span>
                                            <span className="text-xl font-bold text-emerald-600">{totalScore}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-slate-500 text-sm italic">Rank</span>
                                            <span className="text-xl font-bold text-slate-700">#{totalScore > 1000 ? 'Top 10' : 'Legend'}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                        <span className="text-slate-500 text-sm italic">Challenges Solved</span>
                                        <span className="text-xl font-bold text-slate-700">{totalChallenges}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                                        <span className="text-slate-500 text-sm italic">Hackathons Joined</span>
                                        <span className="text-xl font-bold text-slate-700">{participations}</span>
                                    </div>
                                    
                                    {/* Next Tier Progress */}
                                    {currentTier.stars < 5 && (
                                        <div className="pt-2">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-slate-500">Progress to {STAR_TIERS.find(t => t.stars === currentTier.stars + 1)?.label}</span>
                                                <span className="font-medium text-slate-700">{totalScore} / {STAR_TIERS.find(t => t.stars === currentTier.stars + 1)?.threshold}</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all duration-500 ${currentTier.bg.replace('100', '500')}`} 
                                                    style={{ width: `${Math.min(100, (totalScore / (STAR_TIERS.find(t => t.stars === currentTier.stars + 1)?.threshold || 1)) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Edit Profile Card */}
                    <Card className="md:col-span-2 shadow-sm border-0">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-500" />
                                Account Settings
                            </CardTitle>
                            <CardDescription>Customize your profile and appearance</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSave} className="space-y-6">
                                
                                {/* Avatar Selection */}
                                <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2 text-slate-700">
                                            <Palette className="w-4 h-4" />
                                            Profile Picture Style
                                        </Label>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 group" 
                                            onClick={randomizeSeed}
                                        >
                                            <RefreshCw className="w-4 h-4 mr-1 group-hover:rotate-180 transition-transform" />
                                            Randomize
                                        </Button>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                        {AVATAR_STYLES.map((style) => (
                                            <button
                                                key={style.id}
                                                type="button"
                                                onClick={() => handleAvatarClick(style.id)}
                                                className={`relative aspect-square rounded-lg border-2 transition-all p-1 bg-white ${
                                                    avatarStyle === style.id 
                                                        ? 'border-blue-500 ring-2 ring-blue-100' 
                                                        : 'border-transparent hover:border-slate-200 opacity-60 hover:opacity-100'
                                                }`}
                                            >
                                                <img 
                                                    src={getAvatarUrl(style.id, avatarSeed)} 
                                                    alt={style.name} 
                                                    className="w-full h-full rounded"
                                                />
                                                {avatarStyle === style.id && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <Input 
                                        id="email" 
                                        type="email" 
                                        value={user.email} 
                                        disabled 
                                        className="bg-slate-50 text-slate-500 border-dashed"
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Display Name</Label>
                                    <Input 
                                        id="fullName" 
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Enter your full name"
                                        disabled={!isEditing}
                                        className={!isEditing ? "bg-slate-50 text-slate-700" : "border-blue-200 focus:ring-blue-100"}
                                    />
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Shield className={`w-4 h-4 ${user.role === 'admin' ? 'text-purple-500' : 'text-slate-400'}`} />
                                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                            {user.role === 'admin' ? 'System Administrator' : 'Standard Participant'}
                                        </span>
                                    </div>

                                    {!isEditing ? (
                                        <Button type="button" variant="outline" className="gap-2" onClick={() => setIsEditing(true)}>
                                            Modify Profile
                                        </Button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setFullName(user.full_name || '');
                                                    setAvatarStyle(user.avatar_style || 'initials');
                                                    setAvatarSeed(user.avatar_seed || user.email);
                                                }}
                                                disabled={updateProfileMutation.isPending}
                                            >
                                                Discard
                                            </Button>
                                            <Button 
                                                type="submit" 
                                                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100"
                                                disabled={updateProfileMutation.isPending}
                                            >
                                                {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                                                Save Changes
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}

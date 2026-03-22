import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Trophy, ArrowRight, Copy, Loader2, BarChart3, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl, getEffectiveHackathonStatus } from '@/utils';
import { format } from 'date-fns';

const statusConfig = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600' },
    registration_open: { label: 'Registration Open', color: 'bg-emerald-100 text-emerald-700' },
    in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'Completed', color: 'bg-purple-100 text-purple-700' }
};

export default function HackathonCard({ hackathon, teamCount = 0, isAdmin = false, onClone, isCloning, onDownload }) {
    const effectiveStatus = getEffectiveHackathonStatus(hackathon);
    const status = statusConfig[effectiveStatus] || statusConfig.draft;

    return (
        <Card className="group relative overflow-hidden border-0 bg-white shadow-sm hover:shadow-xl transition-all duration-500">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" />

            <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <Badge className={`${status.color} border-0 font-medium`}>
                            {status.label}
                        </Badge>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                            {hackathon.title}
                        </h3>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 group-hover:bg-emerald-50 transition-colors">
                        <Trophy className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                    </div>
                </div>

                {hackathon.description && (
                    <p className="text-slate-500 text-sm line-clamp-2">
                        {hackathon.description}
                    </p>
                )}

                <div className="flex items-center gap-4 text-sm text-slate-500">
                    {hackathon.start_time && (
                        <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(hackathon.start_time), 'MMM d, yyyy')}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {teamCount} / {hackathon.max_teams || 50} teams
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-2">
                    {isAdmin ? (
                        <>
                            <Link to={createPageUrl(`AdminHackathon?id=${hackathon.id}`)} className="flex-1">
                                <Button className="w-full bg-slate-900 hover:bg-slate-800">
                                    Manage
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                            {onClone && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={onClone}
                                    disabled={isCloning}
                                    title="Clone hackathon"
                                >
                                    {isCloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            )}
                            {onDownload && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={(e) => {
                                        // prevent Link navigation if it's somehow bubbled up
                                        e.preventDefault(); 
                                        e.stopPropagation();
                                        onDownload();
                                    }}
                                    title="Download CSV Results"
                                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                >
                                    <Download className="w-4 h-4" />
                                </Button>
                            )}
                        </>
                    ) : effectiveStatus === 'completed' && hackathon.results_published ? (
                        <Link to={createPageUrl(`HackathonResults?id=${hackathon.id}`)} className="flex-1">
                            <Button className="w-full bg-purple-600 hover:bg-purple-700">
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Results
                            </Button>
                        </Link>
                    ) : effectiveStatus === 'completed' ? (
                        <Button className="w-full flex-1" variant="outline" disabled>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Results Pending
                        </Button>
                    ) : (
                        <Link to={createPageUrl(`JoinHackathon?id=${hackathon.id}`)} className="flex-1">
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                                Join Hackathon
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </Link>
                    )}
                </div>
            </div>
        </Card>
    );
}

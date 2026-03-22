import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock, CheckCircle2, Circle, Lock } from 'lucide-react';
import { cn } from "@/lib/utils";

const difficultyConfig = {
    easy: { label: 'Easy', color: 'bg-green-100 text-green-700', icon: '🌱' },
    medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700', icon: '⚡' },
    hard: { label: 'Hard', color: 'bg-orange-100 text-orange-700', icon: '🔥' },
    expert: { label: 'Expert', color: 'bg-red-100 text-red-700', icon: '💀' }
};

export default function ChallengeCard({
    challenge,
    status = 'locked', // 'locked', 'available', 'completed', 'in_progress'
    score = 0,
    onClick,
    isSelected = false
}) {
    const difficulty = difficultyConfig[challenge.difficulty] || difficultyConfig.medium;

    const statusIcons = {
        locked: <Lock className="w-5 h-5 text-slate-300" />,
        available: <Circle className="w-5 h-5 text-slate-400" />,
        in_progress: <Clock className="w-5 h-5 text-blue-500" />,
        completed: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    };

    return (
        <Card
            onClick={status !== 'locked' ? onClick : undefined}
            className={cn(
                "relative overflow-hidden transition-all duration-300 border-2",
                status === 'locked'
                    ? "opacity-60 cursor-not-allowed border-slate-100 bg-slate-50"
                    : "cursor-pointer hover:shadow-lg hover:-translate-y-1",
                isSelected ? "border-emerald-500 shadow-lg shadow-emerald-100" : "border-transparent",
                status === 'completed' && "bg-emerald-50/50"
            )}
        >
            <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        {statusIcons[status]}
                        <span className="text-lg">{difficulty.icon}</span>
                    </div>
                    <Badge className={`${difficulty.color} border-0`}>
                        {difficulty.label}
                    </Badge>
                </div>

                <h4 className="font-semibold text-slate-900 mb-2 line-clamp-1">
                    {challenge.title}
                </h4>

                <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                    {challenge.description}
                </p>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-slate-700">
                            {status === 'completed' ? score : challenge.points} pts
                        </span>
                    </div>
                    {challenge.hints?.length > 0 && (
                        <span className="text-xs text-slate-400">
                            {challenge.hints.length} hints available
                        </span>
                    )}
                </div>
            </div>

            {status === 'completed' && (
                <div className="absolute top-0 right-0 w-16 h-16">
                    <div className="absolute transform rotate-45 bg-emerald-500 text-white text-xs font-bold py-1 right-[-35px] top-[12px] w-[120px] text-center">
                        SOLVED
                    </div>
                </div>
            )}
        </Card>
    );
}
import React from 'react';
import { cn } from "@/lib/utils";

export default function CodeEditor({
    value,
    onChange,
    placeholder = "-- Write your SQL query here...",
    readOnly = false,
    className
}) {
    return (
        <div className={cn("relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950", className)}>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-slate-400 font-mono ml-2">query.sql</span>
            </div>
            <textarea
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder={placeholder}
                readOnly={readOnly}
                spellCheck={false}
                className={cn(
                    "w-full min-h-[200px] p-4 bg-slate-950 text-emerald-400 font-mono text-sm",
                    "placeholder:text-slate-600 focus:outline-none resize-none",
                    "leading-relaxed tracking-wide",
                    readOnly && "opacity-70 cursor-not-allowed"
                )}
            />
        </div>
    );
}
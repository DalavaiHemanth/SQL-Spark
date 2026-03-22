export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

export function formatDatetimeLocal(isoString: string | null | undefined) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function getEffectiveHackathonStatus(hackathon: any) {
    if (!hackathon) return 'draft';
    
    // Explicit manual overrides that we never override automatically
    if (hackathon.status === 'draft') return 'draft';
    if (hackathon.status === 'completed') return 'completed';

    const now = Date.now();
    const startTime = hackathon.start_time ? new Date(hackathon.start_time).getTime() : 0;
    const endTime = hackathon.end_time ? new Date(hackathon.end_time).getTime() : Infinity;

    if (hackathon.status === 'in_progress') {
        if (now >= endTime) return 'completed';
        return 'in_progress';
    }
    
    if (hackathon.status === 'registration_open') {
        if (now >= endTime) return 'completed';
        if (now >= startTime) return 'in_progress';
        return 'registration_open';
    }
    
    return hackathon.status;
}
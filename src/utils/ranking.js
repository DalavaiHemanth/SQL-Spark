// Shared ranking and star tier configuration

export const STAR_TIERS = [
    { threshold: 5000, stars: 5, label: 'Master', color: 'text-amber-500', bg: 'bg-amber-100' },
    { threshold: 2500, stars: 4, label: 'Expert', color: 'text-purple-500', bg: 'bg-purple-100' },
    { threshold: 1000, stars: 3, label: 'Advanced', color: 'text-blue-500', bg: 'bg-blue-100' },
    { threshold: 500, stars: 2, label: 'Intermediate', color: 'text-emerald-500', bg: 'bg-emerald-100' },
    { threshold: 100, stars: 1, label: 'Novice', color: 'text-orange-500', bg: 'bg-orange-100' },
    { threshold: 0, stars: 0, label: 'Beginner', color: 'text-slate-400', bg: 'bg-slate-100' },
];

export const getTier = (score) => {
    return STAR_TIERS.find(tier => score >= tier.threshold) || STAR_TIERS[STAR_TIERS.length - 1];
};

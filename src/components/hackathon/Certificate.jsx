import React from 'react';

/**
 * Certificate component — rendered off-screen and captured by html2canvas.
 * Props:
 *   type: 'participation' | 'winner'
 *   recipientName: string
 *   teamName: string
 *   hackathonTitle: string
 *   date: string  (formatted)
 *   rank: number | null  (1, 2, 3 for winners)
 *   certSettings: object  (optional admin overrides)
 *     - organizerName: string
 *     - winnerBg: string   (CSS gradient)
 *     - participationBg: string   (CSS gradient)
 *     - winnerAccent: string  (hex color)
 *     - participationAccent: string  (hex color)
 */
const rankLabel = { 1: '1st Place', 2: '2nd Place', 3: '3rd Place' };
const rankEmoji = { 1: '🥇', 2: '🥈', 3: '🥉' };

const DEFAULTS = {
    organizerName: 'SQL Spark Team',
    winnerBg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)',
    participationBg: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #064e3b 100%)',
    winnerAccent: '#fbbf24',
    participationAccent: '#34d399',
};

export default function Certificate({ type, recipientName, teamName, hackathonTitle, date, rank, certSettings = {} }) {
    const isWinner = type === 'winner';
    const s = { ...DEFAULTS, ...certSettings };
    const accent = isWinner ? s.winnerAccent : s.participationAccent;
    const bg = isWinner ? s.winnerBg : s.participationBg;

    // A subtle watermark/texture overlay
    const textureBg = `
        repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 12px),
        repeating-linear-gradient(-45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 2px, transparent 2px, transparent 12px)
    `;

    return (
        <div
            style={{
                width: '900px',
                height: '636px',
                background: bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                position: 'relative',
                fontFamily: "'Playfair Display', 'Times New Roman', serif",
                boxSizing: 'border-box',
                overflow: 'hidden',
                color: '#fff'
            }}
        >
            {/* Texture Background Layer */}
            <div style={{
                position: 'absolute', inset: 0,
                background: textureBg, pointerEvents: 'none', zIndex: 0
            }} />

            {/* Inner Content Area */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                background: 'var(--card, rgba(15, 23, 42, 0.4))',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${accent}40`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '30px 40px 50px 40px', // More bottom padding to lift footer
                boxShadow: 'inset 0 0 100px rgba(0,0,0,0.5)',
            }}>

                {/* Double Border Framing */}
                <div style={{
                    position: 'absolute', inset: '16px',
                    border: `2px solid ${accent}`,
                    opacity: 0.8,
                    pointerEvents: 'none'
                }} />
                {/* ... (rest of borders same) */}
                <div style={{
                    position: 'absolute', inset: '22px',
                    border: `1px solid ${accent}`,
                    opacity: 0.4,
                    pointerEvents: 'none'
                }} />

                {/* Corner Ornaments */}
                {[
                    { top: 12, left: 12, borderTop: `4px solid ${accent}`, borderLeft: `4px solid ${accent}` },
                    { top: 12, right: 12, borderTop: `4px solid ${accent}`, borderRight: `4px solid ${accent}` },
                    { bottom: 12, left: 12, borderBottom: `4px solid ${accent}`, borderLeft: `4px solid ${accent}` },
                    { bottom: 12, right: 12, borderBottom: `4px solid ${accent}`, borderRight: `4px solid ${accent}` },
                ].map((style, i) => (
                    <div key={i} style={{
                        position: 'absolute', width: '32px', height: '32px',
                        opacity: 0.9, ...style
                    }} />
                ))}

                {/* Content Sections */}
                <div style={{
                    background: `linear-gradient(135deg, ${accent}33, transparent)`,
                    border: `1px solid ${accent}80`,
                    borderRadius: '50px',
                    padding: '4px 16px',
                    marginBottom: '10px',
                    boxShadow: `0 4px 15px ${accent}26`,
                }}>
                    <span style={{
                        color: accent,
                        fontSize: '12px',
                        letterSpacing: '2px',
                        textTransform: 'uppercase',
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 700,
                    }}>
                        {isWinner ? `${rankEmoji[rank]} Winner Certificate` : '✦ Participation ✦'}
                    </span>
                </div>

                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '8px' }}>
                    This certifies that
                </div>

                <div style={{
                    color: '#ffffff',
                    fontSize: '44px',
                    fontWeight: 800,
                    marginBottom: '4px',
                    textAlign: 'center',
                    fontFamily: "'Cinzel', serif",
                    textShadow: `2px 2px 4px rgba(0,0,0,0.6), 0 0 30px ${accent}60`,
                }}>
                    {recipientName}
                </div>

                <div style={{ color: accent, fontSize: '16px', marginBottom: '15px', fontStyle: 'italic' }}>
                    Team: {teamName}
                </div>

                <div style={{ width: '200px', height: '1px', background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, marginBottom: '15px' }} />

                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '16px', textAlign: 'center', maxWidth: '600px', lineHeight: '1.4', marginBottom: '8px' }}>
                    {isWinner
                        ? <><span>has remarkably achieved </span><b style={{ color: accent }}>{rankLabel[rank]}</b><span> in the</span></>
                        : 'has successfully demonstrated their skills in the'}
                </div>

                <div style={{ color: '#ffffff', fontSize: '24px', fontWeight: 700, textAlign: 'center', marginBottom: '8px', fontFamily: "'Cinzel', serif" }}>
                    {hackathonTitle}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', marginBottom: 'auto' }}>
                    {s.collegeName && <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{s.collegeName}</div>}
                    {s.customText && <div style={{ color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: '12px' }}>{s.customText}</div>}
                </div>

                {/* Footer */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'end', width: '100%', padding: '0 40px', marginBottom: '10px' }}>
                    <div style={{ textAlign: 'center', width: '160px' }}>
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '2px', marginBottom: '4px' }}>
                            <div style={{ color: 'rgba(255,255,255,0.95)', fontSize: '12px' }}>{date}</div>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', letterSpacing: '1px' }}>ISSUED DATE</div>
                    </div>

                    <div style={{ position: 'relative', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', background: accent, filter: 'blur(8px)', opacity: 0.2 }} />
                        <div style={{ width: '56px', height: '56px', background: `radial-gradient(circle, ${accent} 0%, transparent 80%), rgba(255,255,255,0.05)`, border: `1px dashed ${accent}`, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                            <div style={{ color: '#fff', fontSize: '16px' }}>⚡</div>
                            <div style={{ color: '#fff', fontSize: '6px', fontWeight: 700 }}>SQL SPARK</div>
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', width: '160px', justifySelf: 'end' }}>
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '2px', marginBottom: '4px', height: '25px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                            {s.signatureName && (
                                <div style={{ color: accent, fontSize: '20px', fontFamily: "'Great Vibes', cursive", transform: 'rotate(-3deg)' }}>{s.signatureName}</div>
                            )}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', letterSpacing: '1px' }}>{s.signatureRole || 'ORGANIZER'}</div>
                </div>
            </div>
        </div>
    </div>
    );
}

import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import React from 'react';
import Certificate from '@/components/hackathon/Certificate';

/**
 * Renders a Certificate component off-screen, captures it with html2canvas,
 * and saves it as a PDF file.
 *
 * @param {object} opts
 * @param {string} opts.type               'participation' | 'winner'
 * @param {string} opts.recipientName      Full name of the participant
 * @param {string} opts.teamName           Team name
 * @param {string} opts.hackathonTitle     Hackathon name
 * @param {string} opts.date               Formatted date string
 * @param {number|null} opts.rank          1 | 2 | 3 for winners, null otherwise
 * @param {boolean} [opts.download=true]   Whether to trigger browser download
 * @returns {Promise<Blob>}                The PDF as a Blob
 */
export async function generateCertificatePDF({
    type,
    recipientName,
    teamName,
    hackathonTitle,
    date,
    rank = null,
    download = true,
    certSettings = {},
}) {
    // 1. Create a hidden container
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;z-index:-1;';
    document.body.appendChild(container);

    // 2. Render the Certificate component into it
    const root = createRoot(container);
    await new Promise(resolve => {
        root.render(
            React.createElement(Certificate, {
                type, recipientName, teamName, hackathonTitle, date, rank, certSettings,
            })
        );
        // Give React time to paint
        setTimeout(resolve, 200);
    });

    // 3. Capture with html2canvas
    const canvas = await html2canvas(container.firstChild, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
    });

    // 4. Convert to PDF (landscape A4 proportional)
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [900, 636] });
    pdf.addImage(imgData, 'PNG', 0, 0, 900, 636);

    // 5. Cleanup
    root.unmount();
    document.body.removeChild(container);

    // 6. Download or return blob
    const safeRecipient = recipientName.replace(/[^a-z0-9]/gi, '_');
    const fileName = `${type === 'winner' ? 'Winner' : 'Participation'}_Certificate_${safeRecipient}.pdf`;

    if (download) {
        pdf.save(fileName);
    }

    return pdf.output('blob');
}

/**
 * Given all teams and submissions for a hackathon, returns a flat list of
 * { email, name, teamName, type, rank } objects — one per participant.
 */
export function buildParticipantList(teams) {
    const ranked = [...teams].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

    const participants = [];
    ranked.forEach((team, idx) => {
        const rank = idx < 3 ? idx + 1 : null;
        const members = team.members || [];
        members.forEach(member => {
            const email = typeof member === 'object' ? member.email : member;
            const name = typeof member === 'object' ? (member.name || member.email) : member;
            if (!email) return;
            participants.push({
                email,
                name,
                teamName: team.name,
                type: rank ? 'winner' : 'participation',
                rank,
            });
        });
    });

    return participants;
}

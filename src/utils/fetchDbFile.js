import { supabase } from '@/api/supabaseClient';

const BUCKET = 'hackathon-assets';

/**
 * Extract the storage file path from a Supabase public URL.
 * Public URLs look like: https://<ref>.supabase.co/storage/v1/object/public/hackathon-assets/<path>
 */
function extractStoragePath(url) {
    if (!url) return null;
    try {
        const marker = `/storage/v1/object/public/${BUCKET}/`;
        const idx = url.indexOf(marker);
        if (idx !== -1) {
            return decodeURIComponent(url.substring(idx + marker.length));
        }
    } catch {
        // fall through
    }
    return null;
}

/**
 * Fetch a database file as an ArrayBuffer.
 * 
 * Strategy:
 *  1. If the URL is a Supabase public URL, extract the path and use
 *     supabase.storage.download() (works for both public AND private buckets).
 *  2. Otherwise fall back to a plain fetch().
 * 
 * Returns an ArrayBuffer of the file contents.
 * Throws on any failure.
 */
export async function fetchDbFile(url) {
    if (!url) throw new Error('No database file URL provided');

    const storagePath = extractStoragePath(url);

    if (storagePath) {
        // Use Supabase SDK (authenticated — works with private buckets)
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .download(storagePath);

        if (error) {
            throw new Error(`Storage download failed: ${error.message}`);
        }
        return await data.arrayBuffer();
    }

    // Fallback: plain fetch for non-Supabase URLs
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.arrayBuffer();
}

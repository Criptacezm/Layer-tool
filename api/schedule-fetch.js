// Fetches an external schedule (iCal feed or HTML timetable page) server-side so the
// browser can import it without hitting CORS restrictions.

const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20000;
const MAX_ICS_DISCOVERY = 3;

const BLOCKED_HOST_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^0\./,
    /^10\./,
    /^169\.254\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^\[?::1\]?$/,
    /\.local$/i,
    /^\[?f[cd][0-9a-f]{2}:/i
];

function normalizeUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        throw new Error('A schedule URL is required');
    }
    const trimmed = rawUrl.trim().replace(/^webcal:\/\//i, 'https://');
    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error('That does not look like a valid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Only http(s) and webcal links are supported');
    }
    if (BLOCKED_HOST_PATTERNS.some(pattern => pattern.test(parsed.hostname))) {
        throw new Error('That host is not allowed');
    }
    return parsed;
}

async function readCapped(response) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
        throw new Error('The schedule is too large to import (limit 5 MB)');
    }
    return buffer.toString('utf8');
}

async function fetchOnce(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(url.toString(), {
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LayerScheduleImport/1.0)',
                'Accept': 'text/calendar, text/html, application/xhtml+xml, text/plain;q=0.9, */*;q=0.8'
            }
        });
        if (!response.ok) {
            throw new Error(`The schedule source responded with ${response.status}`);
        }
        return {
            contentType: (response.headers.get('content-type') || '').toLowerCase(),
            finalUrl: response.url || url.toString(),
            body: await readCapped(response)
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('The schedule source timed out');
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

function detectFormat(contentType, body) {
    if (/BEGIN:VCALENDAR/i.test(body.slice(0, 2000))) return 'ics';
    if (contentType.includes('text/calendar')) return 'ics';
    return 'html';
}

// Timetable pages often expose the real data as a linked .ics/iCal export.
function findIcsLinks(html, baseUrl) {
    const links = new Set();
    const attributeRegex = /(?:href|src|data-url|content)\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = attributeRegex.exec(html)) !== null) {
        const candidate = match[1];
        if (!/\.ics(\?|#|$)|ical|icalendar|webcal:/i.test(candidate)) continue;
        try {
            links.add(new URL(candidate.replace(/^webcal:\/\//i, 'https://'), baseUrl).toString());
        } catch {
            // Ignore unparseable links.
        }
    }
    return [...links].slice(0, MAX_ICS_DISCOVERY);
}

async function fetchSchedule(rawUrl) {
    const url = normalizeUrl(rawUrl);
    const first = await fetchOnce(url);
    const format = detectFormat(first.contentType, first.body);
    if (format === 'ics') {
        return { format, sourceUrl: first.finalUrl, requestedUrl: url.toString(), content: first.body };
    }

    for (const link of findIcsLinks(first.body, first.finalUrl)) {
        try {
            const candidate = await fetchOnce(normalizeUrl(link));
            if (detectFormat(candidate.contentType, candidate.body) === 'ics') {
                return {
                    format: 'ics',
                    sourceUrl: candidate.finalUrl,
                    requestedUrl: url.toString(),
                    content: candidate.body,
                    discoveredFrom: first.finalUrl
                };
            }
        } catch {
            // Try the next candidate link.
        }
    }

    return { format: 'html', sourceUrl: first.finalUrl, requestedUrl: url.toString(), content: first.body };
}

async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method Not Allowed' } });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const result = await fetchSchedule(body.url);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json({ error: { message: error.message } });
    }
}

module.exports = handler;
module.exports.fetchSchedule = fetchSchedule;

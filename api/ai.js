// Vercel Serverless Function handler
module.exports = async (req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method Not Allowed' } });
    }

    try {
        const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
        const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
        const wantsStream = !!req.body?.stream;

        if (!NVIDIA_API_KEY) {
            return res.status(500).json({
                error: {
                    message: 'Missing NVIDIA_API_KEY environment variable. Configure it in your deployment environment.'
                }
            });
        }

        const upstreamResponse = await fetch(INVOKE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': wantsStream ? 'text/event-stream' : 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        if (!upstreamResponse.ok) {
            const contentType = upstreamResponse.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await upstreamResponse.json();
                return res.status(upstreamResponse.status).json(data);
            }
            const text = await upstreamResponse.text();
            return res.status(upstreamResponse.status).json({
                error: {
                    message: 'NVIDIA API request failed',
                    details: text
                }
            });
        }

        if (wantsStream) {
            res.status(200);
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');

            const abortController = new AbortController();
            req.on('close', () => {
                try {
                    abortController.abort();
                } catch (e) {}
            });

            if (!upstreamResponse.body) {
                res.write('event: error\n');
                res.write('data: {"error":{"message":"Upstream response had no body"}}\n\n');
                return res.end();
            }

            try {
                for await (const chunk of upstreamResponse.body) {
                    res.write(chunk);
                }
            } catch (error) {
                if (!res.headersSent) {
                    res.status(500);
                }
                try {
                    res.write('event: error\n');
                    res.write(`data: ${JSON.stringify({ error: { message: error.message || String(error) } })}\n\n`);
                } catch (e) {}
            }

            return res.end();
        }

        const contentType = upstreamResponse.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await upstreamResponse.json();
            return res.status(200).json(data);
        }

        const text = await upstreamResponse.text();
        return res.status(200).json({ error: { message: 'NVIDIA API returned non-JSON response', details: text } });
    } catch (error) {
        return res.status(500).json({ error: { message: error.message } });
    }
};

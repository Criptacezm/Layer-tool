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
        const NVIDIA_API_KEY = "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";
        const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

        const response = await fetch(INVOKE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NVIDIA_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            res.status(response.status).json(data);
        } else {
            const text = await response.text();
            res.status(response.status).json({ error: { message: 'NVIDIA API returned non-JSON response', details: text } });
        }
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
};

// Vercel Serverless Function handler
const { providerInfo, proxyAIRequest } = require('./ai-provider');

module.exports = async (req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json(providerInfo());
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: { message: 'Method Not Allowed' } });
    }

    try {
        const { status, body } = await proxyAIRequest(req.body);
        res.status(status).json(body);
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
};

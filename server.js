const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static(__dirname));

const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

app.post('/api/ai', async (req, res) => {
    try {
        const HARDCODED_NVIDIA_API_KEY = '';
        const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || HARDCODED_NVIDIA_API_KEY;
        if (!NVIDIA_API_KEY) {
            return res.status(500).json({
                error: {
                    message: 'Missing NVIDIA_API_KEY. Set NVIDIA_API_KEY env var, or fill HARDCODED_NVIDIA_API_KEY in server.js.'
                }
            });
        }

        console.log('Received AI request:', req.body.messages?.[req.body.messages.length - 1]?.content?.substring(0, 50) + '...');

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
            console.error('NVIDIA API non-JSON response:', text);
            res.status(response.status).json({ error: { message: 'NVIDIA API returned non-JSON response', details: text } });
        }
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: { message: error.message } });
    }
});

app.get('/layer.html', (req, res) => {
    res.sendFile(__dirname + '/layer.html');
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/layer.html');
});

module.exports = app;
// app.listen(port, () => {
//     console.log(`Server running at http://localhost:${port}`);
// });

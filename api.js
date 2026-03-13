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

const NVIDIA_API_KEY = "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";
const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

app.post('/api/ai', async (req, res) => {
    try {
        const messages = req.body.messages || [];
        const lastMessage = messages[messages.length - 1];
        const content = lastMessage ? lastMessage.content : '';
        const logContent = typeof content === 'string' ? content.substring(0, 50) : '[Non-string content]';
        console.log('Received AI request:', logContent + '...');

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

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

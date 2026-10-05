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

const { resolveProvider, providerInfo, proxyAIRequest } = require('./api/ai-provider');

app.get('/api/ai', (req, res) => res.json(providerInfo()));

app.post('/api/ai', async (req, res) => {
    try {
        const messages = req.body.messages || [];
        const lastMessage = messages[messages.length - 1];
        const content = lastMessage ? lastMessage.content : '';
        const logContent = typeof content === 'string' ? content.substring(0, 50) : '[Non-string content]';
        console.log(`Received AI request (${resolveProvider().label}):`, logContent + '...');

        const { status, body } = await proxyAIRequest(req.body);
        if (body.error) console.error('AI provider error:', body.error);
        res.status(status).json(body);
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

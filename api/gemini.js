import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // Vercel sometimes sends a string, sometimes an object
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { prompt, context } = body;

    try {
        const { prompt, context } = req.body;
        const fullPrompt = context ? `Context: ${context}\n\nUser: ${prompt}` : prompt;
        
        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        res.status(200).json({ text: response.text() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // ONLY the backend can see process.env
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

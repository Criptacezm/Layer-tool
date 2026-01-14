import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // Vercel only makes process.env available on the server
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

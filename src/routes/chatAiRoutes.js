const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
    const { messages } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("GEMINI_API_KEY is not defined in backend .env");
        return res.status(500).json({ error: "Gemini API Key not configured" });
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    contents: messages,
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Gemini API Error:", errorData);
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error("Gemini API Fetch Error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;

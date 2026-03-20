import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const API_KEY = "AIzaSyBktN4l7JXuyXhxm8VMuYVG8uadTOSY7MY";

app.post("/ia", async (req, res) => {
    try {
        const { texto } = req.body;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: texto }] }]
                })
            }
        );

        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: true });
    }
});

app.listen(3000, () => console.log("Servidor corriendo en http://localhost:3000"));

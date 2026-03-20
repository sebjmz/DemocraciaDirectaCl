import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// Usamos el middleware CORS para permitir peticiones desde tu frontend
app.use(cors());
app.use(express.json());

// Es mejor práctica usar variables de entorno, pero aquí está tu clave
const API_KEY = "AIzaSyB8uKzOtzkiVoCD_mX0pLqhsvwFhYw59oQ";

app.post("/ia", async (req, res) => {
    try {
        const { texto } = req.body;

        if (!texto) {
            return res.status(400).json({ error: "No se proporcionó texto" });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: texto }]
                        }
                    ],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            }
        );

        const data = await response.json();
        
        // Enviamos la respuesta de vuelta al frontend
        res.json(data);

    } catch (e) {
        console.error("Error en servidor:", e);
        res.status(500).json({ error: true, message: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

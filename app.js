import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import fs from 'fs';
import cors from 'cors';
import FormData from 'form-data';

let currentPlant = null;

const app = express();
const PORT = 3000;
const GEMINI_API_KEY = "AIzaSyA_qmZTZ5wuNY1uOtcGCzpqLb7_XJyxe8g"

// Enable CORS to allow frontend communication
app.use(cors());

// Middleware to serve static files from "public" directory (frontend files)
app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for file uploads (storing in 'uploads' directory)
const upload = multer({ dest: 'uploads/' });

// PlantNet API Key and Endpoint (replace with your actual API key)
const plantNetApiUrl = `https://my-api.plantnet.org/v2/identify/all?api-key=2b10RQBsNWzbtfrwfKSDTRAnO`;

// Endpoint to handle plant image upload and API request
app.post('/upload', upload.single('plantImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const filePath = req.file.path;

        // Create a form to send to PlantNet API
        const form = new FormData();
        form.append('images', fs.createReadStream(filePath));

        // Send the request to PlantNet API
        const response = await fetch(plantNetApiUrl, {
            method: 'POST',
            body: form,
            headers: {
                ...form.getHeaders(),
            },
        });

        const result = await response.json();

        // Log the entire API response for debugging
        console.log('API Response:', JSON.stringify(result, null, 2));

        // Check if the API returned a valid plant identification result
        if (result?.results?.length > 0) {
            const plantDetails = result.results[0].species;

            // Extract the information
            const plantName = plantDetails.scientificNameWithoutAuthor || "Unknown";
            const plantFamily = plantDetails.family?.scientificName || "Unknown";
            const plantGenus = plantDetails.genus?.scientificName || "Unknown";
            const commonNames = plantDetails.commonNames?.length > 0 
                ? plantDetails.commonNames.join(", ") 
                : "No common names found";

            // Update current plant for the chatbot context
            currentPlant = {
                name: plantName,
                family: plantFamily,
                genus: plantGenus,
                commonNames: commonNames
            };

            // Send the plant details in response
            res.json(currentPlant);
        } else {
            currentPlant = null;
            res.json({ error: 'Plant not identified.' });
        }
    } catch (err) {
        console.error(err);
        currentPlant = null;
        res.status(500).json({ error: 'Failed to identify the plant.' });
    }
});

// Endpoint to handle chatbot messages
app.post('/api/chat', express.json(), async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'No message provided' });
        }

        // Prepare the system prompt based on whether we have a current plant
        let systemPrompt = "You are a helpful plant assistant that ONLY discusses plants, trees, " +
            "flowers, gardening, plant biology, plant geography, and closely related topics. " +
            "If asked about anything else, politely explain that you can only discuss plant-related topics. " +
            "Keep responses concise and educational. NEVER respond to questions about politics, technology, " + 
            "current events, or anything that isn't related to plant life.";

        // Add context about the current plant if available
        if (currentPlant) {
            systemPrompt += `\n\nThe user has recently identified a plant: ${currentPlant.name} ` +
                `(Family: ${currentPlant.family}, Genus: ${currentPlant.genus}). ` +
                `Common names include: ${currentPlant.commonNames}. Please incorporate this plant in your responses ` +
                `when relevant, but still answer general plant-related questions when they ask about other plants.`;
        }

        // Make request to Gemini API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: systemPrompt }
                        ]
                    },
                    {
                        role: "model",
                        parts: [
                            { text: "I understand. I'll only discuss plants and related topics." }
                        ]
                    },
                    {
                        role: "user",
                        parts: [
                            { text: message }
                        ]
                    }
                ]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || 'Error from Gemini API');
        }

        // Extract the response content
        const botResponse = data.candidates[0].content.parts[0].text;
        
        res.json({ response: botResponse });
    } catch (err) {
        console.error('Chat API error:', err);
        res.status(500).json({ 
            error: 'Failed to process your message',
            details: err.message
        });
    }
});

// New endpoint for fetching plant distribution data
app.get('/api/plant-distribution/:plantName', async (req, res) => {
    const plantName = req.params.plantName;
    
    try {
        const response = await fetch(`https://api.gbif.org/v1/occurrence/search?scientificName=${encodeURIComponent(plantName)}&limit=300`);
        const data = await response.json();

        const distributionData = data.results
            .filter(result => result.decimalLatitude && result.decimalLongitude)
            .map(result => ({
                lat: result.decimalLatitude,
                lng: result.decimalLongitude,
                intensity: 1
            }));

        res.json(distributionData);
    } catch (error) {
        console.error('Error fetching distribution data:', error);
        res.status(500).json({ error: 'Failed to fetch distribution data' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

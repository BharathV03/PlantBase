import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import express from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import FormData from 'form-data';

const app = express();
const PORT = 3000;

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

            // Send the plant details in response
            res.json({
                name: plantName,
                family: plantFamily,
                genus: plantGenus,
                commonNames: commonNames
            });
        } else {
            res.json({ error: 'Plant not identified.' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to identify the plant.' });
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

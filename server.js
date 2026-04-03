const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
    origin: true,
    credentials: true
}));

// Add headers to allow Google Sign-In
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    next();
});

// This tells Express to look in the /public folder for any file requested
app.use(express.static('public'));

// Connect to MongoDB
if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("Connected to MongoDB"))
        .catch(err => console.error("MongoDB connection error:", err.message));
} else {
    console.log("MongoDB URI not configured - running without database");
}

// Ensure MongoDB connection is established
if (!mongoose.connection.readyState) {
    console.error("MongoDB connection is not established.");
}

const SearchHistory = require('./models/Search');

// Route to save history
app.post('/api/history', async (req, res) => {
    if (!mongoose.connection.readyState) {
        return res.status(503).send("Database not connected");
    }
    try {
        const newSearch = new SearchHistory(req.body);
        await newSearch.save();
        res.status(201).send("Saved");
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Route to fetch history for a specific user
app.get('/api/history/:userId', async (req, res) => {
    if (!mongoose.connection.readyState) {
        return res.status(503).send("Database not connected");
    }
    try {
        const history = await SearchHistory.find({ userId: req.params.userId })
            .sort({ timestamp: -1 })
            .limit(10); // Grab the last 10 searches
        res.json(history);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Now you can simplify your root route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Updated to use Google Custom Search API via Environment Variables
app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        // Grab credentials safely from Vercel / .env
        const apiKey = process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CX;

        if (!apiKey || !cx) {
            return res.status(500).json({ error: "Google API Key or CX is missing." });
        }

        const googleUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}`;

        const response = await fetch(googleUrl);
        if (!response.ok) {
            throw new Error(`Google Search API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Format Google's output so it perfectly matches what script.js expects
        res.json({
            organic_results: data.items || []
        });

    } catch (error) {
        console.error('Google API proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Vercel Serverless requirements (Localhost fallback)
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5500;
    app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
}

module.exports = app;
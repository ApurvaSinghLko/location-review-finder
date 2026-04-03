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

app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    next();
});

app.use(express.static('public'));

if (process.env.MONGO_URI) {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("Connected to MongoDB"))
        .catch(err => console.error("MongoDB connection error:", err.message));
} else {
    console.log("MongoDB URI not configured - running without database");
}

if (!mongoose.connection.readyState) {
    console.error("MongoDB connection is not established.");
}

const SearchHistory = require('./models/Search');

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

app.get('/api/history/:userId', async (req, res) => {
    if (!mongoose.connection.readyState) {
        return res.status(503).send("Database not connected");
    }
    try {
        const history = await SearchHistory.find({ userId: req.params.userId })
            .sort({ timestamp: -1 })
            .limit(10);
        res.json(history);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

async function fetchSerpApi(q, apiKey) {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', q);
    url.searchParams.set('api_key', apiKey);
    return fetch(url);
}

app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid query parameter q.' });
        }

        const keys = [process.env.SEARCH_API_A, process.env.SEARCH_API_B, process.env.SEARCH_API_C]
            .filter((k) => k && String(k).trim());

        if (keys.length === 0) {
            return res.status(500).json({ error: 'No search API keys configured.' });
        }

        let lastStatus = 500;
        let lastBody = '';

        for (let i = 0; i < keys.length; i++) {
            const response = await fetchSerpApi(q, keys[i]);
            lastStatus = response.status;

            if (response.ok) {
                const data = await response.json();
                if (data.error) {
                    return res.status(502).json({ error: String(data.error) });
                }
                return res.json({ organic_results: data.organic_results || [] });
            }

            const shouldRetry = (response.status === 429 || response.status === 403) && i < keys.length - 1;
            if (shouldRetry) {
                continue;
            }

            lastBody = await response.text();
            break;
        }

        return res.status(lastStatus >= 400 ? lastStatus : 500).json({
            error: lastBody || `Search request failed with status ${lastStatus}`
        });
    } catch (error) {
        console.error('SerpAPI proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5500;
    app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
}

module.exports = app;

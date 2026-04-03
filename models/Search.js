const mongoose = require('mongoose');

const searchSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    subject: { type: String, required: true },
    location: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
}, { collection: 'SearchHistory' });

module.exports = mongoose.model('SearchHistory', searchSchema);
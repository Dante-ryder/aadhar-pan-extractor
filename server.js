const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
require('dotenv').config();

const Extraction = require('./models/extraction');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ocr-tool';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Parse JSON bodies
app.use(express.json());

// Serve static files from the Angular app
let staticPath;
const possiblePaths = [
  path.join(__dirname, 'dist/ocr-tool/browser'),
  path.join(__dirname, 'dist/ocr-tool'),
  path.join(__dirname, 'dist')
];

for (const pathToCheck of possiblePaths) {
  if (fs.existsSync(pathToCheck)) {
    console.log(`Found build files at: ${pathToCheck}`);
    staticPath = pathToCheck;
    break;
  }
}

if (!staticPath) {
  console.log('WARNING: Could not find build files in any expected location!');
  console.log('Directory contents:', fs.readdirSync(__dirname));
  console.log('Dist contents (if exists):', fs.existsSync(path.join(__dirname, 'dist')) ? fs.readdirSync(path.join(__dirname, 'dist')) : 'dist directory not found');
  staticPath = path.join(__dirname, 'dist/ocr-tool');
}

console.log('Serving static files from:', staticPath);
app.use(express.static(staticPath));

// API Routes
app.post('/api/extractions', async (req, res) => {
  try {
    const extraction = new Extraction(req.body);
    await extraction.save();
    res.status(201).json(extraction);
  } catch (error) {
    console.error('Error saving extraction:', error);
    res.status(500).json({ error: 'Failed to save extraction' });
  }
});

app.get('/api/extractions', async (req, res) => {
  try {
    const extractions = await Extraction.find().sort('-timestamp');
    res.json(extractions);
  } catch (error) {
    console.error('Error fetching extractions:', error);
    res.status(500).json({ error: 'Failed to fetch extractions' });
  }
});

app.get('/api/extractions/download', async (req, res) => {
  try {
    const extractions = await Extraction.find().sort('-timestamp');
    const parser = new Parser();
    const csv = parser.parse(extractions);
    
    res.header('Content-Type', 'text/csv');
    res.attachment('extractions.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error downloading extractions:', error);
    res.status(500).json({ error: 'Failed to download extractions' });
  }
});

// Special escape for problematic URLs
app.get('/git.new/*', (req, res) => {
  res.status(404).send('Not found');
});

// Catch all other routes and return the Angular app
app.get('*', (req, res) => {
  try {
    const indexPath = path.join(staticPath, 'index.html');
    console.log('Serving index from:', indexPath);

    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error('Error: index.html not found at', indexPath);
      res.status(500).send('Server Error: index.html not found. Please check build configuration.');
    }
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Server Error: ' + error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});

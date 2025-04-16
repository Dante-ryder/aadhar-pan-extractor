const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

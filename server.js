const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the Angular app
// Check multiple potential build locations - newer Angular outputs to dist/ocr-tool/browser
let staticPath;
const possiblePaths = [
  path.join(__dirname, 'dist/ocr-tool/browser'),  // Angular v19+ default
  path.join(__dirname, 'dist/ocr-tool'),          // Legacy or custom output
  path.join(__dirname, 'dist')                    // Direct output
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
  
  // Default to a path for server to start properly
  staticPath = path.join(__dirname, 'dist/ocr-tool');
}

console.log('Serving static files from:', staticPath);
app.use(express.static(staticPath));

// Special escape for problematic URLs - must be placed before catch-all route
app.get('/git.new/*', (req, res) => {
  res.status(404).send('Not found');
});

// Catch all other routes and return the Angular app
app.get('*', (req, res) => {
  try {
    // Look for index.html in the same location we found static files
    const indexPath = path.join(staticPath, 'index.html');
    console.log('Serving index from:', indexPath);

    // Check if index.html exists
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
});

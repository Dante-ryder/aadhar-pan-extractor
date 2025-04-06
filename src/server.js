const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Create Express application without using new patterns
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS with specific options to prevent URL parsing issues
app.use(cors({ 
  origin: true, // Allow all origins
  credentials: true // Allow credentials
}));

// Create uploads directory if it doesn't exist
const uploadsDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads/' : './uploads/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Add debugging middleware
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

// Configure multer for file uploads
const upload = multer({ dest: uploadsDir });

// Function to check if file is PDF
function isPDF(filePath) {
  const extname = path.extname(filePath).toLowerCase();
  return extname === '.pdf' || extname === '.pdf-processed.png';
}

// Function to convert PDF to image using ImageMagick (if installed)
async function convertPDFToImage(pdfPath) {
  try {
    console.log('Converting PDF to image:', pdfPath);
    const outputImagePath = pdfPath + '-page0.png';
    await execPromise(`convert -density 300 "${pdfPath}[0]" -quality 100 "${outputImagePath}"`);
    console.log('PDF converted successfully to:', outputImagePath);
    return outputImagePath;
  } catch (error) {
    console.error('Error converting PDF to image:', error);
    throw new Error('Failed to convert PDF to image. Make sure ImageMagick is installed.');
  }
}

// Process image endpoint
app.post('/process-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputPath = req.file.path;
    let processedPath;
    let imageToProcess = inputPath;

    // Handle PDF files
    if (isPDF(req.file.originalname)) {
      try {
        imageToProcess = await convertPDFToImage(inputPath);
      } catch (error) {
        console.error('PDF conversion error:', error);
        // If PDF conversion fails, return the original file
        return res.json({
          success: true,
          originalPath: req.file.path,
          processedPath: inputPath,
          processedUrl: `/processed-images/${path.basename(inputPath)}`,
          message: 'PDF file was uploaded but could not be converted. Using original file.'
        });
      }
    }

    // Process image with Sharp
    try {
      processedPath = imageToProcess + '-processed.png';
      await sharp(imageToProcess)
          .resize(800)
          .threshold(128)
          .toFile(processedPath);
    } catch (error) {
      console.error('Sharp processing error:', error);
      // If Sharp processing fails, try a simple copy as fallback
      processedPath = imageToProcess + '-unprocessed.png';
      fs.copyFileSync(imageToProcess, processedPath);

      return res.json({
        success: true,
        originalPath: req.file.path,
        processedPath: processedPath,
        processedUrl: `/processed-images/${path.basename(processedPath)}`,
        message: 'File format not supported by Sharp. Using original file.'
      });
    }

    // Return the processed image path
    res.json({
      success: true,
      originalPath: req.file.path,
      processedPath: processedPath,
      processedUrl: `/processed-images/${path.basename(processedPath)}`
    });
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files - specify exact path format to avoid regexp issues
app.use('/processed-images', express.static(uploadsDir));

// Serve static files from the Angular app
// Check multiple potential build locations - newer Angular outputs to dist/ocr-tool/browser
let staticPath;
const possiblePaths = [
  path.join(__dirname, '../dist/ocr-tool/browser'),  // Angular v19+ default
  path.join(__dirname, '../dist/ocr-tool'),          // Legacy or custom output
  path.join(__dirname, '../dist')                    // Direct output
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
  console.log('Directory contents of parent:', fs.readdirSync(path.join(__dirname, '..')));
  
  // Default to a path for server to start properly
  staticPath = path.join(__dirname, '../dist');
}

console.log('Serving static files from:', staticPath);
app.use(express.static(staticPath));

// Handle API routes first, before the catch-all

// Special escape for problematic URLs - must be placed before catch-all route
app.get('/git.new/*', (req, res) => {
  res.status(404).send('Not found');
});

// Catch all other routes and return the Angular app
// Use string path to avoid regexp issues
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
  console.log('Uploads directory:', uploadsDir);
});

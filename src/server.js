const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const sharp = require('sharp');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Create uploads directory if it doesn't exist
const uploadsDir = process.env.NODE_ENV === 'production' ? '/tmp/uploads/' : './uploads/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({ dest: uploadsDir });

// Function to check if file is PDF
function isPDF(filePath) {
  return path.extname(filePath).toLowerCase() === '.pdf';
}

// Function to convert PDF to image using ImageMagick (if installed)
async function convertPDFToImage(pdfPath) {
  try {
    const outputImagePath = pdfPath + '-page0.png';
    await execPromise(`convert -density 300 "${pdfPath}[0]" -quality 100 "${outputImagePath}"`);
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
    if (isPDF(inputPath)) {
      try {
        imageToProcess = await convertPDFToImage(inputPath);
      } catch (error) {
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
    res.status(500).json({ error: error.message });
  }
});

// Serve uploaded files
app.use('/processed-images', express.static(uploadsDir));

// Serve static files from the Angular app
app.use(express.static(path.join(__dirname, '../dist')));

// Catch all other routes and return the Angular app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Uploads directory:', uploadsDir);
  console.log('Static files directory:', path.join(__dirname, '../dist'));
});

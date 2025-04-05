const express = require('express');
const multer = require('multer');
const cors = require('cors');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const port = 3000;

// Enable CORS
app.use(cors());

// Set up file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

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

// Serve processed images
app.use('/processed-images', express.static(path.join(__dirname, 'uploads')));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

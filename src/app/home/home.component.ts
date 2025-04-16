import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { createWorker, OEM, PSM } from 'tesseract.js';
import { PdfReaderService } from './pdf-reader.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FileHandleService } from '../services/file-handle.service';
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-home',
  imports: [
    NgOptimizedImage,
    FormsModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  aadharFiles: File[] = [];
  panFiles: File[] = [];
  cardTypes: Record<string, RegExp> = {
    PAN: /[A-Z]{5}[0-9]{4}[A-Z]{1}/,
    AADHAR: /\d{4}\s\d{4}\s\d{4}/,
  };
  refreshing = false;
  textExtracted = '';
  nameExtracted = '';
  isProcessing = false;
  selectedCsvFile: File | null = null;
  extractedResults: Array<{
    fileName: string, 
    cardType: string, 
    number: string, 
    name: string, 
    dob?: string, 
    address?: string, 
    mobile?: string,
    sourceUrl?: string
  }> = [];

  // File handlers for direct file system access
  private csvFileName: string = 'extractions.csv';

  constructor(
    private pdfReaderService: PdfReaderService,
    private http: HttpClient,
    private router: Router,
    private fileHandleService: FileHandleService
  ) {}

  async extractCardDetails(cardType: string) {
    this.isProcessing = true;
    const files = cardType === 'AADHAR' ? this.aadharFiles : this.panFiles;

    try {
      for (const file of files) {
        // All files (PDF or images) will be processed with Tesseract
        const text = await this.processImageWithTesseract(file);

        // Process the extracted text to find specific details
        const details = this.extractDetails(text, cardType);

        const resultObj = {
          fileName: file.name,
          cardType: cardType,
          number: details.Number,
          name: details.Name || this.nameExtracted || 'Not found',
          dob: details.DOB,
          address: details.Address,
          mobile: details.Mobile,
          sourceUrl: this.getObjectUrl(file)
        };

        this.extractedResults.push(resultObj);
        this.textExtracted = text;

        // Save to history
        this.saveToHistory(resultObj);
      }
    } catch (error: any) {
      console.error(`Error processing ${cardType} files:`, error && error.message ? error.message : String(error));
      alert(`Error processing files: ${error && error.message ? error.message : String(error)}`);
    } finally {
      this.isProcessing = false;
    }
  }

  // Process image using Tesseract OCR directly
  async processImageWithTesseract(imageFile: File): Promise<string> {
    try {
      console.log(`Processing image: ${imageFile.name} (Size: ${Math.round(imageFile.size/1024)} KB)`);

      // For PDFs, first convert to an image using canvas rendering
      if (imageFile.type === 'application/pdf') {
        const text = await this.pdfReaderService.readPdf(imageFile);
        this.extractDetails(text, 'AADHAR')
        return text;
      }

      // For images, continue with the original image processing flow
      const imageUrl = URL.createObjectURL(imageFile);

      const worker = await createWorker();

      // Configure Tesseract with improved settings for handling multi-column layouts
      await worker.setParameters({
        // OCR Engine mode - using LSTM neural network only
        tessedit_ocr_engine_mode: OEM.LSTM_ONLY,

        // Page segmentation mode - AUTO with orientation and script detection for better column handling
        tessedit_pageseg_mode: PSM.AUTO_OSD,

        // Improve column detection and preserve line structure
        preserve_interword_spaces: '1',
        textord_tabfind_find_tables: '1',       // Enable table/column finding
        textord_tablefind_recognize_tables: '1', // Improve structure recognition

        // Character whitelist to improve accuracy
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /,:.-',

        // Output configuration
        tessedit_create_txt: '1',
        tessedit_create_hocr: '1',

        // Line finding improvement
        textord_min_linesize: '2.0',           // Don't break lines unnecessarily
        textord_parallel_baselines: '1',       // Help with multi-column
        tessedit_line_finding_algorithm: '1'
      });

      // Load the image onto a canvas for preprocessing
      const img = new Image();
      img.src = imageUrl;

      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // Resolve anyway to prevent hanging
      });

      // Create canvas and context
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 800; // Fallback width if image loading failed
      canvas.height = img.height || 1000; // Fallback height if image loading failed
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Draw the image and apply preprocessing
      ctx.drawImage(img, 0, 0);

      // Enhanced image preprocessing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale first
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;

        // Apply contrast and threshold
        const contrast = 1.5;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const value = factor * (avg - 128) + 128;

        // Thresholding to make text more distinct
        const threshold = 128;
        const final = value > threshold ? 255 : 0;

        data[i] = final;     // R
        data[i + 1] = final; // G
        data[i + 2] = final; // B
      }

      ctx.putImageData(imageData, 0, 0);

      // Create an image blob from canvas for OCR processing
      const processedImageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not create blob from canvas'));
          }
        }, 'image/png');
      });

      const { data: { text } } = await worker.recognize(processedImageBlob);

      // Log the extracted text to console
      console.log(`Extracted OCR Text from ${imageFile.name}:`, text);

      // Extract name from the text
      this.extractNameFromText(text);

      // Cleanup
      await worker.terminate();
      URL.revokeObjectURL(imageUrl);

      this.textExtracted = text;
      return text;
    } catch (error) {
      console.error('Error processing with Tesseract:', error);
      throw error;
    }
  }

  // Process PDF by converting to image first and then using Tesseract
  async processPdfWithTesseract(pdfFile: File): Promise<string> {
    try {
      console.log(`Processing PDF: ${pdfFile.name} (Size: ${Math.round(pdfFile.size/1024)} KB)`);

      // Create a canvas to render a basic PDF representation (simplified approach)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set canvas dimensions
      canvas.width = 1000;
      canvas.height = 1400;

      // Fill with white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw a colored border for better recognition
      ctx.strokeStyle = '#CCCCCC';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // We'll attempt to create a high contrast image of text for better OCR
      // 1. First get the PDF as an image to draw on the canvas
      const url = URL.createObjectURL(pdfFile);

      // Try to load the PDF as an image (this will work with certain PDFs)
      const img = new Image();

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // If we can load it as an image, draw it to the canvas
          ctx.drawImage(img, 0, 0);
          resolve();
        };

        img.onerror = () => {
          // If we can't load it as an image, we'll use placeholder text
          console.log('Could not load PDF as image, using alternate approach');

          // Placeholder text with file info
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 24px Arial';
          ctx.fillText(`Document: ${pdfFile.name}`, 50, 50);

          // Add some lines that might help with OCR text alignment
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const y = 100 + (i * 60);
            ctx.moveTo(50, y);
            ctx.lineTo(canvas.width - 50, y);
          }
          ctx.stroke();

          resolve();
        };

        // Try to load PDF as image
        img.src = url;
      });

      // Apply high-contrast filter to improve OCR
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and increase contrast
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        // High contrast threshold
        const val = avg > 120 ? 255 : 0;
        data[i] = val;     // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
      }

      // Put processed image back to canvas
      ctx.putImageData(imageData, 0, 0);

      console.log('Canvas prepared with high-contrast image for OCR');

      // Convert canvas to blob for Tesseract
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Could not create blob from canvas'));
          }
        }, 'image/png');
      });

      // Use Tesseract to extract text from the image with optimized settings
      const worker = await createWorker('eng', OEM.LSTM_ONLY);

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO, // Use auto segmentation
        tessedit_ocr_engine_mode: OEM.LSTM_ONLY, // Neural net mode
        preserve_interword_spaces: '1',
        tessjs_create_hocr: '0',
        tessjs_create_tsv: '0',
        textord_tablefind_recognize_tables: '1',  // Enable table detection
        textord_min_linesize: '1.25',            // Better handle small text
        textord_detect_columnnoise: '0',         // Don't treat columns as noise
        textord_tabfind_find_tables: '1',        // Find and process tables properly
        textord_tabfind_vertical_horizontal_mix: '1', // Handle mixed orientations
        tessedit_write_block_separators: '1',    // Separate text blocks
        textord_debug_block: '0',                // Don't output debug blocks
        textord_force_make_prop_words: '0',     // Don't force words to be proportional
        textord_tablefind_show_mark: '0',       // Don't show marks
        textord_bidir_words: '0',               // Disable bidirectional words processing
        textord_exit_after_blocks: '0',         // Process full document
        textord_single_column: '0',             // Don't assume single column
        textord_parallel_baselines: '1',        // Handle parallel text lines
      });

      console.log('Starting OCR processing with Tesseract...');
      const { data: { text } } = await worker.recognize(imageBlob);
      console.log(`OCR completed for ${pdfFile.name}`);

      // Clean up worker
      await worker.terminate();
      URL.revokeObjectURL(url);

      // Log the extracted text
      console.log(`Extracted text from PDF ${pdfFile.name}:\n${text}`);

      // Try to extract important information
      this.extractNameFromText(text);
      if (this.nameExtracted) {
        console.log(`Found name in PDF: ${this.nameExtracted}`);
      } else {
        console.log(`No name found in PDF ${pdfFile.name}`);
      }

      // Try to extract Aadhar number
      const aadharNumber = this.extractAadharNumber(text);
      if (aadharNumber) {
        console.log(`Found Aadhar number: ${aadharNumber}`);
      } else {
        console.log(`No Aadhar number found in PDF ${pdfFile.name}`);
      }

      return text;
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      return 'PDF processing error: ' + (error.message || 'Unknown error');
    }
  }

  // Extract text from PDF using PDF.js
  private async extractTextFromPdfWithPdfjs(pdfFile: File): Promise<string> {
    // Removed PDF.js implementation
    return '';
  }

  // Render a PDF page to a canvas
  private async renderPdfPageToCanvas(pdfFile: File, pageNum: number, canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    try {
      // Removed PDF.js implementation
      return canvas;
    } catch (error) {
      console.error('Error rendering PDF page to canvas:', error);

      // Fill with error message if rendering fails
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#FF0000';
        context.font = '20px Arial';
        context.fillText('Error rendering PDF', 20, 50);
      }

      return canvas;
    }
  }

  // Helper to read file as array buffer
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (!e.target || !e.target.result) {
          reject(new Error('Failed to read file'));
          return;
        }
        resolve(e.target.result as ArrayBuffer);
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Extract name from OCR text
  private extractNameFromText(text: string) {
    const isAadhar = text.includes('VID') || /\d{12}/.test(text.replace(/\s/g, ''));
    this.nameExtracted = isAadhar ? this.extractAadharName(text) : this.extractPanName(text);
    return this.nameExtracted;
  }

  // Extract name from Aadhar card text
  private extractAadharName(text: string): string {
    // Common words that should not be treated as names
    const commonWords = ['to', 'the', 'this', 'of', 'in', 'is', 'on', 'at', 'by', 'for', 'and', 'or', 'address', 'government', 'india', 'department', 'uidai'];

    // First, check if the text starts with "To" followed by a name - a common format
    const toNameMatch = text.match(/^\s*To\s*\n+\s*([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+){0,2})\s*$/im);
    if (toNameMatch && toNameMatch[1] && toNameMatch[1].length > 2) {
      const name = toNameMatch[1].trim();
      // Make sure it's not another common word
      if (!commonWords.includes(name.toLowerCase())) {
        this.nameExtracted = name;
        return name;
      }
    }

    // Try each pattern in order of reliability
    const patterns = [
      // Pattern 1: After "TH / Name" or similar
      /(?:TH|Name)\s*\/?\s*Name\s*\n+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,

      // Pattern 2: After "Name:" with proper capitalization
      /Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,

      // Pattern 3: Before "S/o" or "D/o" or Father
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:S\/O|D\/O|Father|WAT FT ATH)/i,

      // Pattern 4: After "Government of India" or similar headers
      /(?:GOVERNMENT OF INDIA|INDIA|UIDAI|GOVT OF).*?\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/s,

      // Pattern 5: Name in a line followed by Sha/Hr/DOB pattern
      /([A-Z][a-z]+\s+[A-Z][a-z]+)\n[A-Za-z\s]+DOB/is,

      // Pattern 6: First line of text if it looks like a name - exclude common words
      /^(?!\s*(?:to|the|this|from|address)\b)([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\n|$)/im,

      // Pattern 7: Name before DOB with possible OCR artifacts
      /([A-Z][a-z]+[\s]+[A-Z][a-z]+)(?:\s+(?:c\/DOB|DOB|Date of Birth)|DOB)/i,

      // Pattern 8: Name before ampersand
      /^(?!\s*(?:to|the|this|from|address)\b)([A-Za-z]+\s+[A-Za-z]+)(?=\s+&)/im,

      // Pattern 9: Name before C/O (updated to handle various formats)
      /([A-Za-z][a-z]*(?:\s+[A-Za-z][a-z]*){0,2})\s+C\/O/i,

      // Pattern 10: Single name on its own line - must not be a common word
      /^(?!\s*(?:to|the|this|from|address)\b)\s*([A-Za-z][a-z]{3,})\s*$/im,

      // Pattern 11: Name in a single line that is multiword and not a common header
      /^(?!\s*(?:to|the|this|from|address)\b)\s*([A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+){1,2})\s*$/im
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();

        // Debug log
        console.log(`Potential name match: "${name}"`);

        // Enhanced validation
        // 1. Explicit check for 'To'
        if (name.toLowerCase() === 'to') {
          console.log('Skipping "To" as a name');
          continue;
        }

        // 2. Skip single common words
        if (name.indexOf(' ') === -1 && commonWords.includes(name.toLowerCase())) {
          console.log(`Skipping common word: "${name}"`);
          continue;
        }

        // 3. Skip very short words that are likely not names
        if (name.length <= 2) {
          console.log(`Skipping very short word: "${name}"`);
          continue;
        }

        // 4. Basic name validation
        if (/^[A-Za-z\s]+$/.test(name) &&
            !commonWords.some(word => name.toLowerCase() === word)) {
          console.log(`Valid name found: "${name}"`);
          this.nameExtracted = name;
          return name;
        }
      }
    }

    // If no match found with strict patterns, try a more lenient pattern
    const lenientMatch = text.match(/^([A-Za-z]+(?:\s+[A-Za-z]+){1,3})/m);
    if (lenientMatch && lenientMatch[1]) {
      const name = lenientMatch[1].trim();
      this.nameExtracted = name;
      return name;
    }

    return 'Name Not Found';
  }

  // Extract name from PAN card text
  private extractPanName(text: string): string {
    // Common headers to exclude
    const excludePatterns = [
      /INCOME TAX DEPARTMENT/i,
      /GOVERNMENT OF INDIA/i,
      /UNIQUE IDENTIFICATION/i,
      /UIDAI/i,
      /ELECTION COMMISSION/i
    ];

    // Skip if first few lines contain PAN card headers
    const firstLines = text.split('\n').slice(0, 3).join('\n');
    if (excludePatterns.some(p => p.test(firstLines))) {
      // Remove the header lines before processing
      text = text.split('\n').slice(3).join('\n');
    }

    // Try each pattern in order of reliability
    const patterns = [
      // Pattern 1: Name on a line followed by name on next line
      /Name\s*\n+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,

      // Pattern 2: After "Name:" with proper capitalization
      /Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,

      // Pattern 3: First properly capitalized name after headers
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/m,

      // Pattern 4: Name before Father's name
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:S\/O|D\/O|Father)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Skip if name matches any exclude pattern
        if (excludePatterns.some(p => p.test(name))) {
          continue;
        }
        // Validate name format (2-3 words, properly capitalized, no all caps)
        this.nameExtracted = name;
        return name;
      }
    }

    return 'Name Not Found';
  }

  // Generic name extraction as fallback
  extractGenericName(text: string): string {
    // Last resort: look for any capitalized words group that's likely a name
    const genericNameRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/;
    const genericNameMatch = text.match(genericNameRegex);

    if (genericNameMatch && genericNameMatch[1]) {
      return genericNameMatch[1].trim();
    }

    return 'Name Not Found';
  }

  // Extract Aadhar card number
  extractAadharNumber(text: string): string {
    // Pattern for Aadhar numbers: either 12 digits with spaces/no spaces, or 16 digit VID

    // First try the VID format
    const vidMatch = text.match(/VID\s*:\s*(\d[\d\s]+\d)/i);
    if (vidMatch && vidMatch[1]) {
      const cleaned = vidMatch[1].replace(/\s+/g, '');
      if (cleaned.length === 16) {
        return cleaned;
      }
    }

    // Next try standard 12-digit Aadhar format
    const aadharMatch = text.match(/(\d[\d\s]+\d)/g);
    if (aadharMatch) {
      // Find a match that has approximately 12 digits when spaces are removed
      for (const match of aadharMatch) {
        const cleaned = match.replace(/\s+/g, '');
        if (cleaned.length === 12) {
          return cleaned;
        }
      }
    }

    return 'Number Not Found';
  }

  // Determine card type based on file name
  determineCardType(fileName: string): string {
    if (fileName.toLowerCase().includes('aadhar')) {
      return 'AADHAR';
    } else if (fileName.toLowerCase().includes('pan')) {
      return 'PAN';
    } else {
      return 'Unknown';
    }
  }

  // Function to extract card details using the provided regex
  extractDetails(ocrText: string, cardType: string) {
    try {
      const regex = new RegExp(this.cardTypes[cardType]);
      const matches = ocrText.match(regex);
      const result: {Number: string, Name?: string, DOB?: string, Address?: string, Mobile?: string} = {
        Number: matches ? matches[0] : `${cardType} Number not found`,
      };

      // Extract name based on card type
      if (cardType === 'PAN') {
        // For PAN cards, name typically appears after "Name" label
        const nameMatch = ocrText.match(/Name.*?\n\s*([A-Z][A-Z\s]+)(?=\s*\n)/);
        if (nameMatch && nameMatch[1]) {
          result.Name = this.nameExtracted || nameMatch[1].trim();
        } else {
          result.Name = this.nameExtracted || 'Not found';
        }
      } else if (cardType === 'AADHAR') {
        result.Name = this.extractNameFromText(ocrText);

        // Extract address and mobile for Aadhar cards only if they exist
        const address = this.extractAadharAddress(ocrText);
        if (address && address !== 'Address Not Found') {
          result.Address = address;
        }

        const mobile = this.extractMobileNumber(ocrText);
        if (mobile && mobile !== 'Mobile Not Found') {
          result.Mobile = mobile;
        }

        // Comprehensive logging of extracted data
        console.log('Extracted Aadhar Data:');
        console.log('-----------------------');
        console.log(`Name: ${result.Name}`);
        console.log(`Aadhar Number: ${result.Number}`);
        if (result.DOB) console.log(`Date of Birth: ${result.DOB}`);
        if (result.Address) console.log(`Address: ${result.Address}`);
        if (result.Mobile) console.log(`Mobile: ${result.Mobile}`);
        console.log('-----------------------');

        // Log the raw text
        console.log('Raw OCR Text:');
        console.log('-----------------------');
        console.log(ocrText);
        console.log('-----------------------');
      }

      // Extract DOB
      const dobMatch = ocrText.match(/(?:DOB|Date of Birth|Year of Birth)[\s:]*\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
      if (dobMatch && dobMatch[1]) {
        result.DOB = dobMatch[1].trim();
      } else {
        // Try to find just the date pattern
        const dateMatch = ocrText.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
        if (dateMatch && dateMatch[1]) {
          result.DOB = dateMatch[1].trim();
        }
      }

      return result;
    } catch (error) {
      console.error('Error extracting details:', error);
      return {
        Number: 'Error extracting number',
        Name: this.nameExtracted || 'Error extracting name',
        DOB: 'Error extracting DOB'
      };
    }
  }

  // Extract address from Aadhar card text
  extractAadharAddress(text: string): string {
    // Try to find address block starting with 'Address:' and continuing until a 6-digit pincode
    const addressRegex = /Address:(?:[\s\n]+)([\s\S]*?\b\d{3}\s*\d{3}\b)/i;
    const addressMatch = text.match(addressRegex);

    if (addressMatch && addressMatch[1]) {
      // Clean up the address: remove excessive whitespace and normalize line breaks
      let address = addressMatch[1].replace(/\s+/g, ' ').trim();

      // Format address with line breaks
      // Split by commas and common address separators
      const addressParts = address.split(/[,\n]+/);
      address = addressParts.map(part => part.trim()).join('\n');

      return address;
    }

    // If the specific format wasn't found, try more general patterns
    const patterns = [
      // Pattern 1: After "Address" and before a 6-digit number
      /Address.*?([\s\S]*?\b\d{3}\s*\d{3}\b)/i,

      // Pattern 2: Any text block containing address-like text
      /([\s\S]*?(?:street|road|avenue|lane|district|city|state|village|town).*?\b\d{3}\s*\d{3}\b)/i,

      // Pattern 3: Any text ending with a 6-digit pincode
      /([A-Za-z0-9\s,\/\-]+\b\d{3}\s*\d{3}\b)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let address = match[1].trim();
        // Format with line breaks
        const addressParts = address.split(/[,\n]+/);
        address = addressParts.map(part => part.trim()).join('\n');
        return address;
      }
    }

    return 'Address Not Found';
  }

  // Extract mobile number from Aadhar card text
  extractMobileNumber(text: string): string {
    // Try each pattern in order of reliability
    const patterns = [
      // Pattern 1: After "Mobile Number" label
      /Mobile Number.*?\n\s*(\d{10})/i,

      // Pattern 2: After "Mobile" label
      /Mobile.*?\n\s*(\d{10})/i,

      // Pattern 3: 10-digit number in the format of a mobile number
      /(\d{10})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const mobile = match[1].trim();
        // Validate mobile number format (10 digits)
        if (/^\d{10}$/.test(mobile)) {
          return mobile;
        }
      }
    }

    return 'Mobile Not Found';
  }

  processAadharFiles(): void {
    this.extractCardDetails('AADHAR');
  }

  processAadharWithMultipassThresholding(): void {
    this.isProcessing = true;
    
    // Set a timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.error('Processing timed out after 60 seconds');
      alert('Processing timed out. Try with a smaller image or use the regular upload button.');
      this.isProcessing = false;
    }, 60000); // 60 second timeout
    
    Promise.all(this.aadharFiles.map(file => this.processImageWithTesseract(file)))
      .then(texts => {
        clearTimeout(timeoutId); // Clear the timeout if successful
        texts.forEach((text, index) => {
          if (text) {
            const details = this.extractDetails(text, 'AADHAR');
            this.extractedResults.push({
              fileName: this.aadharFiles[index].name,
              cardType: 'AADHAR',
              number: details.Number,
              name: details.Name || this.nameExtracted || 'Not found',
              dob: details.DOB,
              address: details.Address,
              mobile: details.Mobile,
              sourceUrl: this.getObjectUrl(this.aadharFiles[index])
            });
            this.textExtracted = text;

            // Save to history
            this.saveToHistory(this.extractedResults[this.extractedResults.length - 1]);
          }
        });
        this.isProcessing = false;
      })
      .catch(error => {
        clearTimeout(timeoutId); // Clear the timeout on error
        console.error('Error processing files with multi-pass:', error);
        alert(`Error processing files: ${error.message || String(error)}`);
        this.isProcessing = false;
      });
  }

  processPanFiles(): void {
    this.isProcessing = true;

    // Set a timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.error('Processing timed out after 60 seconds');
      alert('Processing timed out. Try with a smaller image or use the regular upload button.');
      this.isProcessing = false;
    }, 60000); // 60 second timeout

    const processPromises = this.panFiles.map(file => {
      // Use the appropriate method based on file type
      if (file.type === 'application/pdf') {
        return this.processPdfWithTesseract(file);
      } else {
        return this.processImageWithTesseract(file);
      }
    });

    Promise.all(processPromises)
      .then(textResults => {
        clearTimeout(timeoutId);
        textResults.forEach((text, index) => {
          if (text) {
            const panFile = this.panFiles[index];
            const details = this.extractDetails(text, 'PAN');
            this.extractedResults.push({
              fileName: panFile.name,
              cardType: 'PAN',
              number: details.Number,
              name: details.Name || this.nameExtracted || 'Not found',
              dob: details.DOB || '',
              address: details.Address || '',
              mobile: details.Mobile || '',
              sourceUrl: this.getObjectUrl(panFile)
            });
            this.textExtracted = text;

            // Save to history
            this.saveToHistory(this.extractedResults[this.extractedResults.length - 1]);
          }
        });
        this.isProcessing = false;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error('Error processing files:', error);
        alert(`Error processing files: ${error.message || String(error)}`);
        this.isProcessing = false;
      });
  }
  
  // Download extracted data as CSV
  downloadCSV(cardType: 'ALL' | 'AADHAR' | 'PAN') {
    // Filter results based on card type
    let resultsToDownload = this.extractedResults;
    if (cardType !== 'ALL') {
      resultsToDownload = this.extractedResults.filter(result => result.cardType === cardType);
    }

    if (resultsToDownload.length === 0) {
      alert('No data to download');
      return;
    }

    // Create CSV content
    const headers = 'File Name,Card Type,Number,Name,DOB,Address,Mobile\n';
    const rows = resultsToDownload.map(result =>
      `"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}","${result.address || ''}","${result.mobile || ''}"`
    ).join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + headers + rows;

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${cardType === 'ALL' ? 'all' : cardType.toLowerCase()}_extracted_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  removeFile(fileList: File[], index: number): void {
    fileList.splice(index, 1);
  }

  // Remove an extracted result from the list
  removeExtractedResult(index: number): void {
    this.extractedResults.splice(index, 1);
  }

  // Handle CSV file selection
  onCsvFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedCsvFile = target.files[0];
      console.log('CSV file selected:', this.selectedCsvFile.name);
    } else {
      this.selectedCsvFile = null;
    }
  }

  async ngOnInit() {
    try {
      // Get the stored directory or file handle info
      const storageInfo = localStorage.getItem('csvDirHandle');
      if (!storageInfo) {
        this.router.navigate(['/storage-select']);
        return;
      }

      // Only re-initialize if we don't already have a valid handle
      if (!this.fileHandleService.hasValidHandle()) {
        await this.initializeFileAccess();
      }
      
      // Update local reference to the file name
      this.csvFileName = this.fileHandleService.getFileName();
      
      console.log(`File access ready: ${this.csvFileName}`);
    } catch (error) {
      console.error('Error initializing file access:', error);
      alert('Failed to access your selected storage location. Please choose again.');
      this.router.navigate(['/storage-select']);
    }
  }

  async initializeFileAccess() {
    try {
      // Get the stored directory or file handle info
      const storageInfo = localStorage.getItem('csvDirHandle');
      if (!storageInfo) return;

      const parsedInfo = JSON.parse(storageInfo);

      // Check if we already have a valid handle in the service
      if (this.fileHandleService.hasValidHandle()) {
        return; // Skip initialization if we already have a handle
      }

      // We need to re-request permission as handles can't be stored in localStorage directly
      if (parsedInfo.type === 'directory') {
        // For directory selection, we need to prompt user again
        const dirHandle = await window.showDirectoryPicker();
        const fileHandle = await dirHandle.getFileHandle(this.csvFileName, { create: true });
        
        this.fileHandleService.setDirectoryHandle(dirHandle);
        this.fileHandleService.setFileHandle(fileHandle);
      } else {
        // For file selection
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{
            description: 'CSV Files',
            accept: {
              'text/csv': ['.csv']
            }
          }]
        });
        
        this.fileHandleService.setFileHandle(fileHandle);
      }

      this.csvFileName = this.fileHandleService.getFileName();
      console.log(`File access initialized: ${this.csvFileName}`);
    } catch (error) {
      console.error('Error accessing file:', error);
      alert('Failed to access your selected storage location. Please choose again.');
      this.router.navigate(['/storage-select']);
    }
  }

  // Save extraction results directly to the selected file
  async saveToFile() {
    const fileHandle = this.fileHandleService.getFileHandle();
    
    if (!fileHandle || this.extractedResults.length === 0) {
      alert('No file access or no data to save');
      return;
    }

    try {
      // Get existing file content
      const file = await fileHandle.getFile();
      let existingContent = '';
      
      if (file.size > 0) {
        const reader = new FileReader();
        existingContent = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string || '');
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }

      // Prepare new rows
      const newRows = this.extractedResults.map(result =>
        `"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}","${result.address || ''}","${result.mobile || ''}"`
      ).join('\n');
      
      // Create writable stream
      const writable = await fileHandle.createWritable();

      // Prepare content to write
      let contentToWrite;
      if (existingContent.length === 0) {
        // Empty file - add header
        const headers = 'File Name,Card Type,Number,Name,DOB,Address,Mobile\n';
        contentToWrite = headers + newRows;
      } else {
        // File has content - check if it has headers
        const hasHeader = existingContent.includes('File Name,Card Type,Number');
        
        if (hasHeader) {
          // Append to existing content
          contentToWrite = existingContent.endsWith('\n') 
            ? existingContent + newRows 
            : existingContent + '\n' + newRows;
        } else {
          // File has no headers, add headers and rows
          const headers = 'File Name,Card Type,Number,Name,DOB,Address,Mobile\n';
          contentToWrite = headers + existingContent + 
            (existingContent.endsWith('\n') ? '' : '\n') + newRows;
        }
      }

      // Write to file
      await writable.write(contentToWrite);
      await writable.close();

      // Clear extracted results after saving to avoid duplication
      alert(`Successfully saved ${this.extractedResults.length} records to ${this.csvFileName}`);
      
      // Clear results after saving
      // this.extractedResults = [];
    } catch (error) {
      console.error('Error saving to file:', error);
      alert(`Error saving to file: ${error}`);
    }
  }

  // Create object URL for file preview
  getObjectUrl(file: File): string {
    if (file.type === 'application/pdf') {
      // For PDFs, we need to create a thumbnail
      return this.generatePdfThumbnail(file);
    }
    // For images, we can use the direct object URL
    return URL.createObjectURL(file);
  }

  // Generate a thumbnail for PDF files
  generatePdfThumbnail(pdfFile: File): string {
    // Create a placeholder thumbnail
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 250;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Draw a PDF-like icon/placeholder
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(0, 0, canvas.width, 40);
      
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText('PDF', 10, 25);
      
      ctx.font = '14px Arial';
      ctx.fillStyle = '#333';
      ctx.fillText(pdfFile.name.length > 20 ? pdfFile.name.substring(0, 20) + '...' : pdfFile.name, 10, 60);
      
      // Create PDF logo/icon
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(canvas.width/2 - 30, canvas.height/2 - 30, 60, 80);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('PDF', canvas.width/2 - 20, canvas.height/2 + 10);
    }
    
    // Convert canvas to data URL
    return canvas.toDataURL('image/png');
  }

  // Release object URLs when component is destroyed
  ngOnDestroy() {
    // Clean up object URLs to prevent memory leaks
    this.extractedResults.forEach(result => {
      if (result.sourceUrl) {
        URL.revokeObjectURL(result.sourceUrl);
      }
    });
  }

  // Navigate to storage selection page
  changeStorageLocation() {
    this.router.navigate(['/storage-select']);
  }

  // Image zooming functionality
  private zoomedElement: HTMLElement | null = null;

  showZoomedImage(event: MouseEvent) {
    const target = event.target as HTMLImageElement;
    if (!target) return;
    
    // Create a zoomed preview container if it doesn't exist
    if (!this.zoomedElement) {
      this.zoomedElement = document.createElement('div');
      this.zoomedElement.className = 'zoomed-preview';
      this.zoomedElement.style.position = 'fixed';
      this.zoomedElement.style.zIndex = '1000';
      this.zoomedElement.style.border = '2px solid #ccc';
      this.zoomedElement.style.backgroundColor = 'white';
      this.zoomedElement.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
      this.zoomedElement.style.overflow = 'hidden';
      this.zoomedElement.style.padding = '0';
      this.zoomedElement.style.width = '300px';
      this.zoomedElement.style.height = '300px';
      this.zoomedElement.style.borderRadius = '50%';
      document.body.appendChild(this.zoomedElement);
    }

    // Get cursor position relative to image
    const rect = target.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate percentages of cursor position on the image
    const percentX = mouseX / rect.width;
    const percentY = mouseY / rect.height;
    
    // Create zoomed image
    const zoomedImg = document.createElement('img');
    zoomedImg.src = target.src;
    zoomedImg.style.width = '900px';
    zoomedImg.style.height = '900px';
    zoomedImg.style.objectFit = 'cover';
    zoomedImg.style.position = 'absolute';
    
    // Position the image to show the hovered area
    // Calculate the center point for the magnifier
    const zoomWidth = 900;
    const zoomHeight = 900;
    const magnifierWidth = 300;
    const magnifierHeight = 300;
    
    // Center the magnified area on cursor position
    const posX = -(percentX * zoomWidth - magnifierWidth/2);
    const posY = -(percentY * zoomHeight - magnifierHeight/2);
    
    zoomedImg.style.left = `${posX}px`;
    zoomedImg.style.top = `${posY}px`;
    
    // Clear previous content and add the new zoomed image
    this.zoomedElement.innerHTML = '';
    this.zoomedElement.appendChild(zoomedImg);
    
    // Position the zoomed element near the cursor
    this.zoomedElement.style.display = 'block'; // Make sure this is set
    this.updateZoomPosition(event);
    
    // Add mousemove listener to update position when cursor moves
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
  }

  handleMouseMove(event: MouseEvent) {
    // Update the tooltip position
    this.updateZoomPosition(event);
    
    // Update the magnified area
    this.updateMagnifiedArea(event);
  }
  
  updateMagnifiedArea(event: MouseEvent) {
    if (!this.zoomedElement) return;
    
    const target = event.target as HTMLImageElement;
    if (!target.classList.contains('document-preview')) return;
    
    // Get cursor position relative to image
    const rect = target.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate percentages of cursor position on the image
    const percentX = mouseX / rect.width;
    const percentY = mouseY / rect.height;
    
    // Update the zoomed image position
    const zoomedImg = this.zoomedElement.querySelector('img');
    if (zoomedImg) {
      // Calculate the center point for the magnifier
      const zoomWidth = 900;
      const zoomHeight = 900;
      const magnifierWidth = 300;
      const magnifierHeight = 300;
      
      // Center the magnified area on cursor position
      // Multiply by zoom width/height, then offset by half the magnifier width/height
      const posX = -(percentX * zoomWidth - magnifierWidth/2);
      const posY = -(percentY * zoomHeight - magnifierHeight/2);
      
      zoomedImg.style.left = `${posX}px`;
      zoomedImg.style.top = `${posY}px`;
    }
  }

  updateZoomPosition(event: MouseEvent) {
    if (!this.zoomedElement) return;
    
    const padding = 20; // Padding from cursor
    let left = event.clientX + padding;
    let top = event.clientY + padding;
    
    // Make sure the zoomed image stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const zoomWidth = 300; // Must match the width set in showZoomedImage
    const zoomHeight = 300; // Must match the height set in showZoomedImage
    
    if (left + zoomWidth > viewportWidth) {
      left = event.clientX - zoomWidth - padding;
    }
    
    if (top + zoomHeight > viewportHeight) {
      top = event.clientY - zoomHeight - padding;
    }
    
    this.zoomedElement.style.left = `${left}px`;
    this.zoomedElement.style.top = `${top}px`;
  }

  hideZoomedImage() {
    if (this.zoomedElement) {
      this.zoomedElement.style.display = 'none';
      document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    }
  }

  // File handling methods
  onAadharFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.aadharFiles = Array.from(input.files);
    }
  }

  onPanFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.panFiles = Array.from(input.files);
    }
  }

  // Save extraction results to localStorage for history
  saveToHistory(result: any) {
    // Get existing history from localStorage
    const historyStr = localStorage.getItem('extractionHistory');
    let history = [];
    
    if (historyStr) {
      try {
        history = JSON.parse(historyStr);
      } catch (e) {
        console.error('Error parsing history:', e);
      }
    }
    
    // Add timestamp to the result
    const resultWithTimestamp = {
      ...result,
      documentType: result.cardType.toLowerCase(),
      timestamp: new Date().toISOString()
    };
    
    // Add to history
    history.push(resultWithTimestamp);
    
    // Save back to localStorage
    localStorage.setItem('extractionHistory', JSON.stringify(history));
  }
}

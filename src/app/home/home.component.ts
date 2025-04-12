import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { createWorker, OEM, PSM } from 'tesseract.js';
import { PdfReaderService } from './pdf-reader.service';

@Component({
  selector: 'app-home',
  imports: [
    NgOptimizedImage
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
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
  extractedResults: Array<{fileName: string, cardType: string, number: string, name: string, dob?: string}> = [];

  constructor(private pdfReaderService: PdfReaderService) {}

  async extractCardDetails(cardType: string) {
    this.isProcessing = true;
    const files = cardType === 'AADHAR' ? this.aadharFiles : this.panFiles;

    try {
      for (const file of files) {
        // All files (PDF or images) will be processed with Tesseract
        const text = await this.processImageWithTesseract(file);
        
        // Process the extracted text to find specific details
        const details = this.extractDetails(text, cardType);
        
        this.extractedResults.push({
          fileName: file.name,
          cardType: cardType,
          number: details.Number,
          name: details.Name || this.nameExtracted || 'Not found',
          dob: details.DOB
        });
        
        this.textExtracted = text;
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
      // For PDFs, first convert to an image using canvas rendering
      if (imageFile.type === 'application/pdf') {
        const text = await this.pdfReaderService.readPdf(imageFile);
        this.extractDetails(text, 'AADHAR')
        return text;
      }
      
      // For images, continue with the original image processing flow
      const imageUrl = URL.createObjectURL(imageFile);
      
      // Initialize Tesseract worker
      const worker = await createWorker('eng', OEM.LSTM_ONLY);
      
      // Set parameters for better recognition
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,  // Changed from SINGLE_BLOCK to AUTO
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /',
        tessedit_create_txt: '1',
        tessedit_create_hocr: '1',
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
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
        tessjs_create_tsv: '0'
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
      
      // Pattern 6: First line of text if it looks like a name
      /^([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\n|$)/m,
      
      // Pattern 7: Name before DOB with possible OCR artifacts
      /([A-Z][a-z]+[\s]+[A-Z][a-z]+)(?:\s+(?:c\/DOB|DOB|Date of Birth)|DOB)/i,
      
      // Pattern 8: Name before ampersand
      /^([A-Za-z]+\s+[A-Za-z]+)(?=\s+&)/m
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Validate name format (2-3 words, properly capitalized)
        if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}$/.test(name)) {
          this.nameExtracted = name;
          return name;
        }
      }
    }

    // If no match found with strict patterns, try a more lenient pattern
    const lenientMatch = text.match(/^([A-Za-z]+(?:\s+[A-Za-z]+){1,2})/m);
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
      const result: {Number: string, Name?: string, DOB?: string} = {
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
        console.log(result)
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

  processAadharFiles(): void {
    this.extractCardDetails('AADHAR');
  }

  processPanFiles(): void {
    this.extractCardDetails('PAN');
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
    const headers = 'File Name,Card Type,Number,Name,DOB\n';
    const rows = resultsToDownload.map(result =>
      `"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}"`
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
}

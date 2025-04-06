import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Tesseract from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';

// Set the worker source to match the actual loaded API version 3.4.120
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js`;

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
    AADHAR: /\d{4}\s?\d{4}\s?\d{4}/,
  };
  refreshing = false;
  processing = false;
  processingMessage = '';

  // Store extracted results
  extractedResults: Array<{fileName: string, cardType: string, number: string, name: string, dob?: string}> = [];

  // API base URL - empty string for production (relative URLs) or localhost for development
  private apiBaseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

  constructor(private http: HttpClient) {}

  async extractCardDetails(cardType: string) {
    const files = cardType === 'AADHAR' ? this.aadharFiles : this.panFiles;

    // Set processing state
    this.processing = true;
    this.processingMessage = `Processing ${files.length} ${cardType} document${files.length > 1 ? 's' : ''}. Please wait...`;

    for (const file of files) {
      try {
        // Check if file is PDF
        const isPdf = file.type === 'application/pdf';
        let text = '';

        if (isPdf) {
          // Process PDF with PDF.js
          text = await this.extractTextFromPdf(file);
        } else {
          // Create form data to send to backend
          const formData = new FormData();
          formData.append('image', file);

          // Send to backend for processing with Sharp
          const response: any = await this.http.post(`${this.apiBaseUrl}/process-image`, formData).toPromise();

          // Get the URL of the processed image
          const processedImageUrl = `${this.apiBaseUrl}${response.processedUrl}`;

          // Use Tesseract to perform OCR on the processed image
          const result = await Tesseract.recognize(processedImageUrl, 'eng');
          text = result.data.text;
        }

        // Extract details based on the card type and provided regexes
        const extractedData = this.extractDetails(text, cardType);

        // Store the result
        this.extractedResults.push({
          fileName: file.name,
          cardType: cardType,
          number: extractedData.Number,
          name: extractedData.Name || 'Not found',
          dob: extractedData.DOB
        });
      } catch (error) {
        // Still add an entry with error information
        this.extractedResults.push({
          fileName: file.name,
          cardType: cardType,
          number: 'Error - could not process file',
          name: 'Error',
          dob: ''
        });
      }
    }

    // Reset processing state when done
    this.processing = false;
    this.processingMessage = '';
  }

  // Simple method to extract text from PDF using PDF.js
  async extractTextFromPdf(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e: ProgressEvent<FileReader>) => {
        try {
          if (!e.target || !e.target.result) {
            reject(new Error('Failed to read file'));
            return;
          }

          const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
          const pdf = await pdfjs.getDocument(typedArray).promise;

          // Get text from first page only for simplicity
          const page = await pdf.getPage(1);
          const textContent = await page.getTextContent();
          const text = textContent.items.map((item: any) => item.str).join(' ');

          resolve(text);
        } catch (error) {
          // If PDF.js fails, return an empty string and let the rest of the flow continue
          resolve('');
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Function to extract card details using the provided regex
  extractDetails(ocrText: string, cardType: string) {
    // First, handle PAN number with improved OCR correction
    let matches = null;
    let result: {Number: string, Name?: string, DOB?: string} = {
      Number: `${cardType} Number not found`,
    };

    if (cardType === 'PAN') {
      // Try with OCR correction for PAN numbers
      const correctedText = this.correctOcrForPan(ocrText);
      const regex = new RegExp(this.cardTypes[cardType]);
      matches = correctedText.match(regex);

      if (matches && matches[0]) {
        result.Number = matches[0];
      }

      // Extract name from line after "TR/ Name" or "Name" text
      const lines = ocrText.split(/\r?\n/);
      
      // Find line containing Name or TR/ Name
      const nameLineIndex = lines.findIndex(line => /\b(TR\/\s*Name|Name)\b/i.test(line));
      
      if (nameLineIndex >= 0 && nameLineIndex < lines.length - 1) {
        // Get the next line which should have the name
        const nameLine = lines[nameLineIndex + 1].trim();
        
        // Extract the actual name by taking the uppercase alphabetic part from the beginning
        // PAN card names are always uppercase
        const nameMatch = nameLine.match(/^([A-Z\s]+)/i);
        if (nameMatch && nameMatch[1] && nameMatch[1].length > 2) {
          result.Name = nameMatch[1].trim();
        }
      }
      
      // If name not found with above method, try fallback methods
      if (!result.Name) {
        // Try traditional pattern
        const nameMatch = ocrText.match(/Name\s*[:\.]?\s*([A-Z\s]+)/i);
        if (nameMatch && nameMatch[1]) {
          result.Name = nameMatch[1].trim();
        } else {
          // Try to find any all-caps words that might be a name
          const allCapsMatch = ocrText.match(/([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)/i);
          if (allCapsMatch && allCapsMatch[1] && allCapsMatch[1].length > 4) {
            result.Name = allCapsMatch[1].trim();
          }
        }
      }
    } else {
      // For other card types, use the standard regex
      const regex = new RegExp(this.cardTypes[cardType]);
      matches = ocrText.match(regex);
      if (matches && matches[0]) {
        result.Number = matches[0];
      }

      // For Aadhar cards, look for name before S/O, D/O, or W/O
      const nameMatch = ocrText.match(/([A-Z\s]+)\s+(?:S\/O|D\/O|W\/O|Son Of|Daughter Of|Wife Of)/i);

      if (nameMatch && nameMatch[1]) {
        result.Name = nameMatch[1].trim();
      } else {
        // Fallback to DOB pattern if relationship indicator not found
        const dobMatch = ocrText.match(/(.*?)\s+(?:DOB|Date of Birth|Year of Birth)[\s:]*\d{2}[\/\-]\d{2}[\/\-]\d{4}/i);
        
        if (dobMatch && dobMatch[1]) {
          // Get the last word group before DOB (likely the name)
          const textBeforeDob = dobMatch[1].trim();
          const words = textBeforeDob.split(/\s+/);
          
          // Take last 2-3 words as the name
          const nameWords = words.slice(Math.max(0, words.length - 3));
          result.Name = nameWords.join(' ');
        } else {
          // Try to find the actual date pattern and extract text before it
          const dateMatch = ocrText.match(/([^\d]+)\s+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
          if (dateMatch && dateMatch[1]) {
            const textBeforeDate = dateMatch[1].trim();
            
            // Get the last 2-3 words before the date
            const words = textBeforeDate.split(/\s+/);
            const nameWords = words.slice(Math.max(0, words.length - 3));
            result.Name = nameWords.join(' ');
          } else {
            // Second fallback - look for a capitalized name pattern
            const fallbackMatch = ocrText.match(/([A-Z]{2,}\s+[A-Z]{2,}(?:\s+[A-Z]{2,})?)/i);
            if (fallbackMatch && fallbackMatch[1]) {
              result.Name = fallbackMatch[1].trim();
            }
          }
        }
      }
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
  }

  // Helper function to correct common OCR errors for PAN card numbers
  correctOcrForPan(text: string): string {
    // Find all potential PAN-like sequences (10 characters)
    const panMatches = text.match(/[A-Z0-9]{10}/ig) || [];

    let correctedText = text;
    for (const match of panMatches) {
      // Convert to array of characters
      const chars = match.split('');

      // Apply position-specific corrections based on PAN card format (AAAAA0000A)
      // First 5 positions should be letters
      for (let i = 0; i < 5; i++) {
        // Convert numbers to similar-looking letters
        if (chars[i] === '0') chars[i] = 'O';
        if (chars[i] === '1') chars[i] = 'I';
        if (chars[i] === '8') chars[i] = 'B';
      }

      // Next 4 positions should be numbers
      for (let i = 5; i < 9; i++) {
        // Convert letters to similar-looking numbers
        if (chars[i] === 'O' || chars[i] === 'o') chars[i] = '0';
        if (chars[i] === 'I' || chars[i] === 'l' || chars[i] === 'L') chars[i] = '1';
        if (chars[i] === 'B') chars[i] = '8';
      }

      // Last position should be a letter
      if (chars[9] === '0') chars[9] = 'O';
      if (chars[9] === '1') chars[9] = 'I';
      if (chars[9] === '8') chars[9] = 'B';

      // Replace the original match with the corrected one
      const corrected = chars.join('');
      correctedText = correctedText.replace(match, corrected);
    }

    return correctedText;
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
  }

  onAadharSelected(event: any): void {
    this.aadharFiles = Array.from(event.target.files);
  }

  onPanSelected(event: any): void {
    this.panFiles = Array.from(event.target.files);
  }

  processAadharFiles(): void {
    if (this.aadharFiles.length === 0) {
      alert('Please select at least one Aadhar document to process');
      return;
    }
    this.extractCardDetails('AADHAR');
  }

  processPanFiles(): void {
    if (this.panFiles.length === 0) {
      alert('Please select at least one PAN document to process');
      return;
    }
    this.extractCardDetails('PAN');
  }

  removeExtractedResult(index: number) {
    this.extractedResults.splice(index, 1);
  }

  // Method to remove a file from a file list
  removeFile(files: File[], index: number): void {
    files.splice(index, 1);
  }
}

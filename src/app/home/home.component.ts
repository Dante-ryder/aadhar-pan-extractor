import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Tesseract from 'tesseract.js';
import * as pdfjs from 'pdfjs-dist';

// Set the worker path
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

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

  // Store extracted results
  extractedResults: Array<{fileName: string, cardType: string, number: string, name: string, dob?: string}> = [];

  constructor(private http: HttpClient) {}

  async extractCardDetails(cardType: string) {
    const files = cardType === 'AADHAR' ? this.aadharFiles : this.panFiles;

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
          const response: any = await this.http.post('http://localhost:3000/process-image', formData).toPromise();

          // Get the URL of the processed image
          const processedImageUrl = `http://localhost:3000${response.processedUrl}`;

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
        throw error;
      }
    }
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
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  // Function to extract card details using the provided regex
  extractDetails(ocrText: string, cardType: string) {
    const regex = new RegExp(this.cardTypes[cardType]);
    const matches = ocrText.match(regex);
    const result: {Number: string, Name?: string, DOB?: string} = {
      Number: matches ? matches[0] : `${cardType} Number not found`,
    };

    // Extract name based on card type
    if (cardType === 'PAN') {
      // For PAN cards, name typically appears after "Name" label
      const nameMatch = ocrText.match(/Name\s*[:\.]?\s*([A-Za-z\s]+)/i);
      if (nameMatch && nameMatch[1]) {
        result.Name = nameMatch[1].trim();
      }
    } else if (cardType === 'AADHAR') {
      // For Aadhar cards, look for name before S/O, D/O, or W/O
      
      // Pattern to find name before relationship indicator
      const nameMatch = ocrText.match(/([A-Za-z\s]+)\s+(?:S\/O|D\/O|W\/O|Son Of|Daughter Of|Wife Of)/i);
      
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
            const fallbackMatch = ocrText.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
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

    // Trigger download
    link.click();
    document.body.removeChild(link);
  }

  // Remove an extracted result
  removeExtractedResult(index: number) {
    this.extractedResults.splice(index, 1);
  }

  onAadharSelected(event: any): void {
    this.aadharFiles.push(...event.target.files);
  }

  onPanSelected(event: any): void {
    this.panFiles.push(...event.target.files);
  }

  removeFile(files: any, index: number): void {
    files.splice(index, 1);
  }

  processAadharFiles(): void {
    this.extractCardDetails('AADHAR');
  }

  processPanFiles(): void {
    this.extractCardDetails('PAN');
  }
}

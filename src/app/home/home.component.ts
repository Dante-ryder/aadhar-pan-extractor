import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { createWorker, OEM, PSM } from 'tesseract.js';
import { NgOptimizedImage } from '@angular/common';
import { PdfReaderService } from './pdf-reader.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FileHandleService } from '../services/file-handle.service';
import { FormsModule } from "@angular/forms";
import { ToastService } from '../services/toast.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NgOptimizedImage,
    FormsModule,
    CommonModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
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
    pan?: string,
    sourceUrl?: string,
    fullText?: string
  }> = [];

  // File handlers for direct file system access
  private csvFileName: string = 'extractions.csv';

  private spellChecker: any;
  private worker: any;

  constructor(
    private pdfReaderService: PdfReaderService,
    private http: HttpClient,
    private router: Router,
    private fileHandleService: FileHandleService,
    public toastService: ToastService
  ) {}

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

      // Initialize Tesseract worker - create worker in initTesseract
      await this.initTesseract();
      
      // Initialize the spell checker
      await this.initSpellChecker();
    } catch (error) {
    }
  }

  private async initTesseract() {
    try {
      // Create a new worker instance properly
      this.worker = await createWorker();
      await this.worker.loadLanguage('eng');
      await this.worker.initialize('eng');
      
      // Configure the worker with proper settings
      await this.worker.setParameters({
        tessedit_ocr_engine_mode: OEM.LSTM_ONLY,
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1'
      });
      
    } catch (error) {
    }
  }

  private async initSpellChecker() {
    try {
      // Create a simple dictionary-based spell checker
      this.spellChecker = {
        // Common OCR mistakes and their corrections
        corrections: {
          // Aadhar/identity related
          'ldentity': 'Identity',
          'ldentification': 'Identification',
          'aadnar': 'Aadhaar',
          'addhar': 'Aadhaar',
          'adhar': 'Aadhaar',
          'aadhaar': 'Aadhaar',
          'aadharcard': 'Aadhaar Card',
          'aadharcord': 'Aadhaar Card',
          'addres': 'Address',
          'adress': 'Address',
          'oddress': 'Address',
          'lndian': 'Indian',
          'indlan': 'Indian',
          'lndia': 'India',
          'indla': 'India',
          'governrnent': 'Government',
          'covernment': 'Government',
          'goverment': 'Government',
          'govemment': 'Government',
          'govtof': 'Govt of',
          'govtot': 'Govt of',
          'nurnber': 'number',
          'rnale': 'male',
          'fernale': 'female',
          'rnobile': 'mobile',
          'moblle': 'mobile',
          'birth': 'Birth',
          'blrth': 'Birth',
          'dote': 'date',
          'dale': 'date',
          'narne': 'name',
          'nome': 'name',
          'yeor': 'year',
          'yeors': 'years',
          'fother': 'father',
          'rnother': 'mother',
          'vilage': 'village',
          'villoge': 'village',
          'tornily': 'family',
          'fomily': 'family',
          'permonent': 'permanent',
          'permenent': 'permanent',
          
          // Tamil state name variations
          'tamilfads': 'Tamil Nadu',
          'tamilfad': 'Tamil Nadu',
          'tamilnads': 'Tamil Nadu',
          'tamilnad': 'Tamil Nadu',
          'tamilned': 'Tamil Nadu',
          'tamilnod': 'Tamil Nadu',
          'tamilnadu': 'Tamil Nadu',
          
          // Tamil places and proper nouns in English alphabets (with common OCR errors)
          'chennal': 'Chennai',
          'chennoi': 'Chennai',
          'modras': 'Madras',
          'madros': 'Madras',
          'tornilnadu': 'Tamilnadu',
          'tamilnodu': 'Tamilnadu',
          'tamll': 'Tamil',
          'tamli': 'Tamil',
          'tomil': 'Tamil',
          'coimbotore': 'Coimbatore',
          'colmbatore': 'Coimbatore',
          'coinbatore': 'Coimbatore',
          'tiruchirapalli': 'Tiruchirappalli',
          'tiruchirapolli': 'Tiruchirappalli',
          'tiruchiropalli': 'Tiruchirappalli',
          'tiruppur': 'Tiruppur',
          'tirupur': 'Tiruppur',
          'madural': 'Madurai',
          'madurol': 'Madurai',
          'modurai': 'Madurai',
          'vellore': 'Vellore',
          'velore': 'Vellore',
          'solem': 'Salem',
          'salern': 'Salem',
          'solern': 'Salem',
          'thanjavur': 'Thanjavur',
          'thonjavur': 'Thanjavur',
          'thiruvananthapuram': 'Thiruvananthapuram',
          'trivandrum': 'Thiruvananthapuram',
          'erode': 'Erode',
          'pondicherry': 'Pondicherry',
          'puducherry': 'Puducherry',
          'puducherri': 'Puducherry',
          'puducherrl': 'Puducherry',
          'karaikal': 'Karaikal',
          'koraikal': 'Karaikal',
          'kanchipuram': 'Kanchipuram',
          'konchipuram': 'Kanchipuram',
          'hosur': 'Hosur',
          'ooty': 'Ooty',
          'udhagamandalam': 'Udhagamandalam',
          'dindigul': 'Dindigul',
          'dlndigul': 'Dindigul',
          'rameswaram': 'Rameswaram',
          'rarneswaram': 'Rameswaram',
          'kumbakonam': 'Kumbakonam',
          'kurnbakonam': 'Kumbakonam',
          'kumbkonarn': 'Kumbakonam',
          'thoothukudi': 'Thoothukudi',
          'tuticorin': 'Thoothukudi',
          'tuticorln': 'Thoothukudi',
          'kanyakumari': 'Kanyakumari',
          'kanyokumari': 'Kanyakumari',
          'conjakumari': 'Kanyakumari',
          'palani': 'Palani',
          'polani': 'Palani',
          'palonl': 'Palani',
          'nagapattinam': 'Nagapattinam',
          'nagapattinom': 'Nagapattinam',
          'nagapottlnam': 'Nagapattinam',
          'kodaikanal': 'Kodaikanal',
          'kodaikannal': 'Kodaikanal',
          'kodaikonol': 'Kodaikanal',
          
          // Common Tamil surnames and family names
          'iyer': 'Iyer',
          'lyer': 'Iyer', // OCR might confuse 'I' with 'l'
          'iyengar': 'Iyengar',
          'lyengar': 'Iyengar',
          'mudaliar': 'Mudaliar',
          'mudoliar': 'Mudaliar',
          'mutholiar': 'Mudaliar',
          'pillai': 'Pillai',
          'plllai': 'Pillai',
          'pilai': 'Pillai',
          'gounder': 'Gounder',
          'nadar': 'Nadar',
          'nodar': 'Nadar',
          'naidu': 'Naidu',
          'naldu': 'Naidu', // OCR confusion with 'i'
          'chettiar': 'Chettiar',
          'chettior': 'Chettiar',
          'thevar': 'Thevar',
          'thever': 'Thevar',
          'naicker': 'Naicker',
          'noicker': 'Naicker',
          'vandayar': 'Vandayar',
          'vondayar': 'Vandayar',
          
          // Common Tamil first names
          'suresh': 'Suresh',
          'ramesh': 'Ramesh',
          'rarnesh': 'Ramesh',
          'rajesh': 'Rajesh',
          'rajendran': 'Rajendran',
          'rojendran': 'Rajendran',
          'vijay': 'Vijay',
          'vijoy': 'Vijay',
          'vikram': 'Vikram',
          'vikrarn': 'Vikram',
          'kumar': 'Kumar',
          'kurnor': 'Kumar',
          'kumor': 'Kumar',
          'krishna': 'Krishna',
          'krishnan': 'Krishnan',
          'jayakumar': 'Jayakumar',
          'joyakumar': 'Jayakumar',
          'jayakurnor': 'Jayakumar',
          'murugan': 'Murugan',
          'murugun': 'Murugan',
          'murugon': 'Murugan',
          'anand': 'Anand',
          'anond': 'Anand',
          'anbu': 'Anbu',
          'selvam': 'Selvam',
          'selvom': 'Selvam',
          'balaji': 'Balaji',
          'bolaji': 'Balaji',
          'balojo': 'Balaji',
          'bala': 'Bala',
          'karthik': 'Karthik',
          'karthick': 'Karthik',
          'korthik': 'Karthik',
          'siva': 'Siva',
          'shiva': 'Shiva',
          'kalyan': 'Kalyan',
          'kalyon': 'Kalyan',
          'shankar': 'Shankar',
          'shankor': 'Shankar',
          'shankur': 'Shankar',
          'senthil': 'Senthil',
          'sentil': 'Senthil',
          'rajkumar': 'Rajkumar',
          'rajkumor': 'Rajkumar',
          'rajkurnar': 'Rajkumar',
          'saravanan': 'Saravanan',
          'saravanam': 'Saravanan',
          'sarovanan': 'Saravanan',
          'sriram': 'Sriram',
          'srirarn': 'Sriram',
          'mani': 'Mani',
          'moni': 'Mani',
          'ravi': 'Ravi',
          'rovi': 'Ravi',
          'sundar': 'Sundar',
          'sundor': 'Sundar',
          'arun': 'Arun',
          'arum': 'Arum',
          'arul': 'Arul',
          'ashok': 'Ashok',
          'ashoke': 'Ashok',
          'osok': 'Ashok',
          
          // Common Tamil feminine names
          'lakshmi': 'Lakshmi',
          'laxmi': 'Lakshmi',
          'lakshrni': 'Lakshmi',
          'meena': 'Meena',
          'meeno': 'Meena',
          'seetha': 'Seetha',
          'sita': 'Sita',
          'priya': 'Priya',
          'priyo': 'Priya',
          'kavitha': 'Kavitha',
          'kavita': 'Kavitha',
          'kavitho': 'Kavitha',
          'devi': 'Devi',
          'devl': 'Devi',
          'ammu': 'Ammu',
          'amrnu': 'Ammu',
          'kala': 'Kala',
          'kola': 'Kala',
          'kamala': 'Kamala',
          'kamola': 'Kamala',
          'gomathy': 'Gomathy',
          'gomathi': 'Gomathi',
          'gomathiammal': 'Gomathiammal',
          'gomathiarnmal': 'Gomathiammal',
          'revathi': 'Revathi',
          'revathirani': 'Revathirani',
          'ponnammal': 'Ponnammal',
          'ponnamrnol': 'Ponnammal',
          
          // Common OCR errors for frequent words
          'frorn': 'from',
          'frcm': 'from',
          'thls': 'this',
          'tnis': 'this',
          'tnat': 'that',
          'thot': 'that',
          'wlth': 'with',
          'witn': 'with',
          'tnere': 'there',
          'thcre': 'there',
          'tney': 'they',
          'tne': 'the',
          'obout': 'about',
          'aboot': 'about',
          'whot': 'what',
          'wnen': 'when',
          'corne': 'come',
          'cane': 'come',
          'sorne': 'some',
          'sane': 'some',
          'tirne': 'time',
          'tine': 'time',
          'lnto': 'into',
          'inte': 'into',
          'vvho': 'who',
          'wno': 'who',
          'wili': 'will',
          'wiil': 'will',
          'rnore': 'more',
          'nore': 'more',
          'between': 'between',
          'betvveen': 'between',
          'befcre': 'before',
          'betore': 'before',
          'becouse': 'because',
          'agoinst': 'against',
          'ogoinst': 'against'
        },
        
        // Check if word has a correction
        check: function(word: string): boolean {
          return this.corrections[word.toLowerCase()] !== undefined;
        },
        
        // Get the correction for a word
        suggest: function(word: string): string[] {
          const suggestion = this.corrections[word.toLowerCase()];
          return suggestion ? [suggestion] : [];
        }
      };
      
    } catch (error) {
    }
  }

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

        this.extractedResults.unshift(resultObj); // Add new result to the beginning
        this.textExtracted = text;

        // Save to history
        this.saveToHistory(resultObj);
      }
    } catch (error: any) {
    } finally {
      this.isProcessing = false;
    }
  }

  // Process an image file with Tesseract OCR
  async processImageWithTesseract(imageFile: File): Promise<string> {
    try {

      // For PDFs, first convert to an image using canvas rendering
      if (imageFile.type === 'application/pdf') {
        const text = await this.pdfReaderService.readPdf(imageFile);
        this.extractDetails(text, 'AADHAR');
        return text;
      }
      
      // For images, continue with the original image processing flow
      const imageUrl = URL.createObjectURL(imageFile);

      // Load image and convert to grayscale for better OCR performance
      const img = new Image();
      img.src = imageUrl;
      
      // Wait for image to load
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Create canvas for preprocessing
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }
      
      // Draw image to canvas for preprocessing
      ctx.drawImage(img, 0, 0);
      
      // Pre-process the image for better OCR results
      // Get image data for grayscale conversion
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Convert to grayscale
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg; // Red
        data[i + 1] = avg; // Green
        data[i + 2] = avg; // Blue
        // Alpha remains unchanged
      }
      
      // Put processed image data back
      ctx.putImageData(imageData, 0, 0);
      
      // Get the processed image as blob
      const processedImageBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(new Blob([]));
          }
        }, 'image/png');
      });

      // Recognize text from the processed image
      // Using proper Tesseract.js API
      const { data: { text } } = await this.worker.recognize(processedImageBlob);

      // IMPORTANT: Don't extract name here, we'll do it once in extractDetails
      // Let's just store the raw text
      this.textExtracted = text;
      console.log('Raw OCR text extracted:', text);
      return text;
    } catch (error: any) {
      throw new Error(`OCR processing failed: ${error.message}`);
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
        // Keep alpha channel as is
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
      const { data: { text } } = await this.worker.recognize(imageBlob);

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
      return 'PDF processing error: ' + (error.message || 'Unknown error');
    }
  }

  // Extract text from PDF using PDF.js
  private async extractTextFromPdfWithPdfjs(pdfFile: File): Promise<string> {
    // Removed PDF.js implementation
    return '';
  }

  // Extract name from OCR text
  private extractNameFromText(text: string, forceExtraction: boolean = false, cardType?: string) {
    console.log("==== EXTRACT NAME FROM TEXT STARTING (ENTRY POINT) ===");
    console.log(text);
    
    // If we already have a name and not forcing re-extraction, don't extract again
    if (this.nameExtracted && !forceExtraction) {
      return this.nameExtracted;
    }

    // Use provided cardType parameter or determine it from text if not provided
    const isAadhar = cardType ? cardType === 'AADHAR' : (text.includes('VID') || /\d{12}/.test(text.replace(/\s/g, '')));
    this.nameExtracted = isAadhar ? this.extractAadharName(text) : this.extractPanName(text);
    console.log('Extracted name:', this.nameExtracted);
    return this.nameExtracted;
  }

  // Extract name from Aadhar card text
  private extractAadharName(text: string): string {
    
    console.log('*** Raw text being processed for name extraction:');
    console.log(text);
    console.log('*** End of raw text');
    
    // SIMPLE LINE-BY-LINE APPROACH
    const relationshipIndicators = [
        'S/O', 'S/0', 'D/O', 'D/0', 'C/O', 'C/0', 'W/O', 'W/0', '5/O', '5/0', 'O/O', '0/0', '$/0', '$/O'
    ];
    
    // Split by lines and clean them
    const lines = text.split(/\n/).map(line => line.trim()).filter(line => line.length > 0);
    console.log('Text split into lines:', lines);
    
    // First pass: Look for relationship indicators to identify the name line
    for (let i = 0; i < lines.length; i++) {
      // Check if current line contains any relationship indicator
      const hasIndicator = relationshipIndicators.some(indicator => 
        lines[i].toUpperCase().includes(indicator));
      
      if (hasIndicator) {
        console.log('Found relationship indicator in line:', lines[i]);
        
        // Check if there's a line before this one that could be the name
        if (i > 0 && lines[i-1].length > 2) {
          // Make sure the previous line looks like a name (no numbers or indicators)
          if (!/\d|S\/O|D\/O|Father/i.test(lines[i-1])) {
            console.log('\n\n\n\n')
            console.log('Name found in line before relationship indicator:', lines[i-2]);
            console.log('\n\n\n\n')
            return lines[i-1];
          }
        }
        
        // If name not in previous line, check if the name is IN the current line before the indicator
        for (const indicator of relationshipIndicators) {
          const indexOfIndicator = lines[i].toUpperCase().indexOf(indicator);
          if (indexOfIndicator > 2) { // At least 2 chars for a name
            const namePart = lines[i].substring(0, indexOfIndicator).trim();
            console.log('Name found in same line as indicator:', namePart);
            return namePart;
          }
        }
      }
    }
    
    // Second pass: If no relationship indicator found, check first few lines for potential names
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      
      // If line is 2-4 words and only contains letters and spaces (likely a name)
      if (/^[A-Za-z][A-Za-z\s.]{2,25}$/.test(line) && 
          line.split(/\s+/).length >= 1 && 
          line.split(/\s+/).length <= 4) {
        console.log('Potential name found in line:', line);
        return line;
      }
    }
    
    // First check - any line followed by an empty line, followed by relationship indicator
    const emptyLinePattern = /([A-Za-z][A-Za-z .\-]{2,})\s*\n+\s*\n+\s*(C\/O|S\/O|S\/0|C\/0|D\.0|D\/O|W\/O|5\/0|5\/O)/i;
    const emptyLineMatch = text.match(emptyLinePattern);
    
    if (emptyLineMatch && emptyLineMatch[1]) {
      console.log('Found name with empty line before relationship:', emptyLineMatch[1]);
      return emptyLineMatch[1].trim();
    }
    
    // Second check for repeated name pattern
    const repeatedNamePattern = /([A-Za-z][A-Za-z .\-]{2,})\s*\n+\s*\1\s*\n+\s*(C\/O|S\/O|S\/0|C\/0|D\.0|D\/O|W\/O|5\/0|5\/O)/i;
    const repeatedMatch = text.match(repeatedNamePattern);

    if (repeatedMatch && repeatedMatch[1]) {
      console.log('Found repeated name with relationship pattern:', repeatedMatch[1]);
      return repeatedMatch[1].trim();
    }
    
    // Third, check for any name followed by relationship indicator on next line
    const nameOnSeparateLinePattern = /([A-Za-z][A-Za-z .\-]{2,})\s*\n+\s*(C\/O|S\/O|S\/0|C\/0|D\.0|D\/O|W\/O|5\/0|5\/O)/i;
    const separateLineMatch = text.match(nameOnSeparateLinePattern);
    
    if (separateLineMatch && separateLineMatch[1]) {
      console.log('Found name with relationship on separate line:', separateLineMatch[1]);
      return separateLineMatch[1].trim();
    }
    
    // As a last resort, try to find any capitalized sequence that might be a name
    const anyNamePattern = /([A-Z][a-z]+\s+[A-Z][a-z]*(?:\s+[A-Z][a-z]*)?)/;
    const anyNameMatch = text.match(anyNamePattern);
    
    if (anyNameMatch && anyNameMatch[1]) {
      console.log('Found potential name:', anyNameMatch[1]);
      return anyNameMatch[1].trim();
    }
    
    console.log('No name found with any patterns');
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
        /([A-Za-z][a-zA-Z .\-]{3,30})\s*[\r\n]+\s*(S\/O|D\/O|C\/O|F\/O|W\/O|s\/o|d\/o|c\/o|f\/o|w\/o)\s+([A-Za-z][A-Za-z .\-]{3,})/
      // Pattern 1: Name on a line followed by name on next line
      // /Name\s*\n+([A-Z][A-Z\s]+)(?=\s*\n)/i,

      // Pattern 2: After "Name:" with proper capitalization
      // /Name:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/i,

      // Pattern 3: First properly capitalized name after headers
      // /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/m,

      // Pattern 4: Name before Father's name
      // /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:S\/O|D\/O|Father)/i
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
        console.log('Extracted name:', name);
        return name;
      }
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
  extractDetails(ocrText: string, cardType: string): { Number: string; Name?: string; DOB?: string; Address?: string; Mobile?: string } {
    const result: { Number: string; Name?: string; DOB?: string; Address?: string; Mobile?: string } = {
      Number: ''
    };

    try {
      // First extract name from original text without preprocessing
      result.Name = this.extractNameFromText(ocrText, true, cardType);
      
      // Extract the appropriate card number based on card type (use raw text)
      const cardNumberRegex = this.cardTypes[cardType];
      const cardNumberMatch = ocrText.match(cardNumberRegex);

      if (cardNumberMatch) {
        result.Number = cardNumberMatch[0];
      } else {
        result.Number = 'Card number not found';
      }

      // Only for Aadhar cards - extract other details
      if (cardType === 'AADHAR') {
        // Extract DOB if present - use simple regex on raw text
        const dobRegex = /(d{2}[\/\-]\d{2}[\/\-]\d{4})/;
        const dobMatch = ocrText.match(dobRegex);
        if (dobMatch) {
          result.DOB = dobMatch[0];
        }

        // Extract mobile number directly from raw text
        result.Mobile = this.extractMobileNumber(ocrText);
        
        // Finally, extract address - this is the most resource-intensive task
        result.Address = this.extractAadharAddress(ocrText);
      }

      console.log('Extracted details:', result);
      return result;
    } catch (error) {
      return {
        Number: 'Error extracting details',
        Name: 'Error extracting details'
      };
    }
  }

  processAadharFiles(): void {
    this.processAllAadharFiles();
  }

  processAllAadharFiles(): void {
    if (this.aadharFiles.length === 0) {
      this.toastService.showWarning('No Aadhaar files to process');
      return;
    }
    
    this.isProcessing = true;
    this.toastService.showInfo(`Processing ${this.aadharFiles.length} Aadhaar file(s)...`);
    
    // Process files in batches to avoid overwhelming the browser
    const BATCH_SIZE = 3; // Process 3 files at a time
    this.processBatch(0, BATCH_SIZE);
  }
  
  // Process files in batches for better performance
  private processBatch(startIndex: number, batchSize: number): void {
    if (startIndex >= this.aadharFiles.length) {
      // All files processed
      this.isProcessing = false;
      this.toastService.showSuccess(`Successfully processed all ${this.aadharFiles.length} Aadhaar file(s)`);
      return;
    }
    
    const endIndex = Math.min(startIndex + batchSize, this.aadharFiles.length);
    const promises: Promise<void>[] = [];
    
    // Process current batch of files
    for (let i = startIndex; i < endIndex; i++) {
      const file = this.aadharFiles[i];
      const promise = this.processFileWithBothMethods(file, false);
      promises.push(promise);
    }
    
    // After all files in the batch are processed, move to the next batch
    Promise.all(promises).then(() => {
      const filesRemaining = this.aadharFiles.length - endIndex;
      if (filesRemaining > 0) {
        this.toastService.showInfo(`Processed ${endIndex} files. ${filesRemaining} remaining...`);
      }
      
      // Process the next batch
      this.processBatch(endIndex, batchSize);
    }).catch(error => {
      console.error('Error processing batch:', error);
      this.isProcessing = false;
      this.toastService.showError('Error processing files. Please try again.');
    });
  }

  // Process a file with both methods and combine results
  async processFileWithBothMethods(file: File, isLastFile: boolean): Promise<void> {
    try {
      console.log(`Processing file ${file.name} with both methods`);
      
      // Create object URL for the full image right away
      const fullImageUrl = URL.createObjectURL(file);
      
      // Step 1: Process with both methods simultaneously
      const [regionResult, fullDocResult] = await Promise.all([
        this.extractRegionData(file),
        this.extractFullDocumentData(file)
      ]);
      
      // Step 2: Copy relevant data from each method to create combined result
      const combinedResult = {
        fileName: file.name,
        cardType: 'AADHAR',
        number: fullDocResult.number || regionResult.number || '',  // Prefer full doc for number
        name: regionResult.name || fullDocResult.name || '',        // Prefer region for name
        dob: fullDocResult.dob || regionResult.dob || '',           // Prefer full doc for DOB
        address: regionResult.address || fullDocResult.address || '', // Prefer region for address
        mobile: regionResult.mobile || fullDocResult.mobile || '',   // Prefer region for mobile
        sourceUrl: fullImageUrl // Always use the full image URL
      };
      
      console.log('Combined result:', combinedResult);
      
      // Step 3: Check if we already have this Aadhaar number in our results
      if (combinedResult.number) {
        const existingIndex = this.extractedResults.findIndex(item => 
          item.cardType === 'AADHAR' && item.number === combinedResult.number
        );
        
        if (existingIndex >= 0) {
          // We found a duplicate - replace the existing entry with updated data
          console.log(`Found duplicate Aadhaar number ${combinedResult.number} - replacing existing entry`);
          
          // Release the old URL to prevent memory leaks
          if (this.extractedResults[existingIndex].sourceUrl) {
            URL.revokeObjectURL(this.extractedResults[existingIndex].sourceUrl);
          }
          
          // Replace the existing entry with the new one
          this.extractedResults[existingIndex] = combinedResult;
          this.toastService.showInfo(`Updated existing record for Aadhaar ${combinedResult.number}`);
          
          // Still save to history for tracking
          this.saveToHistory(combinedResult);
          return Promise.resolve();
        }
      }
      
      // Step 4: If no duplicate found, add to the results array
      this.extractedResults.unshift(combinedResult); // Add new result to the beginning
      
      // Step 5: Save to history
      this.saveToHistory(combinedResult);

      return Promise.resolve(); // Explicitly return resolved promise
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      return Promise.reject(error); // Return rejected promise on error
    }
  }
  
  // Extract data from the region (focused on name, address, mobile)
  async extractRegionData(file: File): Promise<any> {
    try {
      // Extract the specific region
      const { quarterImage, quarterImageBlob } = await this.extractFirstQuarter(file);
      
      // Process the region image with Tesseract
      const enhancedText = await this.processQuarterImageWithTesseract(quarterImageBlob);
      console.log('***** REGIONAL ENHANCED TEXT (LINE 2245) *****');
      console.log(enhancedText);
      console.log('***** END OF REGIONAL ENHANCED TEXT *****');
      
      // Get the raw text from the class variable
      const rawText = this.textExtracted;
      
      // Extract data
      this.nameExtracted = '';
      const name = this.extractNameFromText(rawText, true, 'AADHAR') || 'Name Not Found';
      console.log('Name extracted from region:', name);
      
      // Extract address from the regional enhanced text - FROM LINE 2245
      const address = this.extractAadharAddress(enhancedText);
      console.log('ADDRESS EXTRACTED FROM REGIONAL ENHANCED TEXT:', address);
      
      // Return data from region extraction
      return {
        name: name,
        number: this.extractAadharNumber(rawText),
        address: address,
        mobile: this.extractMobileNumber(enhancedText),
        dob: '',
        sourceUrl: quarterImage
      };
    } catch (error) {
      console.error('Error extracting region data:', error);
      return {};
    }
  }
  
  // Extract data from the full document (focused on DOB and Aadhaar number)
  async extractFullDocumentData(file: File): Promise<any> {
    try {
      // Process the full image with Tesseract
      const rawFullText = await this.processImageWithTesseract(file);
      console.log('Full document raw text extracted');
      
      // Apply NLP post-processing to the extracted text
      const enhancedFullText = this.applyNlpPostProcessing(rawFullText);
      console.log('Enhanced text after NLP processing for address extraction:', enhancedFullText);
      
      // 1. Extract Aadhaar number with enhanced pattern matching
      let aadharNumber = '';
      
      // Try various Aadhaar number formats
      const aadharPatterns = [
        /\d{4}\s\d{4}\s\d{4}/,           // Standard format: 1234 5678 9012
        /\d{4}\-\d{4}\-\d{4}/,           // Hyphenated: 1234-5678-9012
        /\d{12}/                         // No spaces: 123456789012
      ];
      
      for (const pattern of aadharPatterns) {
        const match = rawFullText.match(pattern);
        if (match) {
          aadharNumber = match[0];
          console.log('Found Aadhaar number in full document:', aadharNumber);
          break;
        }
      }
      
      // 2. Extract DOB with enhanced pattern matching
      let dob = '';
      
      // Try various date formats
      const dobPatterns = [
        /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,  // DD/MM/YYYY or DD-MM-YYYY
        /(\d{2}\s[A-Za-z]{3}\s\d{4})/,     // DD MMM YYYY (like 15 Jan 1990)
        /DOB\s*:?\s*([\d\/\-\s]+)/i,      // DOB: DD/MM/YYYY
        /Date of Birth\s*:?\s*([\d\/\-\s]+)/i // Date of Birth: DD/MM/YYYY
      ];
      
      for (const pattern of dobPatterns) {
        const match = enhancedFullText.match(pattern);
        if (match) {
          dob = match[1] || match[0];
          console.log('Found DOB in full document:', dob);
          break;
        }
      }
      
      // 3. Extract address from the enhanced text - specifically using the text logged at line 2245
      const address = this.extractAadharAddress(enhancedFullText);
      console.log('Address extracted from enhanced text:', address);
      
      // Return data from full document extraction
      return {
        number: aadharNumber || this.extractAadharNumber(rawFullText),
        dob: dob,
        name: this.extractAadharName(rawFullText),
        address: address, // Address from enhanced text after NLP
        mobile: this.extractMobileNumber(enhancedFullText),
        fullText: rawFullText
      };
    } catch (error) {
      console.error('Error extracting full document data:', error);
      return {};
    }
  }

  // Extract address from Aadhar card text
  private extractAadharAddress(text: string): string {
    if (!text) return '';
    
    try {
      // Log the text used for address extraction
      console.log('Text used for address extraction (BEFORE PROCESSING):', text);
      
      // Split into lines for better processing
      const lines = text.split(' ').map(line => line.trim()).filter(line => line.length > 0);
      console.log('Text split into lines:', lines);
      
      // First approach: Look for relationship indicators to identify the name line
      for (let i = 0; i < lines.length; i++) {
        // Check if current line contains relationship indicator
        if (/S\/O|D\/O|C\/O|W\/O|S\/0|D\/0|C\/0|W\/0|5\/O|5\/0|\$\/0|\$\/O/i.test(lines[i])) {
          console.log('Found relationship indicator in line:', lines[i]);
          
          // Begin capturing from this line (inclusive of relationship indicator)
          const addressLines = [];
          addressLines.push(lines[i]); // Include the relationship indicator line
          
          // Include following lines until we find a PIN code or reach the end
          let foundPinCode = false;
          for (let j = i + 1; j < lines.length; j++) {
            // Check if the line contains a 6-digit PIN code
            if (/\b\d{6}\b/.test(lines[j])) {
              addressLines.push(lines[j]); // Include the PIN code line
              foundPinCode = true;
              break; // Stop after finding PIN code
            }
            
            // Skip lines that look like DOB or Aadhaar number
            if (/\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}\s\d{4}\s\d{4}/.test(lines[j])) {
              continue;
            }
            
            addressLines.push(lines[j]);
          }
          
          // Clean and format the address
          const address = addressLines.join(', ');
          console.log('Complete address from relationship indicator to PIN code:', address);
          return address;
        }
      }
      
      // Ultimate fallback: Just return the middle portion of the text
      if (lines.length > 3) {
        const startIdx = Math.floor(lines.length / 3);
        const addressLines = lines.slice(startIdx, Math.min(startIdx + 3, lines.length));
        
        const address = addressLines.join(', ');
        console.log('Fallback address (middle lines):', address);
        return address;
      }
      
      // If all else fails
      console.log('Could not extract address with any approach');
      return 'Address not found';
    } catch (error) {
      console.error('Error extracting address:', error);
      return 'Error extracting address';
    }
  }

  // Extract mobile number from Aadhar card text
  extractMobileNumber(text: string): string {
    try {
      // Limit text size for performance
      const limitedText = text.length > 2000 ? text.substring(0, 2000) : text;
      
      // Standard 10-digit Indian mobile number
      const mobilePattern = /\b(\d{10})\b/;
      const match = limitedText.match(mobilePattern);

      if (match && match[1]) {
        return match[1];
      }
      
      // Simplified alternate pattern
      const altPattern = /(?:Mobile|Phone|Contact)\s*:?\s*(\d[\d\s-]{8,}\d)/i;
      const altMatch = limitedText.match(altPattern);

      if (altMatch && altMatch[1]) {
        // Clean up any spaces or dashes
        const cleanNumber = altMatch[1].replace(/[\s-]/g, '');
        if (cleanNumber.length === 10) {
          return cleanNumber;
        }
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  processPanFiles(): void {
    this.isProcessing = true;

    // Set a timeout to prevent hanging
    const timeoutId = setTimeout(() => {

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
            this.extractedResults.unshift({ // Add new result to the beginning
              fileName: panFile.name,
              cardType: 'PAN',
              number: details.Number,
              name: details.Name || this.nameExtracted || 'Not found',
              dob: details.DOB || '',
              address: details.Address || '',
              mobile: details.Mobile || '',
              pan: details.Number,
              sourceUrl: this.getObjectUrl(panFile)
            });
            this.textExtracted = text;

            // Save to history
            this.saveToHistory(this.extractedResults[0]);
          }
        });
        this.isProcessing = false;
      })
      .catch(error => {
        clearTimeout(timeoutId);
        console.error('Error processing files:', error);
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
      return;
    }

    // Create CSV content
    const headers = '"File Name","Card Type","Number","Name","DOB","Address","Mobile","PAN"\n';
    const rows = resultsToDownload.map(result =>
      `"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}","${result.address || ''}","${result.mobile || ''}","${result.pan || ''}"`
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
    if (target.files) {
      this.selectedCsvFile = target.files[0];
    } else {
      this.selectedCsvFile = null;
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
    } catch (error) {
      this.router.navigate(['/storage-select']);
    }
  }

  // Save extraction results directly to the selected file
  async saveToFile() {
    const fileHandle = this.fileHandleService.getFileHandle();
    
    if (!fileHandle) {
      this.toastService.showError('No file selected. Please select a file first.');
      return;
    }

    if (this.extractedResults.length === 0) {
      this.toastService.showWarning('No results to save. Please process documents first.');
      return;
    }

    try {
      // Get existing file content
      const file = await fileHandle.getFile();
      let existingContent = '';
      let existingAadharNumbers = new Map<string, number>(); // Explicitly typed Map
      let existingLines: string[] = []; // Explicitly define type as string array
      
      if (file.size > 0) {
        const reader = new FileReader();
        existingContent = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string || '');
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
        
        // Parse existing content to extract Aadhaar numbers and their line positions
        if (existingContent) {
          existingLines = existingContent.split('\n');
          const headers = existingLines[0].split(',');
          const numberIndex = headers.findIndex(h => h.includes('Number'));
          const cardTypeIndex = headers.findIndex(h => h.includes('Card Type'));
          
          if (numberIndex >= 0 && cardTypeIndex >= 0) {
            // Start from 1 to skip header row
            for (let i = 1; i < existingLines.length; i++) {
              if (!existingLines[i].trim()) continue; // Skip empty lines
              
              const values = this.parseCSVLine(existingLines[i]);
              if (values.length <= numberIndex || values.length <= cardTypeIndex) continue;
              
              // Only store Aadhaar numbers (not PAN)
              if (values[cardTypeIndex].includes('AADHAR')) {
                // Remove quotes if present
                const number = values[numberIndex].replace(/"/g, '');
                existingAadharNumbers.set(number, i); // Store line number with Aadhaar number
              }
            }
          }
        }
      }

      // Prepare content to write
      let contentToWrite = '';
      let updatedCount = 0;
      let newCount = 0;
      
      if (existingContent.length === 0) {
        // Empty file - add header and all results
        const headers = '"File Name","Card Type","Number","Name","DOB","Address","Mobile","PAN"\n';
        const newRows = this.extractedResults.map(result =>
          `"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}","${result.address || ''}","${result.mobile || ''}","${result.pan || ''}"`
        ).join('\n');
        contentToWrite = headers + newRows;
        newCount = this.extractedResults.length;
      } else {
        // File has content - check if it has headers
        const hasHeader = existingLines[0].includes('File Name,Card Type,Number');
        
        if (hasHeader) {
          // For each result, either update existing line or add new one
          for (const result of this.extractedResults) {
            if (result.cardType === 'AADHAR' && result.number && existingAadharNumbers.has(result.number)) {
              // Update existing line
              const lineIndex = existingAadharNumbers.get(result.number);
              if (lineIndex !== undefined) {
                existingLines[lineIndex] = `"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}","${result.address || ''}","${result.mobile || ''}","${result.pan || ''}"`;              
                updatedCount++;
              } else {
                // If somehow lineIndex is undefined, add as new line instead
                existingLines.push(`"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}","${result.address || ''}","${result.mobile || ''}","${result.pan || ''}"`);
                newCount++;
              }
            } else {
              // Add new line
              existingLines.push(`"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}","${result.address || ''}","${result.mobile || ''}","${result.pan || ''}"`);
              newCount++;
            }
          }
          contentToWrite = existingLines.join('\n');
        } else {
          // File has no headers, add headers first
          const headers = '"File Name","Card Type","Number","Name","DOB","Address","Mobile","PAN"\n';
          const newRows = this.extractedResults.map(result =>
            `"${result.fileName}","${result.cardType}","${result.number}","${result.name}","${result.dob || ''}","${result.address || ''}","${result.mobile || ''}","${result.pan || ''}"`
          ).join('\n');
          
          contentToWrite = headers + existingContent + 
            (existingContent.endsWith('\n') ? '' : '\n') + newRows;
          newCount = this.extractedResults.length;
        }
      }

      // Write to file
      const writable = await fileHandle.createWritable();
      await writable.write(contentToWrite);
      await writable.close();

      // Show success message with counts
      let message = ``;
      if (newCount > 0 && updatedCount > 0) {
        message = `Saved ${newCount} new record(s) and updated ${updatedCount} existing record(s) in ${file.name}`;
      } else if (newCount > 0) {
        message = `Saved ${newCount} new record(s) to ${file.name}`;
      } else if (updatedCount > 0) {
        message = `Updated ${updatedCount} existing record(s) in ${file.name}`;
      } else {
        message = `No changes made to ${file.name}`;
      }
      
      // Show success message
      this.toastService.showSuccess(message);
    } catch (error) {
      console.error('Error saving to file:', error);
      this.toastService.showError(`Failed to save results: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Helper method to properly parse CSV lines (handles quoted fields with commas)
  private parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current) {
      result.push(current);
    }
    
    return result;
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
      // Draw background
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add filename
      ctx.font = '14px Arial';
      ctx.fillStyle = '#333';
      ctx.fillText(pdfFile.name.length > 20 ? pdfFile.name.substring(0, 20) + '...' : pdfFile.name, 10, 60);
      
      // Create PDF logo/icon
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(canvas.width/2 - 30, canvas.height/2 - 30, 60, 80);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px Arial';
      ctx.fillText('PDF', canvas.width/2 - 25, canvas.height/2 + 10);
      
      return canvas.toDataURL('image/png');
    }
    return '';
  }

  // Release object URLs when component is destroyed
  ngOnDestroy() {
    try {
      // Release any URL generated for file previews
      this.extractedResults.forEach(result => {
        if (result.sourceUrl) {
          URL.revokeObjectURL(result.sourceUrl);
        }
      });
      
      // Release Tesseract worker if initialized
      if (this.worker) {
        this.worker.terminate();
      }
    } catch (error) {
      console.error('Error in ngOnDestroy:', error);
    }
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
    
    // First, calculate the aspect ratio of the original image
    const naturalRatio = target.naturalWidth / target.naturalHeight;
    const isLandscape = naturalRatio > 1;
    
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
      document.body.appendChild(this.zoomedElement);
    }
    
    // Set dimensions based on aspect ratio - maintain 300px for the smaller dimension
    let magWidth, magHeight;
    if (isLandscape) {
      // For landscape images
      magHeight = 300;
      magWidth = 300 * naturalRatio;
      // Cap width at 450px to avoid overly wide magnifiers
      magWidth = Math.min(magWidth, 450);
    } else {
      // For portrait images
      magWidth = 300;
      magHeight = 300 / naturalRatio;
      // Cap height at 450px to avoid overly tall magnifiers
      magHeight = Math.min(magHeight, 450);
    }
    
    // Update magnifier dimensions
    this.zoomedElement.style.width = `${magWidth}px`;
    this.zoomedElement.style.height = `${magHeight}px`;
    // Not using border-radius (circle) anymore since we have variable dimensions
    this.zoomedElement.style.borderRadius = '10px';

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
    
    // Scale image to fit magnifier with proper zooming
    const zoomFactor = 3;
    const zoomWidth = magWidth * zoomFactor;
    const zoomHeight = magHeight * zoomFactor;
    
    zoomedImg.style.width = `${zoomWidth}px`;
    zoomedImg.style.height = `${zoomHeight}px`;
    zoomedImg.style.objectFit = 'cover';
    zoomedImg.style.position = 'absolute';
    
    // Center the magnified area on cursor position
    const posX = -(percentX * zoomWidth - magWidth/2);
    const posY = -(percentY * zoomHeight - magHeight/2);
    
    zoomedImg.style.left = `${posX}px`;
    zoomedImg.style.top = `${posY}px`;
    
    // Clear previous content and add the new zoomed image
    this.zoomedElement.innerHTML = '';
    this.zoomedElement.appendChild(zoomedImg);
    
    // Position the zoomed element near the cursor
    this.zoomedElement.style.display = 'block';
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
    
    // Get magnifier dimensions
    const magWidth = parseInt(this.zoomedElement.style.width, 10);
    const magHeight = parseInt(this.zoomedElement.style.height, 10);
    
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
      // Get zoomed image dimensions
      const zoomWidth = parseInt(zoomedImg.style.width, 10);
      const zoomHeight = parseInt(zoomedImg.style.height, 10);
      
      // Center the magnified area on cursor position
      const posX = -(percentX * zoomWidth - magWidth/2);
      const posY = -(percentY * zoomHeight - magHeight/2);
      
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
    const zoomWidth = parseInt(this.zoomedElement.style.width, 10);
    const zoomHeight = parseInt(this.zoomedElement.style.height, 10);
    
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
      // Append new files to existing ones instead of replacing
      const newFiles = Array.from(input.files);
      this.aadharFiles = [...this.aadharFiles, ...newFiles];
      
      // Show notification about the number of files added
      if (newFiles.length > 0) {
        this.toastService.showInfo(`Added ${newFiles.length} Aadhaar file(s). Total: ${this.aadharFiles.length}`);
      }
    }
  }
  
  onPanFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      // Append new files to existing ones instead of replacing
      const newFiles = Array.from(input.files);
      this.panFiles = [...this.panFiles, ...newFiles];
      
      // Show notification about the number of files added
      if (newFiles.length > 0) {
        this.toastService.showInfo(`Added ${newFiles.length} PAN file(s). Total: ${this.panFiles.length}`);
      }
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

  // Apply NLP post-processing to the extracted text
  applyNlpPostProcessing(text: string): string {
    if (!text || text.trim().length === 0) {
      return text;
    }
    
    // Extract the name from the original raw text first
    if (!this.nameExtracted) {
      this.extractNameFromText(text, true, 'AADHAR');
    }

    // Store original text to compare later
    const originalText = text;
    let processedText = text;
    
    // Step 1: Basic text normalization (conservative)
    processedText = this.normalizeText(processedText);
    
    // Step 2: Correct common OCR errors for dates, numbers, etc.
    processedText = this.correctOcrErrors(processedText);
    
    // Step 3: Apply document-specific enhancements (Aadhaar/PAN specific fixes)
    processedText = this.enhanceDocumentSpecificText(processedText);
    
    // Step 4: Correct spelling while preserving Tamil words
    processedText = this.correctSpelling(processedText);
    
    // Step 5: Ensure we don't lose Tamil words in the process
    processedText = this.preserveTamilWords(processedText, originalText);
    
    return processedText;
  }
  
  // Normalize text by fixing spacing, line breaks, etc. - more conservative
  normalizeText(text: string): string {
    let normalized = text;
    
    // Replace multiple spaces with a single space
    normalized = normalized.replace(/\s{3,}/g, ' '); // Only fix 3+ spaces to be conservative
    
    // Add space after colon if missing
    normalized = normalized.replace(/:([^\s])/g, ': $1');
    
    // Fix common line break issues - only for numbers and Latin alphabet
    normalized = normalized.replace(/([a-zA-Z0-9])\n([a-zA-Z0-9])/g, '$1 $2');
    
    // Standardize Aadhaar spelling but preserve context
    normalized = normalized.replace(/\b(A[a]+d[h]+a[a]?r)\b/gi, 'Aadhaar');
    
    // Fix "Tamil Fads" and similar OCR errors for "Tamil Nadu"
    normalized = normalized.replace(/\bTamil\s+(Fads|fads|Fad|fad|Nads|nads|Ned|ned|Nod|nod)\b/g, 'Tamil Nadu');
    normalized = normalized.replace(/\bTamilnadu\b/g, 'Tamil Nadu');
    normalized = normalized.replace(/\bTamilnad\b/g, 'Tamil Nadu');
    normalized = normalized.replace(/\bTamil\s+Nadu\s+Government\b/gi, 'Government of Tamil Nadu');
    
    return normalized;
  }
  
  // Correct common OCR errors for dates, numbers, etc.
  correctOcrErrors(text: string): string {
    let corrected = text;
    
    // Fix number/letter confusions - only in clear number contexts
    corrected = corrected.replace(/\b([0-9]+)l([0-9]+)\b/g, '$11$2'); // l to 1 only between numbers
    corrected = corrected.replace(/\b([0-9]+)I([0-9]+)\b/g, '$11$2'); // I to 1 only between numbers
    corrected = corrected.replace(/\b([0-9]+)O([0-9]+)\b/g, '$10$2'); // O to 0 only between numbers
    corrected = corrected.replace(/\b([0-9]+)S([0-9]+)\b/g, '$15$2'); // S to 5 only between numbers
    
    // Fix entire Aadhaar number if it follows the pattern
    const aadhaarPattern = /\b([0-9lIO]{4})\s*([0-9lIO]{4})\s*([0-9lIO]{4})\b/g;
    corrected = corrected.replace(aadhaarPattern, (match, p1, p2, p3) => {
      // Replace common OCR mistakes in Aadhaar numbers
      p1 = p1.replace(/l|I/g, '1').replace(/O/g, '0');
      p2 = p2.replace(/l|I/g, '1').replace(/O/g, '0');
      p3 = p3.replace(/l|I/g, '1').replace(/O/g, '0');
      
      return `${p1} ${p2} ${p3}`;
    });
    
    return corrected;
  }
  
  // Check for potential Tamil words and preserve them
  preserveTamilWords(processedText: string, originalText: string): string {
    // Common Tamil name suffixes and patterns in transliteration
    const tamilPatterns = [
      // Common Tamil name suffixes
      /\b\w+(an|raj|appa|amma|akka|devi|nathan|ini|ammal|swamy|murthy|arasu|selvan|velu|kannan|thangam|raman|samy)\b/i,
      // Common Tamil place name patterns
      /\b\w+(puram|nagar|palayam|kuppam|theru|valasai|vadi|kottai|patti|ur|kulam|pattu|nadu)\b/i,
      // Common Tamil words in addresses
      /\b(thiru|tmt|selvi|veedu|colony|district|taluk|post|village)\b/i
    ];
    
    // Function to check if a word might be Tamil transliterated
    const mightBeTamilWord = (word: string): boolean => {
      // Check against known Tamil patterns
      for (const pattern of tamilPatterns) {
        if (pattern.test(word)) {
          return true;
        }
      }
      
      // Tamil transliteration often has certain character combinations
      const tamilCharCombos = ['th', 'zh', 'aa', 'ee', 'oo', 'kk', 'pp', 'tt', 'nn', 'mm', 'll'];
      for (const combo of tamilCharCombos) {
        if (word.toLowerCase().includes(combo)) {
          return true;
        }
      }
      
      return false;
    };
    
    // Split into words and analyze/preserve potential Tamil words
    const processedWords = processedText.split(/\s+/);
    const originalWords = originalText.split(/\s+/);
    
    // If word counts differ dramatically, just return processed text
    // as our word-by-word matching would be unreliable
    if (Math.abs(processedWords.length - originalWords.length) > 5) {
      return processedText;
    }
    
    // For each word in processed text
    for (let i = 0; i < processedWords.length; i++) {
      // Try to find corresponding word in original text
      // (allowing for slight position shifts)
      for (let j = Math.max(0, i-2); j <= Math.min(originalWords.length-1, i+2); j++) {
        // If processed word is similar to original word but not identical
        if (processedWords[i].length > 3 && 
            processedWords[i] !== originalWords[j] && 
            this.stringSimilarity(processedWords[i], originalWords[j]) > 0.7) {
          
          // Check if original might be Tamil transliterated
          if (mightBeTamilWord(originalWords[j])) {
            console.log(`Preserving potential Tamil word: ${originalWords[j]} instead of ${processedWords[i]}`);
            processedWords[i] = originalWords[j];
            break;
          }
        }
      }
    }
    
    // Join the tokens back together
    return processedWords.join(' ');
  }
  
  // Calculate string similarity (Levenshtein distance based)
  stringSimilarity(s1: string, s2: string): number {
    const longer = s1.length >= s2.length ? s1 : s2;
    const shorter = s1.length >= s2.length ? s2 : s1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    // Calculate edit distance
    const editDistance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - editDistance) / longer.length;
  }
  
  // Calculate Levenshtein distance between two strings
  levenshteinDistance(s1: string, s2: string): number {
    let costs = new Array(s2.length + 1);
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) {
        costs[s2.length] = lastValue;
      }
    }
    return costs[s2.length];
  }
  
  // Enhance document-specific text patterns with Tamil support
  enhanceDocumentSpecificText(text: string): string {
    let enhanced = text;
    
    // Process for Aadhaar-specific improvements
    if (text.includes('Aadhaar') || text.includes('AADHAAR') || text.includes('UID')) {
      console.log('Detected Aadhaar card, starting name extraction...');
      
      // Reset the name for this extraction
      this.nameExtracted = '';
      
      // Pre-process the text: split into lines and remove any that contain government text
      const lines = text.split(/\r?\n/);
      const filteredLines = lines.filter(line => {
        // Skip any line containing these keywords
        return !line.toLowerCase().includes('government') && 
               !line.toLowerCase().includes('india') &&
               !line.toLowerCase().includes('authority') &&
               !line.toLowerCase().includes('aadhaar') &&
               !line.toLowerCase().includes('uidai');
      });
      
      // Rejoin the filtered lines
      const cleanedText = filteredLines.join('\n');
      console.log('Cleaned text (removed government lines):', cleanedText);
      
      // Use a single comprehensive regex to find names in the common format:
      // Real NAME appears above a relationship indicator (S/O, D/O, etc.)
      const nameRelationshipPattern = /([A-Za-z][A-Za-z\s.]{2,25})\s*[\r\n]+\s*(S\/O|D\/O|C\/O|F\/O|W\/O|s\/o|d\/o|c\/o|f\/o|w\/o)\s+([A-Za-z][A-Za-z .\-]{3,})/
      const nameRelationshipMatch = cleanedText.match(nameRelationshipPattern);

      if (nameRelationshipMatch && nameRelationshipMatch[1]) {
        // Store the extracted name in a class variable for later use
        this.nameExtracted = this.cleanName(nameRelationshipMatch[1]);
        console.log('Name extracted:', this.nameExtracted);
      }
      
      // Try fallback if still no name found
      if (!this.nameExtracted) {
        // Try to find a line that begins with "To" 
        const toPattern = /To\s+([A-Za-z][A-Za-z\s.]{2,25})/i;
        const toMatch = cleanedText.match(toPattern);

        if (toMatch && toMatch[1]) {
          this.nameExtracted = this.cleanName(toMatch[1]);
          console.log('Name extracted from To pattern:', this.nameExtracted);
        }
      }
      
      // Log debugging info if no name found
      if (!this.nameExtracted) {
        console.log('Could not extract name. Full text:', text);
      }
      
      // Extract DOB with improved pattern matching
      const dobPatterns = [
        /DOB\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
        /Date of Birth\s*:?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i
      ];
      
      for (const pattern of dobPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          enhanced = enhanced.replace(match[0], match[0].replace(match[1], this.formatDate(match[1])));
          break;
        }
      }
    }
    
    return enhanced;
  }

  // Check if text is likely a common header or non-name text
  isCommonHeader(text: string): boolean {
    if (!text) return true;
    
    const lowerText = text.toLowerCase();
    
    // List of keywords that indicate this is not a person's name
    const headerKeywords = [
      'government', 'india', 'authority', 'aadhaar', 'uidai', 'unique', 'identification',
      'enrolment', 'no', 'department', 'ministry', 'certificate', 'card', 'income', 'tax',
      'permanent', 'account', 'number', 'pan', 'verify', 'signature', 'officer', 'issued'
    ];
    
    // Check if any of the header keywords are present
    for (const keyword of headerKeywords) {
      if (lowerText.includes(keyword)) {
        return true;
      }
    }
    
    // Check if text contains too many uppercase letters (like government headers)
    // Count uppercase ratio
    let uppercaseCount = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === text[i].toUpperCase() && text[i].match(/[A-Z]/)) {
        uppercaseCount++;
      }
    }
    
    // If more than 30% of letters are uppercase, it's likely a header
    if (text.length > 0 && (uppercaseCount / text.length) > 0.3) {
      return true;
    }
    
    // Check if text has multiple words and is very long (typical for headers)
    if (text.split(/\s+/).length > 5) {
      return true;
    }
    
    // Likely a real name
    return false;
  }

  // Clean and format extracted name
  cleanName(name: string): string {
    if (!name) return '';
    
    // Log original name before cleaning
    console.log('Original name before cleaning:', name);
    
    // Remove any trailing relationship indicators that might have been caught
    name = name.replace(/(S\/O|D\/O|C\/O|F\/O|W\/O|s\/o|d\/o|c\/o|f\/o|w\/o).*$/, '');
    
    // Remove any extra identifiers like "Mr." "Mrs." etc.
    name = name.replace(/^\s*(Mr\.|Mrs\.|Ms\.|Dr\.|Shri|Smt|Sri|Shrimati)\s+/i, '');
    
    // Remove any numbers or special characters except spaces and hyphens
    name = name.replace(/[^a-zA-Z \-\.]/g, '');
    
    // Remove extra spaces and trim
    name = name.replace(/\s+/g, ' ');
    
    // Proper case all parts of the name (for consistency)
    name = name.split(' ').map(part => {
      if (part.length <= 1) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join(' ');
    
    console.log('Final cleaned name:', name);
    return name;
  }

  // Format date consistently
  formatDate(dateStr: string): string {
    // Convert various date formats to DD/MM/YYYY
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      // Assume DD/MM/YYYY format for Aadhaar
      return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
    }
    return dateStr; // Return as is if we can't parse it
  }

  // Correct spelling using our custom spell checker
  correctSpelling(text: string): string {
    if (!this.spellChecker) return text;
    
    // Split the text by spaces and other punctuation but keep the separators
    const tokens = text.split(/(\s|[\.,;:\?!\-"'()])/g).filter(token => token !== '');
    
    // Process each token
    const correctedTokens = tokens.map(token => {
      // Skip checking separators, numbers, short words, and potential Tamil words
      if (/[\s\.,;:\?!\-"'()]/.test(token) || // Is a separator
          /\d/.test(token) || // Contains numbers
          token.length < 4 || // Too short
          this.mightBeTamilWord(token) || // Might be Tamil
          /^[A-Z]+$/.test(token)) { // All uppercase (likely an abbreviation)
        return token;
      }
      
      // Check if the word has a correction
      const lcToken = token.toLowerCase();
      if (this.spellChecker.check(lcToken)) {
        const suggestions = this.spellChecker.suggest(lcToken);
        
        if (suggestions.length > 0) {
          const correction = suggestions[0];
          console.log(`Spell correction: ${token} → ${correction}`);
          
          // Preserve original capitalization if first letter is uppercase
          if (/^[A-Z]/.test(token)) {
            return correction.charAt(0).toUpperCase() + correction.slice(1);
          }
          return correction;
        }
      }
      return token;
    });
    
    // Join the tokens back together
    return correctedTokens.join('');
  }

  // Check if a word might be Tamil transliterated (enhanced method)
  mightBeTamilWord(word: string): boolean {
    // Common Tamil name suffixes and patterns in transliteration
    const tamilPatterns = [
      // Common Tamil name suffixes
      /\b\w+(an|raj|appa|amma|akka|devi|nathan|ini|ammal|swamy|murthy|arasu|selvan|velu|kannan|thangam|raman|samy)\b/i,
      // Common Tamil place name patterns
      /\b\w+(puram|nagar|palayam|kuppam|theru|valasai|vadi|kottai|patti|ur|kulam|pattu|nadu)\b/i,
      // Common Tamil words in addresses
      /\b(thiru|tmt|selvi|veedu|colony|district|taluk|post|village)\b/i
    ];
    
    // Check against known Tamil patterns
    for (const pattern of tamilPatterns) {
      if (pattern.test(word)) {
        return true;
      }
    }
    
    // Tamil transliteration often has certain character combinations
    const tamilCharCombos = ['th', 'zh', 'aa', 'ee', 'oo', 'kk', 'pp', 'tt', 'nn', 'mm', 'll'];
    for (const combo of tamilCharCombos) {
      if (word.toLowerCase().includes(combo)) {
        return true;
      }
    }
    
    // Additional check for Tamil names that might not fit the above patterns
    if (/^[A-Z][a-z]+[A-Z][a-z]*(?:\s+[A-Z][a-z]*)?/.test(word)) { // CamelCase names are often Tamil
      return true;
    }
    
    return false;
  }
  
  // Template matching method - extracts region using percentage-based measurements
  async extractFirstQuarter(imageFile: File): Promise<{
    quarterImage: string; 
    quarterImageBlob: Blob; 
    width: number; 
    height: number; 
    boundaries: {left: number; right: number; top: number; bottom: number}
  }> {
    return new Promise((resolve, reject) => {
      try {
        // Create an image element to load the file
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);
        
        img.onload = () => {
          // Release the object URL
          URL.revokeObjectURL(objectUrl);
          
          // Get dimensions of full image
          const fullWidth = img.width;
          const fullHeight = img.height;
          
          // Step 1: Detect and remove padding/margins from the image
          // Create canvas for the entire image
          const fullCanvas = document.createElement('canvas');
          fullCanvas.width = fullWidth;
          fullCanvas.height = fullHeight;

          const fullCtx = fullCanvas.getContext('2d');
          if (!fullCtx) {
            reject(new Error('Could not get canvas context for full image'));
            return;
          }
          
          // Draw the full image
          fullCtx.drawImage(img, 0, 0);
          
          // Get image data to analyze margins
          const imageData = fullCtx.getImageData(0, 0, fullWidth, fullHeight);
          const data = imageData.data;

          // Find the boundaries of actual content (non-white areas)
          let minX = fullWidth;
          let minY = fullHeight;
          let maxX = 0;
          let maxY = 0;
          
          // Threshold for detecting content (non-white pixels)
          const threshold = 230; // Slightly below pure white
          
          // Scan the image to find content boundaries
          for (let y = 0; y < fullHeight; y++) {
            for (let x = 0; x < fullWidth; x++) {
              const idx = (y * fullWidth + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              
              // Calculate brightness
              const brightness = (r + g + b) / 3;
              
              // If pixel is not white/light (it's content)
              if (brightness < threshold) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
              }
            }
          }
          
          // Add a small buffer around content area (5% of dimensions)
          const bufferX = Math.round(fullWidth * 0.05);
          const bufferY = Math.round(fullHeight * 0.05);
          
          minX = Math.max(0, minX - bufferX);
          minY = Math.max(0, minY - bufferY);
          maxX = Math.min(fullWidth, maxX + bufferX);
          maxY = Math.min(fullHeight, maxY + bufferY);
          
          // Calculate content dimensions
          const contentWidth = maxX - minX;
          const contentHeight = maxY - minY;
          
          console.log('Content area detected:', { minX, minY, maxX, maxY, contentWidth, contentHeight });
          
          // Step 2: Use percentage-based calculations for the region of interest
          // Calculate region boundaries based on percentages of the content area
          const regionLeft = minX + Math.round(contentWidth * 0.05);  // 5% from left edge
          const regionTop = minY + Math.round(contentHeight * 0.08);  // 8% from top edge
          const regionWidth = Math.round(contentWidth * 0.40);        // 40% of content width
          const regionHeight = Math.round(contentHeight * 0.40);      // 40% of content height
          
          // Ensure we don't exceed boundaries
          const regionRight = Math.min(regionLeft + regionWidth, maxX);
          const regionBottom = Math.min(regionTop + regionHeight, maxY);
          
          // Recalculate actual width and height
          const finalRegionWidth = regionRight - regionLeft;
          const finalRegionHeight = regionBottom - regionTop;
          
          // Validate that we have a valid region to extract
          if (finalRegionWidth <= 0 || finalRegionHeight <= 0) {
            reject(new Error('Invalid region dimensions after content detection.'));
            return;
          }
          
          // Log all dimensions for analysis
          console.log('Region extraction with percentages:', {
            fullWidth,
            fullHeight,
            contentWidth,
            contentHeight,
            regionLeft,
            regionTop,
            regionWidth: finalRegionWidth,
            regionHeight: finalRegionHeight,
            percentages: {
              left: '5%',
              top: '8%',
              width: '40%',
              height: '40%'
            }
          });
          
          // Create a canvas for the final region
          const regionCanvas = document.createElement('canvas');
          regionCanvas.width = finalRegionWidth;
          regionCanvas.height = finalRegionHeight;
          
          // Draw only the specified region
          const regionCtx = regionCanvas.getContext('2d');
          if (!regionCtx) {
            reject(new Error('Could not get canvas context for region'));
            return;
          }
          
          // Draw the region directly from the original image
          regionCtx.drawImage(
            img,
            regionLeft, regionTop, finalRegionWidth, finalRegionHeight,  // Source coordinates
            0, 0, finalRegionWidth, finalRegionHeight                   // Destination coordinates
          );
          
          // Store boundaries relative to the original image
          const boundaries = { 
            left: regionLeft, 
            right: regionRight, 
            top: regionTop, 
            bottom: regionBottom 
          };
          
          // Convert to data URL and Blob for OCR processing
          const regionImageUrl = regionCanvas.toDataURL('image/jpeg');
          
          // Convert canvas to blob for OCR processing
          regionCanvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to convert canvas to blob'));
              return;
            }
            
            // Return the region image and its dimensions
            resolve({
              quarterImage: regionImageUrl,
              quarterImageBlob: blob, 
              width: finalRegionWidth,
              height: finalRegionHeight,
              boundaries
            });
          }, 'image/jpeg', 0.95);
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load image'));
        };
        
        // Set the source to load the image
        img.src = objectUrl;
      } catch (error) {
        reject(error);
      }
    });
  }

  // Process quarter image with Tesseract
  async processQuarterImageWithTesseract(imageBlob: Blob): Promise<string> {
    try {
      // Create a dummy file object from the blob
      const quarterFile = new File([imageBlob], 'quarter.jpg', { type: 'image/jpeg' });
      
      // Give UI thread a chance to breathe
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const preprocessStart = performance.now();
      const preprocessedBlob = await this.preprocessImage(quarterFile);
      const preprocessedFile = new File([preprocessedBlob], 'quarter_preprocessed.jpg', { type: 'image/jpeg' });
      
      // Give UI thread a chance to breathe
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const tesseractStart = performance.now();
      const rawText = await this.processImageWithTesseract(preprocessedFile);

      // Give UI thread a chance to breathe
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const nlpStart = performance.now();
      const enhancedText = this.applyNlpPostProcessing(rawText);
      console.log('Enhanced text after NLP:', enhancedText);
      
      return enhancedText;
    } catch (error: any) {
      console.error('Error processing quarter image with Tesseract:', error);
      throw error;
    }
  }

  // Preprocess image for better text recognition
  async preprocessImage(imageFile: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(imageFile);
        
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          
          // Downsample large images to improve performance
          // Most OCR doesn't need super high resolution
          const MAX_DIMENSION = 1500; // Maximum width or height
          let targetWidth = img.width;
          let targetHeight = img.height;
          
          // Calculate new dimensions if the image is too large
          if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
            if (img.width > img.height) {
              targetWidth = MAX_DIMENSION;
              targetHeight = Math.floor(img.height * (MAX_DIMENSION / img.width));
            } else {
              targetHeight = MAX_DIMENSION;
              targetWidth = Math.floor(img.width * (MAX_DIMENSION / img.height));
            }
          }
          
          // Create canvas for preprocessing with potentially reduced dimensions
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Draw original image to canvas with potential resizing
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          
          // Get image data for processing
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Optimized single-pass image processing
          // This reduces processing time by combining operations
          const threshold = 150;
          
          for (let i = 0; i < data.length; i += 4) {
            // Step 1: Convert to grayscale
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            
            // Step 2: Apply simple thresholding (faster than contrast enhancement)
            const val = avg > threshold ? 255 : 0;
            
            // Step 3: Set pixel values
            data[i] = val;     // red
            data[i + 1] = val; // green
            data[i + 2] = val; // blue
            
            // Step 4: Optimize alpha channel
            data[i + 3] = val === 0 ? 255 : 220; // Fully opaque for text, semi-transparent for background
          }
          
          // Put processed image data back on canvas
          ctx.putImageData(imageData, 0, 0);
          
          // Convert to blob with reasonable quality (0.8 is a good balance)
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to convert preprocessed image to blob'));
              return;
            }
            resolve(blob);
          }, 'image/jpeg', 0.8); // Reduced quality for better performance
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load image for preprocessing'));
        };
        
        // Set the source to load the image
        img.src = objectUrl;
      } catch (error) {
        reject(error);
      }
    });
  }

  // Method to perform template matching on an image
  async performTemplateMatching(imageFile: File): Promise<void> {
    try {
      // Extract the specific region
      const { quarterImage, quarterImageBlob, width, height, boundaries } = await this.extractFirstQuarter(imageFile);
      
      // Process the region image with Tesseract to get both raw and enhanced text
      const enhancedText = await this.processQuarterImageWithTesseract(quarterImageBlob);
      
      // Get the raw text from the class variable which is set in the processImageWithTesseract method
      const rawText = this.textExtracted;
      
      // Extract name from the raw OCR text
      this.nameExtracted = '';
      this.extractNameFromText(rawText, true, 'AADHAR'); 
      console.log('Name extracted from raw text:', this.nameExtracted);
      
      // Extract other details from the enhanced text
      const details = {
        Number: '',
        Name: this.nameExtracted || 'Name Not Found',
        DOB: '',
        Address: '',
        Mobile: ''
      };
      
      // Extract Aadhar number with enhanced pattern matching
      let aadharNumber = '';
      
      // Try various Aadhaar number formats
      const aadharPatterns = [
        /\d{4}\s\d{4}\s\d{4}/,           // Standard format: 1234 5678 9012
        /\d{4}\-\d{4}\-\d{4}/,           // Hyphenated: 1234-5678-9012
        /\d{12}/                         // No spaces: 123456789012
      ];
      
      for (const pattern of aadharPatterns) {
        const match = rawText.match(pattern);
        if (match) {
          aadharNumber = match[0];
          console.log('Found Aadhar number in full document:', aadharNumber);
          break;
        }
      }
      
      // Extract DOB, Address, and Mobile from enhanced text (which has better formatting)
      if (enhancedText) {
        // Extract DOB if present
        const dobRegex = /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/;
        const dobMatch = enhancedText.match(dobRegex);
        if (dobMatch) {
          details.DOB = dobMatch[0];
        }

        // Extract address from enhanced text
        details.Address = this.extractAadharAddress(enhancedText);

        // Extract mobile number from enhanced text
        details.Mobile = this.extractMobileNumber(enhancedText);
      }
      
      console.log('Extracted details:', details);
      
      // Create a result object focused on Aadhar number and DOB
      const fullDocResult = {
        fileName: `${imageFile.name}-full`,
        cardType: 'AADHAR',
        number: aadharNumber || this.extractAadharNumber(rawText),
        name: details.Name,
        dob: details.DOB,
        address: details.Address,
        mobile: details.Mobile,
        sourceUrl: URL.createObjectURL(imageFile),
        fullText: rawText  // Store the full document text
      };
      
      console.log('Full document extraction result:', fullDocResult);
      
      // Add the full document result to the extracted results
      this.extractedResults.unshift(fullDocResult); // Add new result to the beginning
      
      // Save to history
      this.saveToHistory(fullDocResult);
    } catch (error: any) {
      console.error('Error in template matching:', error);
    }
  }
  
  // Trigger template matching on the first Aadhar card
  async performTemplateMatchingOnFirstAadhar(): Promise<void> {
    this.isProcessing = true;
    if (this.aadharFiles.length > 0) {
      try {
        // Use the new parallel processing approach for better results
        this.processAllAadharFiles();
      } catch (error) {
        console.error('Error performing template matching on first Aadhar:', error);
        this.isProcessing = false;
      }
    } else {
      console.error('No Aadhar files to process');
      this.isProcessing = false;
    }
  }
}

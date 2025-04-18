import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

@Injectable({
  providedIn: 'root'
})
export class PdfReaderService {
  constructor() {
    // Use absolute path for production compatibility
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdfjs-dist/build/pdf.worker.mjs';
  }

  public async readPdf(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const countPromises = []; // collecting all page promises
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      countPromises.push(textContent.items.map((s: any) => s.str).join(' '));
    }
    const pageContents = await Promise.all(countPromises);
    return pageContents.join('');
  }
}

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Extraction {
  documentType: 'aadhaar' | 'pan';
  name: string;
  number: string;
  dob?: string;
  address?: string;
  mobile?: string;
  fileName: string;
  timestamp: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
  extractions: Extraction[] = [];
  loading = true;
  error = '';

  constructor() {}

  ngOnInit() {
    this.loadExtractions();
  }

  loadExtractions() {
    this.loading = true;
    try {
      // Get extractions from local storage
      const storedData = localStorage.getItem('extractionHistory');
      if (storedData) {
        this.extractions = JSON.parse(storedData);
      }
      this.loading = false;
    } catch (error) {
      console.error('Error loading extractions from local storage:', error);
      this.error = 'Failed to load history. Please try again later.';
      this.loading = false;
    }
  }

  downloadCSV() {
    if (this.extractions.length === 0) {
      alert('No data to download');
      return;
    }
    
    // Create CSV content
    const headers = '"File Name","Card Type","Number","Name","DOB","Address","Mobile","PAN","Timestamp"\n';
    const rows = this.extractions.map(extraction =>
      `"${extraction.fileName}","${extraction.documentType}","${extraction.number}","${extraction.name}","${extraction.dob || ''}","${extraction.address || ''}","${extraction.mobile || ''}","${extraction.number}","${extraction.timestamp}"`
    ).join('\n');
    const csvContent = 'data:text/csv;charset=utf-8,' + headers + rows;

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'extraction_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  deleteExtraction(index: number) {
    this.extractions.splice(index, 1);
    localStorage.setItem('extractionHistory', JSON.stringify(this.extractions));
  }

  clearHistory() {
    if (confirm('Are you sure you want to clear all history?')) {
      this.extractions = [];
      localStorage.removeItem('extractionHistory');
    }
  }
}

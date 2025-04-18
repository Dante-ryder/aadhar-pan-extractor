import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FileHandleService } from '../services/file-handle.service';

@Component({
  selector: 'app-storage-select',
  imports: [CommonModule],
  template: `
    <div class="container mt-5">
      <div class="row justify-content-center">
        <div class="col-md-6 text-center">
          <h2 class="mb-4">Select Storage Location</h2>
          
          <div class="mb-3">
            <button class="btn btn-primary me-3" (click)="selectDirectory()">Select Directory</button>
            <button class="btn btn-primary" (click)="selectFile()">Select Existing CSV</button>
          </div>

          <div *ngIf="error" class="alert alert-danger mt-3">
            {{ error }}
          </div>
        </div>
      </div>
    </div>
  `
})
export class StorageSelectComponent {
  error = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private fileHandleService: FileHandleService
  ) {}

  async selectDirectory() {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const csvHandle = await dirHandle.getFileHandle('extractions.csv', { create: true });
      const writable = await csvHandle.createWritable();
      
      // Write CSV header if file is empty
      const file = await csvHandle.getFile();
      if (file.size === 0) {
        await writable.write('"File Name","Card Type","Number","Name","DOB","Address","Mobile","PAN"\n');
      }
      await writable.close();

      // Store the directory handle in our service
      this.fileHandleService.setDirectoryHandle(dirHandle);
      this.fileHandleService.setFileHandle(csvHandle);

      // Store metadata in localStorage for persistence between sessions
      localStorage.setItem('csvDirHandle', JSON.stringify({
        path: dirHandle.name,
        type: 'directory'
      }));

      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error selecting directory:', error);
      this.error = 'Failed to select directory. Please try again.';
    }
  }

  async selectFile() {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'CSV Files',
          accept: {
            'text/csv': ['.csv']
          }
        }]
      });

      // Store the file handle in our service
      this.fileHandleService.setFileHandle(fileHandle);

      // Store metadata in localStorage for persistence between sessions
      localStorage.setItem('csvDirHandle', JSON.stringify({
        path: fileHandle.name,
        type: 'file'
      }));

      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error selecting file:', error);
      this.error = 'Failed to select file. Please try again.';
    }
  }
}

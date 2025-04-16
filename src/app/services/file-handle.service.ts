import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FileHandleService {
  private fileHandle: any = null;
  private dirHandle: any = null;
  private csvFileName: string = 'extractions.csv';
  
  constructor() {}
  
  setFileHandle(handle: any) {
    this.fileHandle = handle;
    if (handle) {
      this.csvFileName = handle.name;
    }
  }
  
  setDirectoryHandle(handle: any) {
    this.dirHandle = handle;
  }
  
  getFileHandle() {
    return this.fileHandle;
  }
  
  getDirectoryHandle() {
    return this.dirHandle;
  }
  
  getFileName() {
    return this.csvFileName;
  }
  
  hasValidHandle() {
    return this.fileHandle !== null;
  }
  
  clearHandles() {
    this.fileHandle = null;
    this.dirHandle = null;
  }
}

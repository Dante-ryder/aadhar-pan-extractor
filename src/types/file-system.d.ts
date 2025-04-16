declare interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
}

declare interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
}

declare interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory';
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
}

declare interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

declare interface Window {
  showOpenFilePicker(options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<FileSystemFileHandle[]>;
  
  showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
}

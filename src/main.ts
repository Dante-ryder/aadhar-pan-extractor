import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
// This is a simpler approach than using webpack plugins
// The worker will be included in the build automatically
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

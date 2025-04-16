declare module 'opencv.js' {
  export = cv;
}

declare namespace cv {
  // Add basic type definitions; for full types, use @types/opencv4nodejs or create a custom declaration
  export function matFromImageData(imageData: ImageData): any;
  export function cvtColor(src: any, dst: any, code: number, dstCn?: number): void;
  export function GaussianBlur(src: any, dst: any, ksize: any, sigmaX: number, sigmaY?: number, borderType?: number): void;
  export function adaptiveThreshold(src: any, dst: any, maxValue: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number): void;
  export function getStructuringElement(shape: number, ksize: any): any;
  export function dilate(src: any, dst: any, kernel: any, anchor?: any, iterations?: number, borderType?: number, borderValue?: any): void;
  export function HoughLinesP(src: any, lines: any, rho: number, theta: number, threshold: number, minLineLength?: number, maxLineGap?: number): void;
  export function getRotationMatrix2D(center: any, angle: number, scale: number): any;
  export function warpAffine(src: any, dst: any, m: any, dsize: any, flags?: number, borderMode?: number, borderValue?: any): void;
  // Add more functions as needed
}

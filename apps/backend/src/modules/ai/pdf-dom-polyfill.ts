import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

const globalRecord = globalThis as unknown as Record<string, unknown>;

if (typeof globalRecord.DOMMatrix === 'undefined') {
  globalRecord.DOMMatrix = DOMMatrix;
}

if (typeof globalRecord.ImageData === 'undefined') {
  globalRecord.ImageData = ImageData;
}

if (typeof globalRecord.Path2D === 'undefined') {
  globalRecord.Path2D = Path2D;
}

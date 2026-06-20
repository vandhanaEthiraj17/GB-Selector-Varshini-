import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';

interface AsyncIterableStream {
  [Symbol.asyncIterator](): AsyncGenerator<unknown, void, unknown>;
}

// Polyfill for ReadableStream.prototype[Symbol.asyncIterator] to support Safari browser PDF stream parsing
if (typeof ReadableStream !== 'undefined' && !(ReadableStream.prototype as unknown as AsyncIterableStream)[Symbol.asyncIterator]) {
  (ReadableStream.prototype as unknown as AsyncIterableStream)[Symbol.asyncIterator] = async function*() {
    const reader = (this as unknown as ReadableStream).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}

// Configure the pdfjs worker using standard Vite asset importing from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Perform local OCR on a File or Canvas.
 */
export async function performOCR(imageSource: File | HTMLCanvasElement): Promise<string> {
  let worker: any = null;
  try {
    // Create a worker with english language
    worker = await createWorker('eng');
    const ret = await worker.recognize(imageSource);
    return ret.data.text;
  } catch (err) {
    console.error("Local OCR execution failed:", err);
    throw new Error(`Local OCR failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (termErr) {
        console.error("Error terminating Tesseract worker:", termErr);
      }
    }
  }
}

/**
 * Extracts plain text from TXT, PDF, DOCX, or Image files client-side.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  let text = "";

  switch (fileExt) {
    case '.txt':
      text = await readTxtFile(file);
      break;
    case '.pdf':
      text = await readPdfFile(file);
      break;
    case '.docx':
      text = await readDocxFile(file);
      break;
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.bmp':
    case '.tiff':
    case '.webp':
      text = await performOCR(file);
      break;
    default:
      throw new Error(`Unsupported file format: ${fileExt}`);
  }

  console.log("[SF TRACE]", {
    stage: "OCRExtraction",
    value: null,
    source: file.name
  });

  return text;
}

function readTxtFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = () => reject(new Error("Failed to read text file."));
    reader.readAsText(file);
  });
}

async function readPdfFile(file: File): Promise<string> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    console.error("Failed to read PDF file into ArrayBuffer:", err);
    throw new Error(`Failed to read PDF file: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }

  let pdf: any;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
    pdf = await loadingTask.promise;
    
    let extractedText = "";
    
    // Attempt standard text extraction page by page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => (item as { str: string }).str)
        .join(" ");
      extractedText += pageText + "\n";
    }
    
    if (extractedText.trim()) {
      return extractedText;
    }
    
    // If standard text extraction yields nothing, trigger fallback
    console.warn("Standard PDF text extraction yielded empty string. Attempting binary text extraction fallback...");
    const fallbackText = extractStringsFallback(arrayBuffer.slice(0));
    if (fallbackText.trim()) {
      return fallbackText;
    }
    
    throw new Error("No text content found.");
  } catch (error) {
    console.warn("Digital PDF parsing failed or yielded empty results. Running scanned PDF OCR fallback...", error);
    
    // Scanned PDF fallback: Render pages to canvas and perform OCR
    try {
      if (!pdf) {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        pdf = await loadingTask.promise;
      }
      
      let ocrText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        // Render at 2.0 scale for better OCR accuracy
        const viewport = page.getViewport({ scale: 2.0 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
          const pageOcr = await performOCR(canvas);
          ocrText += pageOcr + "\n";
        }
      }
      
      if (ocrText.trim()) {
        return ocrText;
      }
      
      throw new Error("No text could be extracted via OCR.");
    } catch (ocrError) {
      console.error("PDF scanned OCR fallback also failed:", ocrError);
      throw new Error(`PDF Parsing and OCR failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
}

/**
 * Simple client-side fallback that extracts raw ASCII/UTF-8 string sequences from the PDF binary.
 * This recovers raw text streams from some unencrypted text-based PDFs when pdfjs fails.
 */
function extractStringsFallback(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let text = "";
  let currentString = "";
  
  for (let i = 0; i < bytes.length; i++) {
    const charCode = bytes[i];
    // Visible ASCII characters and common whitespace (space, tab, carriage return, newline)
    if ((charCode >= 32 && charCode <= 126) || charCode === 10 || charCode === 13 || charCode === 9) {
      currentString += String.fromCharCode(charCode);
    } else {
      if (currentString.length > 4) {
        text += currentString + "\n";
      }
      currentString = "";
    }
  }
  if (currentString.length > 4) {
    text += currentString + "\n";
  }
  
  // Clean up PDF structural markers to leave mostly raw text streams
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => {
      return (
        line.length > 0 &&
        !line.startsWith("%") &&
        !line.startsWith("/") &&
        !line.includes("/Type") &&
        !line.includes("/Length") &&
        !line.includes("obj") &&
        !line.includes("endobj") &&
        !line.includes("stream") &&
        !line.includes("endstream") &&
        !/^[0-9]+ [0-9]+ R$/.test(line)
      );
    })
    .join(" ");
}

function readDocxFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(result.value);
      } catch (error) {
        console.error("DOCX Parsing error:", error);
        reject(new Error("Failed to parse DOCX document."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read DOCX file."));
    reader.readAsArrayBuffer(file);
  });
}

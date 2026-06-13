/**
 * Image preprocessing and text parsing utilities for OCR
 */

export interface ExtractedBookInfo {
  title: string;
  author?: string;
  confidence: number;
  rawText: string;
}

/**
 * Preprocess image for better OCR results
 * @param imageDataUrl Base64 data URL of the image
 * @returns Preprocessed image data URL
 */
export async function preprocessImageForOCR(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Resize if image is too large (max 1024px width for performance)
        const maxWidth = 1024;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Convert to grayscale and increase contrast
        for (let i = 0; i < data.length; i += 4) {
          // Grayscale conversion
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          
          // Increase contrast (simple threshold)
          const contrast = 1.5;
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const adjusted = factor * (gray - 128) + 128;
          const final = Math.max(0, Math.min(255, adjusted));
          
          data[i] = final;     // R
          data[i + 1] = final; // G
          data[i + 2] = final; // B
          // Alpha stays the same
        }

        ctx.putImageData(imageData, 0, 0);

        // Convert back to data URL
        const processedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(processedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUrl;
  });
}

/**
 * Parse OCR text to extract book title and author
 * @param text Raw OCR text
 * @returns Extracted book information
 */
export function parseBookCoverText(text: string): ExtractedBookInfo {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return {
      title: '',
      author: undefined,
      confidence: 0,
      rawText: text,
    };
  }

  // Common words to filter out (publisher names, common phrases)
  const filterWords = [
    'PENGUIN', 'RANDOM HOUSE', 'HARPERCOLLINS', 'SIMON', 'SCHUSTER',
    'MACMILLAN', 'HACHETTE', 'VINTAGE', 'CROWN', 'BALLANTINE',
    'NEW YORK TIMES', 'BESTSELLER', 'BEST SELLER', 'BESTSELLING',
    'NATIONAL BOOK AWARD', 'PULITZER', 'WINNER',
    'A NOVEL', 'A MEMOIR', 'FICTION', 'NONFICTION',
    'REVISED EDITION', 'ANNIVERSARY EDITION',
  ];

  // Filter out lines that are likely not title/author
  const relevantLines = lines.filter(line => {
    const upper = line.toUpperCase();
    
    // Skip ISBNs
    if (/ISBN/i.test(line) || /^\d{10}$/.test(line) || /^\d{13}$/.test(line)) {
      return false;
    }
    
    // Skip publisher names and common phrases
    if (filterWords.some(word => upper.includes(word))) {
      return false;
    }
    
    // Skip very short lines (likely page numbers or fragments)
    if (line.length < 3) {
      return false;
    }
    
    // Skip lines that are mostly numbers
    const digitCount = (line.match(/\d/g) || []).length;
    if (digitCount / line.length > 0.5) {
      return false;
    }
    
    return true;
  });

  if (relevantLines.length === 0) {
    return {
      title: lines[0] || '',
      author: undefined,
      confidence: 20,
      rawText: text,
    };
  }

  // Extract title (usually the first or longest line)
  let title = relevantLines[0];
  
  // Find longest line in first 5 lines (often the title)
  const topLines = relevantLines.slice(0, Math.min(5, relevantLines.length));
  const longestLine = topLines.reduce((longest, current) => 
    current.length > longest.length ? current : longest
  );
  
  // Use longest line as title if it's significantly longer
  if (longestLine.length > title.length * 1.3) {
    title = longestLine;
  }

  // Extract author
  let author: string | undefined = undefined;
  let authorConfidence = 0;

  for (let i = 0; i < relevantLines.length; i++) {
    const line = relevantLines[i];
    const lower = line.toLowerCase();
    
    // Look for "by" or "BY" prefix
    if (lower.startsWith('by ')) {
      author = line.substring(3).trim();
      authorConfidence = 80;
      break;
    }
    
    // Look for lines with "by" in them
    const byMatch = line.match(/\bby\s+(.+)/i);
    if (byMatch) {
      author = byMatch[1].trim();
      authorConfidence = 70;
      break;
    }
    
    // Look for name patterns (capitalized words, 2-4 words)
    const namePattern = /^([A-Z][a-z]+\s){1,3}[A-Z][a-z]+$/;
    if (namePattern.test(line) && line !== title) {
      author = line;
      authorConfidence = 50;
    }
  }

  // Calculate overall confidence
  let confidence = 50; // Base confidence
  
  if (title.length > 10) confidence += 20;
  if (author) confidence += authorConfidence * 0.3;
  if (relevantLines.length >= 3) confidence += 10;
  
  confidence = Math.min(95, confidence);

  return {
    title: title.trim(),
    author: author?.trim(),
    confidence: Math.round(confidence),
    rawText: text,
  };
}

/**
 * Clean and format extracted text
 */
export function cleanExtractedText(text: string): string {
  return text
    .replace(/[^\w\s'-]/g, ' ') // Remove special characters except hyphens and apostrophes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Build search query from extracted book info
 */
export function buildSearchQuery(bookInfo: ExtractedBookInfo): string {
  const parts: string[] = [];
  
  if (bookInfo.title) {
    parts.push(cleanExtractedText(bookInfo.title));
  }
  
  if (bookInfo.author) {
    parts.push(cleanExtractedText(bookInfo.author));
  }
  
  return parts.join(' ');
}

import { put, del, head } from '@vercel/blob';
import crypto from 'crypto';

export interface StorageOptions {
  access?: 'public';
  addRandomSuffix?: boolean;
  contentType?: string;
}

export interface UploadResult {
  url: string;
  key: string;
  hash: string;
  size: number;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

/**
 * Uploads a file to Vercel Blob with tenant-scoped storage
 * @param file - The file to upload (File, Blob, ArrayBuffer, or ReadableStream)
 * @param tenantId - The tenant ID for folder scoping
 * @param options - Additional storage options
 * @returns Promise with upload result including URL, key, hash, and size
 */
export async function uploadFile(
  file: File | Blob | ArrayBuffer | ReadableStream,
  tenantId: string,
  options: StorageOptions = {}
): Promise<UploadResult> {
  const {
    access = 'public',
    addRandomSuffix = false,
    contentType
  } = options;

  // Extract file info
  const fileInfo = extractFileInfo(file);
  
  // Build a tenant-scoped path with random suffix to avoid clashes
  const safeName = fileInfo.name.replace(/[^\w.\-]+/g, '_');
  const key = `${tenantId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}`;

  // Upload to Vercel Blob
  const blob = await put(key, file, {
    access,
    addRandomSuffix,
    token: process.env.BLOB_READ_WRITE_TOKEN,
    contentType: contentType || fileInfo.type,
  });

  // Compute content hash for deduplication
  const hash = await computeFileHash(file);

  return {
    url: blob.url,
    key: blob.pathname,
    hash,
    size: fileInfo.size,
  };
}

/**
 * Deletes a file from Vercel Blob
 * @param url - The URL of the file to delete
 * @returns Promise with deletion result
 */
export async function deleteFile(url: string): Promise<boolean> {
  try {
    await del(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return true;
  } catch (error) {
    console.error('Failed to delete file:', error);
    return false;
  }
}

/**
 * Downloads a file from Vercel Blob
 * @param url - The URL of the file to download
 * @returns Promise with the file content as ArrayBuffer
 */
export async function downloadFile(url: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
  } catch (error) {
    console.error('Failed to download file:', error);
    throw error;
  }
}

/**
 * Gets file metadata from Vercel Blob
 * @param url - The URL of the file
 * @returns Promise with file metadata or null if not found
 */
export async function getFileInfo(url: string): Promise<{
  size: number;
  uploadedAt: Date;
  contentType: string;
} | null> {
  try {
    const info = await head(url, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    return {
      size: info.size,
      uploadedAt: info.uploadedAt,
      contentType: info.contentType,
    };
  } catch (error) {
    console.error('Failed to get file info:', error);
    return null;
  }
}

/**
 * Generates a tenant-scoped file key without uploading
 * @param fileName - The original file name
 * @param tenantId - The tenant ID for folder scoping
 * @returns The generated key
 */
export function generateFileKey(fileName: string, tenantId: string): string {
  const safeName = fileName.replace(/[^\w.\-]+/g, '_');
  return `${tenantId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}`;
}

/**
 * Extracts file information from various file types
 * @param file - The file object
 * @returns File information
 */
function extractFileInfo(file: File | Blob | ArrayBuffer | ReadableStream): FileInfo {
  if (file instanceof File) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };
  }
  
  if (file instanceof Blob) {
    return {
      name: 'blob',
      size: file.size,
      type: file.type,
    };
  }
  
  if (file instanceof ArrayBuffer) {
    return {
      name: 'buffer',
      size: file.byteLength,
      type: 'application/octet-stream',
    };
  }
  
  // For ReadableStream, we can't determine size/type easily
  return {
    name: 'stream',
    size: 0,
    type: 'application/octet-stream',
  };
}

/**
 * Computes SHA-256 hash of file content for deduplication
 * @param file - The file to hash
 * @returns Promise with hex hash string
 */
async function computeFileHash(file: File | Blob | ArrayBuffer | ReadableStream): Promise<string> {
  let buffer: ArrayBuffer;
  
  if (file instanceof ArrayBuffer) {
    buffer = file;
  } else if (file instanceof File || file instanceof Blob) {
    buffer = await file.arrayBuffer();
  } else {
    // For ReadableStream, we need to collect the data
    const chunks: Uint8Array[] = [];
    const reader = file.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const uint8Buffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      uint8Buffer.set(chunk, offset);
      offset += chunk.length;
    }
    buffer = uint8Buffer.buffer;
  }
  
  return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
}

/**
 * Extracts text content from various file types
 * @param buffer - The file content as Buffer
 * @param mimeType - The MIME type of the file
 * @returns Promise with extracted text content
 */
export async function extractFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    // Handle PDF files
    if (mimeType === 'application/pdf') {
      try {
        const pdf = await import('pdf-parse');
        const data = await pdf.default(buffer);
        return data.text;
      } catch (error) {
        console.warn('PDF parsing not available:', error);
        throw new Error('PDF parsing not available');
      }
    }
    
    // Handle plain text files
    if (mimeType.startsWith('text/')) {
      return buffer.toString('utf-8');
    }
    
    // Handle JSON files
    if (mimeType === 'application/json') {
      const jsonData = JSON.parse(buffer.toString('utf-8'));
      return JSON.stringify(jsonData, null, 2);
    }
    
    // Handle HTML files (basic text extraction)
    if (mimeType === 'text/html') {
      const htmlContent = buffer.toString('utf-8');
      // Simple HTML tag removal (basic implementation)
      return htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
    
    // Handle CSV files
    if (mimeType === 'text/csv') {
      return buffer.toString('utf-8');
    }
    
    // For unsupported file types, return a placeholder message
    console.warn(`Unsupported file type for text extraction: ${mimeType}`);
    return `[Binary file - ${mimeType}] Content extraction not supported for this file type.`;
    
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error(`Failed to extract text from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

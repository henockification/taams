import { MultipartPart } from "./types";

  export function parseMultipartResponse(contentType: string | null, body: Buffer): MultipartPart[] {
    if (!contentType) throw new Error("Missing content-type");
    const match = contentType.match(/boundary="?([^=";]+)"?/i);
    if (!match) throw new Error(`No multipart boundary in content-type: ${contentType}`);
  
    const boundary = match[1];
    const delimiter = Buffer.from(`--${boundary}`);
    const endDelimiter = Buffer.from(`--${boundary}--`);
  
    const parts: MultipartPart[] = [];
    let start = body.indexOf(delimiter);
  
    while (start !== -1) {
      start += delimiter.length;
  
      if (body.slice(start, start + 2).toString() === "--") break;
      if (body.slice(start, start + 2).toString() === "\r\n") start += 2;
  
      let next = body.indexOf(delimiter, start);
      const end = body.indexOf(endDelimiter, start);
      if (next === -1 || (end !== -1 && end < next)) next = end;
      if (next === -1) break;
  
      const partBuffer = body.slice(start, next - 2); // trim trailing CRLF
      const headerEnd = partBuffer.indexOf(Buffer.from("\r\n\r\n"));
      if (headerEnd === -1) {
        start = next;
        continue;
      }
  
      const rawHeaders = partBuffer.slice(0, headerEnd).toString("utf8");
      const content = partBuffer.slice(headerEnd + 4);
  
      const headers: Record<string, string> = {};
      for (const line of rawHeaders.split("\r\n")) {
        const idx = line.indexOf(":");
        if (idx > 0) {
          headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
        }
      }
  
      parts.push({ headers, content });
      start = next;
    }
  
    return parts;
  }
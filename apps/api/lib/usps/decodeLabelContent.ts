export function decodeLabelContent(content: Buffer): Buffer {
    const text = content.toString("utf8").trim();
  
    // PDF base64 usually starts with JVBERi0
    if (text.startsWith("JVBERi0")) {
      return Buffer.from(text, "base64");
    }
  
    return content;
  }
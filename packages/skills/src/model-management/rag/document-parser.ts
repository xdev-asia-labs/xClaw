import { readFile } from 'node:fs/promises';
import type { DocumentSource } from '../types/index.js';

export interface ParsedDocument {
  content: string;
  mimeType: string;
  sizeBytes: number;
}

export async function parseDocument(source: DocumentSource, input: string): Promise<ParsedDocument> {
  switch (source) {
    case 'text':
      return { content: input, mimeType: 'text/plain', sizeBytes: Buffer.byteLength(input) };

    case 'file':
      return parseFile(input);

    case 'url':
      return fetchAndParse(input);
  }
}

async function parseFile(filePath: string): Promise<ParsedDocument> {
  const buffer = await readFile(filePath);
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'pdf') {
    return parsePDF(buffer);
  }

  // Default: treat as text
  const content = buffer.toString('utf-8');
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    ts: 'text/typescript',
    js: 'text/javascript',
    py: 'text/python',
    html: 'text/html',
    xml: 'text/xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
  };

  return {
    content,
    mimeType: mimeMap[ext] ?? 'text/plain',
    sizeBytes: buffer.length,
  };
}

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    return {
      content: result.text,
      mimeType: 'application/pdf',
      sizeBytes: buffer.length,
    };
  } catch {
    throw new Error('Failed to parse PDF. Ensure pdf-parse is installed.');
  }
}

async function fetchAndParse(url: string): Promise<ParsedDocument> {
  // Validate URL to prevent SSRF - only allow http and https
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported');
  }

  const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);

  const contentType = resp.headers.get('content-type') ?? 'text/plain';
  const buffer = Buffer.from(await resp.arrayBuffer());

  if (contentType.includes('pdf')) {
    return parsePDF(buffer);
  }

  return {
    content: buffer.toString('utf-8'),
    mimeType: contentType.split(';')[0].trim(),
    sizeBytes: buffer.length,
  };
}

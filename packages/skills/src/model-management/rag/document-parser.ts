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

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(buffer);
  }

  if (ext === 'docx') {
    return parseDOCX(buffer);
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

async function parseExcel(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    const sections: string[] = [];

    workbook.eachSheet((sheet) => {
      sections.push(`\n## Sheet: ${sheet.name}\n`);

      // Extract headers from first row
      const headers: string[] = [];
      const headerRow = sheet.getRow(1);
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').trim();
      });

      if (headers.length === 0) return;
      sections.push(`| ${headers.join(' | ')} |`);
      sections.push(`| ${headers.map(() => '---').join(' | ')} |`);

      // Extract data rows
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const cells: string[] = [];
        let hasData = false;

        for (let c = 0; c < headers.length; c++) {
          const cell = row.getCell(c + 1);
          const val = cell.value;
          let text = '';
          if (val instanceof Date) {
            text = val.toISOString().split('T')[0];
          } else if (val !== null && val !== undefined) {
            text = String(val).trim();
          }
          if (text) hasData = true;
          cells.push(text);
        }

        if (hasData) {
          sections.push(`| ${cells.join(' | ')} |`);
        }
      }
    });

    const content = sections.join('\n');
    return {
      content,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: buffer.length,
    };
  } catch {
    throw new Error('Failed to parse Excel file. Ensure exceljs is installed.');
  }
}

async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer });
    // Strip HTML tags to get plain text, preserving structure
    const text = result.value
      .replace(/<\/?(h[1-6]|p|li|tr|div|br\s*\/?)>/gi, '\n')
      .replace(/<\/?(table|thead|tbody)>/gi, '\n')
      .replace(/<td[^>]*>/gi, ' | ')
      .replace(/<th[^>]*>/gi, ' | ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return {
      content: text,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: buffer.length,
    };
  } catch {
    throw new Error('Failed to parse DOCX file. Ensure mammoth is installed.');
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

import type { ChunkStrategy } from '../types/index.js';

export interface ChunkResult {
  content: string;
  index: number;
  tokenCount: number;
  startOffset: number;
  endOffset: number;
}

export function chunkText(
  text: string,
  strategy: ChunkStrategy = 'recursive',
  maxTokens: number = 512,
  overlap: number = 50,
): ChunkResult[] {
  switch (strategy) {
    case 'sentence': return chunkBySentence(text, maxTokens, overlap);
    case 'paragraph': return chunkByParagraph(text, maxTokens, overlap);
    case 'fixed': return chunkByFixed(text, maxTokens, overlap);
    case 'recursive':
    default: return chunkRecursive(text, maxTokens, overlap);
  }
}

function estimateTokens(text: string): number {
  // Conservative estimate: ~3 chars per token (better for Vietnamese + markdown)
  return Math.ceil(text.length / 3);
}

function chunkRecursive(text: string, maxTokens: number, overlap: number): ChunkResult[] {
  const separators = ['\n\n', '\n', '. ', ' '];
  return splitRecursively(text, separators, maxTokens, overlap);
}

function splitRecursively(text: string, separators: string[], maxTokens: number, overlap: number): ChunkResult[] {
  if (estimateTokens(text) <= maxTokens) {
    return [{ content: text, index: 0, tokenCount: estimateTokens(text), startOffset: 0, endOffset: text.length }];
  }

  const sepIdx = separators.findIndex(s => text.includes(s));
  if (sepIdx === -1) {
    // No separator can split further — return as single chunk
    return [{ content: text, index: 0, tokenCount: estimateTokens(text), startOffset: 0, endOffset: text.length }];
  }

  const sep = separators[sepIdx];
  const finerSeps = separators.slice(sepIdx + 1);
  const parts = text.split(sep);

  // Merge small parts together, recursively split oversized parts
  const rawChunks: string[] = [];
  let current = '';

  for (const part of parts) {
    if (!part && !current) continue;
    const candidate = current ? current + sep + part : part;

    if (estimateTokens(candidate) <= maxTokens) {
      current = candidate;
    } else if (current) {
      // Flush current (may itself be oversized if a single part was too big)
      if (estimateTokens(current) > maxTokens && finerSeps.length > 0) {
        const sub = splitRecursively(current, finerSeps, maxTokens, overlap);
        for (const s of sub) rawChunks.push(s.content);
      } else {
        rawChunks.push(current);
      }
      current = part;
    } else {
      // Single part exceeds maxTokens — split with finer separators
      if (finerSeps.length > 0) {
        const sub = splitRecursively(part, finerSeps, maxTokens, overlap);
        for (const s of sub) rawChunks.push(s.content);
      } else {
        rawChunks.push(part);
      }
      current = '';
    }
  }

  if (current) {
    if (estimateTokens(current) > maxTokens && finerSeps.length > 0) {
      const sub = splitRecursively(current, finerSeps, maxTokens, overlap);
      for (const s of sub) rawChunks.push(s.content);
    } else {
      rawChunks.push(current);
    }
  }

  // Convert to ChunkResult with sequential offsets
  const chunks: ChunkResult[] = [];
  let offset = 0;
  for (const content of rawChunks) {
    const idx = text.indexOf(content, offset);
    const startOffset = idx >= 0 ? idx : offset;
    chunks.push({
      content,
      index: chunks.length,
      tokenCount: estimateTokens(content),
      startOffset,
      endOffset: startOffset + content.length,
    });
    offset = startOffset + content.length;
  }

  return chunks;
}

function chunkBySentence(text: string, maxTokens: number, overlap: number): ChunkResult[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return mergeSmallChunks(sentences, maxTokens, overlap);
}

function chunkByParagraph(text: string, maxTokens: number, overlap: number): ChunkResult[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
  return mergeSmallChunks(paragraphs, maxTokens, overlap);
}

function chunkByFixed(text: string, maxTokens: number, overlap: number): ChunkResult[] {
  const maxChars = maxTokens * 4;
  const overlapChars = overlap * 4;
  const chunks: ChunkResult[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    const content = text.slice(start, end);
    chunks.push({
      content,
      index: chunks.length,
      tokenCount: estimateTokens(content),
      startOffset: start,
      endOffset: end,
    });
    start = end - overlapChars;
    if (start >= text.length) break;
  }

  return chunks;
}

function mergeSmallChunks(parts: string[], maxTokens: number, _overlap: number): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  let current = '';
  let offset = 0;

  for (const part of parts) {
    const candidate = current ? current + ' ' + part : part;
    if (estimateTokens(candidate) > maxTokens && current) {
      chunks.push({
        content: current,
        index: chunks.length,
        tokenCount: estimateTokens(current),
        startOffset: offset,
        endOffset: offset + current.length,
      });
      offset += current.length + 1;
      current = part;
    } else {
      current = candidate;
    }
  }

  if (current) {
    chunks.push({
      content: current,
      index: chunks.length,
      tokenCount: estimateTokens(current),
      startOffset: offset,
      endOffset: offset + current.length,
    });
  }

  return chunks;
}

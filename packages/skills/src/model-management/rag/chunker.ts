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
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}

function chunkRecursive(text: string, maxTokens: number, overlap: number): ChunkResult[] {
  const separators = ['\n\n', '\n', '. ', ' '];
  return splitRecursively(text, separators, maxTokens, overlap);
}

function splitRecursively(text: string, separators: string[], maxTokens: number, overlap: number): ChunkResult[] {
  if (estimateTokens(text) <= maxTokens) {
    return [{ content: text, index: 0, tokenCount: estimateTokens(text), startOffset: 0, endOffset: text.length }];
  }

  const sep = separators.find(s => text.includes(s)) ?? separators[separators.length - 1];
  const parts = text.split(sep);
  const chunks: ChunkResult[] = [];
  let current = '';
  let offset = 0;

  for (const part of parts) {
    const candidate = current ? current + sep + part : part;
    if (estimateTokens(candidate) > maxTokens && current) {
      const startOffset = offset;
      const endOffset = startOffset + current.length;
      chunks.push({
        content: current,
        index: chunks.length,
        tokenCount: estimateTokens(current),
        startOffset,
        endOffset,
      });
      // Apply overlap
      const overlapChars = overlap * 4;
      const overlapStart = Math.max(0, current.length - overlapChars);
      current = current.slice(overlapStart) + sep + part;
      offset = endOffset - (current.length - sep.length - part.length);
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

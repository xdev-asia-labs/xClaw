// ============================================================
// Content Writer Agent - Generate, translate, SEO, proofread
// ============================================================

import { defineSkill } from '@xclaw/core';
import type { SkillManifest } from '@xclaw/shared';

const manifest: SkillManifest = {
    id: 'content-writer',
    name: 'Content Writer',
    version: '1.0.0',
    description: 'AI-powered content creation with SEO analysis, translation, summarization, and proofreading',
    author: 'xClaw',
    category: 'content',
    tags: ['content', 'seo', 'writing', 'translate', 'blog'],
    tools: [
        {
            name: 'content_generate',
            description: 'Generate articles, blog posts, social media content, or marketing copy.',
            category: 'content',
            parameters: [
                { name: 'type', type: 'string', description: 'Content type: blog, social, email, ad, article', required: true },
                { name: 'topic', type: 'string', description: 'Topic or prompt', required: true },
                { name: 'tone', type: 'string', description: 'Tone: professional, casual, humorous, formal', required: false },
                { name: 'length', type: 'string', description: 'Length: short, medium, long', required: false },
            ],
            returns: { name: 'content', type: 'object', description: '{ text, wordCount, readingTime }' },
        },
        {
            name: 'seo_analyze',
            description: 'Analyze content for SEO: keyword density, readability score, meta suggestions, heading structure.',
            category: 'content',
            parameters: [
                { name: 'content', type: 'string', description: 'Content to analyze', required: true },
                { name: 'targetKeyword', type: 'string', description: 'Target keyword', required: false },
            ],
            returns: { name: 'analysis', type: 'object', description: '{ score, suggestions, keywordDensity }' },
        },
        {
            name: 'text_summarize',
            description: 'Summarize long texts, articles, or documents into concise summaries.',
            category: 'content',
            parameters: [
                { name: 'text', type: 'string', description: 'Text to summarize', required: true },
                { name: 'maxLength', type: 'number', description: 'Max summary length in words', required: false },
                { name: 'style', type: 'string', description: 'Style: bullet-points, paragraph, executive', required: false },
            ],
            returns: { name: 'summary', type: 'object', description: '{ text, originalLength, summaryLength }' },
        },
        {
            name: 'translate_text',
            description: 'Translate text between languages with context-aware translation.',
            category: 'content',
            parameters: [
                { name: 'text', type: 'string', description: 'Text to translate', required: true },
                { name: 'targetLang', type: 'string', description: 'Target language code (en, vi, ja, ko, zh, fr, de)', required: true },
                { name: 'sourceLang', type: 'string', description: 'Source language (auto-detect if omitted)', required: false },
            ],
            returns: { name: 'result', type: 'object', description: '{ translated, sourceLang, targetLang }' },
        },
        {
            name: 'proofread',
            description: 'Check grammar, spelling, style, and clarity. Suggest improvements.',
            category: 'content',
            parameters: [
                { name: 'text', type: 'string', description: 'Text to proofread', required: true },
                { name: 'language', type: 'string', description: 'Language of the text', required: false },
            ],
            returns: { name: 'result', type: 'object', description: '{ issues, suggestions, correctedText }' },
        },
    ],
    config: [],
};

export const contentWriterSkill = defineSkill(manifest, {
    async content_generate(args) {
        return { text: `Generated ${args.type} about: ${args.topic}`, wordCount: 0, readingTime: '0 min', type: args.type };
    },
    async seo_analyze(args) {
        return { score: 0, suggestions: [], keywordDensity: 0, targetKeyword: args.targetKeyword };
    },
    async text_summarize(args) {
        return { text: 'Summary placeholder', originalLength: String(args.text).length, summaryLength: 0 };
    },
    async translate_text(args) {
        return { translated: args.text, sourceLang: args.sourceLang || 'auto', targetLang: args.targetLang };
    },
    async proofread(args) {
        return { issues: [], suggestions: [], correctedText: args.text };
    },
});

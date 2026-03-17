// ============================================================
// Research Agent - Web search, scraping, fact-checking
// ============================================================

import { defineSkill } from '@xclaw/core';
import type { SkillManifest } from '@xclaw/shared';

const manifest: SkillManifest = {
    id: 'research',
    name: 'Research Agent',
    version: '1.0.0',
    description: 'Web search, data collection, fact-checking, comparison, and research report generation',
    author: 'xClaw',
    category: 'research',
    tags: ['research', 'search', 'web', 'reports', 'fact-check'],
    tools: [
        {
            name: 'web_search',
            description: 'Search the web for information on a topic. Returns ranked results with snippets.',
            category: 'research',
            parameters: [
                { name: 'query', type: 'string', description: 'Search query', required: true },
                { name: 'maxResults', type: 'number', description: 'Max results (default 10)', required: false },
                { name: 'domain', type: 'string', description: 'Restrict to domain', required: false },
            ],
            returns: { name: 'results', type: 'array', description: 'Array of { title, url, snippet }' },
        },
        {
            name: 'web_scrape',
            description: 'Extract structured data from a web page URL.',
            category: 'research',
            parameters: [
                { name: 'url', type: 'string', description: 'URL to scrape', required: true },
                { name: 'selector', type: 'string', description: 'CSS selector for targeted extraction', required: false },
            ],
            returns: { name: 'content', type: 'object', description: '{ text, title, links, metadata }' },
        },
        {
            name: 'compare_data',
            description: 'Compare data from multiple sources and highlight differences/similarities.',
            category: 'research',
            parameters: [
                { name: 'sources', type: 'array', description: 'Array of data sources to compare', required: true },
                { name: 'criteria', type: 'array', description: 'Comparison criteria', required: false },
            ],
            returns: { name: 'comparison', type: 'object', description: '{ similarities, differences, matrix }' },
        },
        {
            name: 'fact_check',
            description: 'Verify a claim or statement against known sources.',
            category: 'research',
            parameters: [
                { name: 'claim', type: 'string', description: 'Claim to verify', required: true },
                { name: 'context', type: 'string', description: 'Additional context', required: false },
            ],
            returns: { name: 'result', type: 'object', description: '{ verdict, confidence, sources, explanation }' },
        },
        {
            name: 'research_report',
            description: 'Generate a structured research report from collected data and sources.',
            category: 'research',
            parameters: [
                { name: 'topic', type: 'string', description: 'Research topic', required: true },
                { name: 'sources', type: 'array', description: 'Source data to include', required: false },
                { name: 'format', type: 'string', description: 'Output format: markdown, html', required: false },
            ],
            returns: { name: 'report', type: 'object', description: '{ content, sources, generatedAt }' },
        },
    ],
    config: [],
};

export const researchSkill = defineSkill(manifest, {
    async web_search(args) {
        return { results: [], query: args.query, message: 'Search requires API key configuration' };
    },
    async web_scrape(args) {
        return { text: '', title: '', links: [], url: args.url, message: 'Scraping requires network access' };
    },
    async compare_data(args) {
        return { similarities: [], differences: [], sourceCount: (args.sources as any[]).length };
    },
    async fact_check(args) {
        return { claim: args.claim, verdict: 'unverified', confidence: 0, sources: [], explanation: 'Fact-checking requires API' };
    },
    async research_report(args) {
        return { content: `# Research: ${args.topic}`, sources: [], generatedAt: new Date().toISOString() };
    },
});

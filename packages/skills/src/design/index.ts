// ============================================================
// Design Assistant Agent - Colors, mockups, layout, icons
// ============================================================

import { defineSkill } from '@xclaw/core';
import type { SkillManifest } from '@xclaw/shared';

const manifest: SkillManifest = {
    id: 'design',
    name: 'Design Assistant',
    version: '1.0.0',
    description: 'Color palette generation, UI mockup descriptions, icon suggestions, layout analysis, and design system checks',
    author: 'xClaw',
    category: 'design',
    tags: ['design', 'ui', 'ux', 'colors', 'mockup'],
    tools: [
        {
            name: 'color_palette',
            description: 'Generate harmonious color palettes based on a base color, mood, or brand identity.',
            category: 'design',
            parameters: [
                { name: 'baseColor', type: 'string', description: 'Base color (hex or name)', required: false },
                { name: 'mood', type: 'string', description: 'Mood: vibrant, calm, professional, playful, dark', required: false },
                { name: 'count', type: 'number', description: 'Number of colors (default 5)', required: false },
                { name: 'scheme', type: 'string', description: 'Color scheme: complementary, analogous, triadic, monochromatic', required: false },
            ],
            returns: { name: 'palette', type: 'object', description: '{ colors: [{ hex, rgb, name, usage }], harmony, contrast }' },
        },
        {
            name: 'ui_mockup',
            description: 'Generate UI mockup descriptions and wireframe specifications for screens.',
            category: 'design',
            parameters: [
                { name: 'screenType', type: 'string', description: 'Screen type: dashboard, form, list, detail, onboarding, settings', required: true },
                { name: 'features', type: 'array', description: 'Features to include', required: false },
                { name: 'style', type: 'string', description: 'Design style: minimal, glassmorphism, material, neumorphism', required: false },
                { name: 'platform', type: 'string', description: 'Platform: web, mobile, desktop', required: false },
            ],
            returns: { name: 'mockup', type: 'object', description: '{ layout, components, interactions, specifications }' },
        },
        {
            name: 'icon_suggest',
            description: 'Suggest icons from popular icon libraries for given concepts or actions.',
            category: 'design',
            parameters: [
                { name: 'concept', type: 'string', description: 'Concept or action to find icon for', required: true },
                { name: 'library', type: 'string', description: 'Icon library: lucide, heroicons, phosphor, material', required: false },
                { name: 'style', type: 'string', description: 'Style: outline, solid, duotone', required: false },
            ],
            returns: { name: 'suggestions', type: 'object', description: '{ icons: [{ name, library, usage }] }' },
        },
        {
            name: 'layout_analyze',
            description: 'Analyze UI layout for accessibility, spacing, hierarchy, and responsiveness.',
            category: 'design',
            parameters: [
                { name: 'description', type: 'string', description: 'Layout description or HTML structure', required: true },
                { name: 'viewport', type: 'string', description: 'Target viewport: mobile, tablet, desktop', required: false },
            ],
            returns: { name: 'analysis', type: 'object', description: '{ score, issues, suggestions, hierarchy }' },
        },
        {
            name: 'design_system_check',
            description: 'Check design tokens and components against design system guidelines.',
            category: 'design',
            parameters: [
                { name: 'component', type: 'string', description: 'Component name or code', required: true },
                { name: 'designSystem', type: 'string', description: 'Design system: material, antd, tailwind', required: false },
            ],
            returns: { name: 'result', type: 'object', description: '{ compliant, issues, fixes }' },
        },
    ],
    config: [],
};

export const designSkill = defineSkill(manifest, {
    async color_palette(args) {
        return { colors: [], harmony: args.scheme || 'complementary', baseColor: args.baseColor, mood: args.mood };
    },
    async ui_mockup(args) {
        return { screenType: args.screenType, layout: {}, components: [], interactions: [], style: args.style || 'minimal' };
    },
    async icon_suggest(args) {
        return { concept: args.concept, icons: [], library: args.library || 'lucide' };
    },
    async layout_analyze(args) {
        return { score: 0, issues: [], suggestions: [], hierarchy: [], viewport: args.viewport || 'desktop' };
    },
    async design_system_check(args) {
        return { component: args.component, compliant: true, issues: [], fixes: [], system: args.designSystem || 'tailwind' };
    },
});

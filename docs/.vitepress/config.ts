import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'xClaw',
    description: 'Open-source AI Agent Platform — Pluggable skills, visual workflows, multi-LLM support',
    lang: 'en-US',
    ignoreDeadLinks: [/localhost/],

    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
        ['meta', { name: 'theme-color', content: '#6366f1' }],
        // Open Graph
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: 'xClaw — AI Agent Platform' }],
        ['meta', { property: 'og:description', content: 'Open-source AI Agent Platform with pluggable skills, visual workflows, and multi-LLM support' }],
        ['meta', { property: 'og:url', content: 'https://ai.xdev.asia' }],
        ['meta', { property: 'og:image', content: 'https://ai.xdev.asia/og-image.png' }],
        // Twitter
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ['meta', { name: 'twitter:title', content: 'xClaw — AI Agent Platform' }],
        ['meta', { name: 'twitter:description', content: 'Open-source AI Agent Platform with pluggable skills, visual workflows, and multi-LLM support' }],
        // Google Fonts
        ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
        ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
        ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap', rel: 'stylesheet' }],
    ],

    sitemap: {
        hostname: 'https://ai.xdev.asia',
    },

    themeConfig: {
        logo: '/logo.svg',
        siteTitle: 'xClaw',

        nav: [
            { text: 'Guide', link: '/guide/getting-started' },
            { text: 'Architecture', link: '/architecture/overview' },
            { text: 'Skills', link: '/skills/overview' },
            { text: 'API', link: '/api/reference' },
            { text: 'Agent Hub', link: '/agent-hub/overview' },
            {
                text: 'v0.2.0',
                items: [
                    { text: 'Changelog', link: 'https://github.com/tdduydev/xClaw/releases' },
                    { text: 'npm', link: 'https://www.npmjs.com/org/xclaw' },
                ],
            },
        ],

        sidebar: {
            '/guide/': [
                {
                    text: 'Introduction',
                    items: [
                        { text: 'Getting Started', link: '/guide/getting-started' },
                        { text: 'Installation', link: '/guide/installation' },
                        { text: 'Configuration', link: '/guide/configuration' },
                    ],
                },
            ],
            '/architecture/': [
                {
                    text: 'Architecture',
                    items: [
                        { text: 'Overview', link: '/architecture/overview' },
                        { text: 'Workflow Engine', link: '/architecture/workflow-engine' },
                    ],
                },
            ],
            '/skills/': [
                {
                    text: 'Skills',
                    items: [
                        { text: 'Overview', link: '/skills/overview' },
                        { text: 'Creating Skills', link: '/skills/creating-skills' },
                    ],
                },
            ],
            '/agent-hub/': [
                {
                    text: 'Agent Hub',
                    items: [
                        { text: 'Overview', link: '/agent-hub/overview' },
                    ],
                },
            ],
            '/api/': [
                {
                    text: 'API Reference',
                    items: [
                        { text: 'REST API', link: '/api/reference' },
                    ],
                },
            ],
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/tdduydev/xClaw' },
        ],

        editLink: {
            pattern: 'https://github.com/tdduydev/xClaw/edit/main/docs/:path',
            text: 'Edit this page on GitHub',
        },

        search: {
            provider: 'local',
        },

        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2024-present xdev.asia',
        },
    },
})

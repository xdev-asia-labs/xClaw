// ============================================================
// Sales & CRM Agent - Lead management, outreach, pipeline
// ============================================================

import { defineSkill } from '@xclaw/core';
import type { SkillManifest } from '@xclaw/shared';

const manifest: SkillManifest = {
    id: 'sales-crm',
    name: 'Sales & CRM',
    version: '1.0.0',
    description: 'Lead management, email outreach, pipeline tracking, AI lead scoring, and sales analytics',
    author: 'xClaw',
    category: 'sales',
    tags: ['sales', 'crm', 'leads', 'email', 'pipeline'],
    tools: [
        {
            name: 'crm_search',
            description: 'Search and query CRM records: contacts, deals, companies, activities.',
            category: 'sales',
            parameters: [
                { name: 'entity', type: 'string', description: 'Entity type: contact, deal, company, activity', required: true },
                { name: 'query', type: 'string', description: 'Search query or filter', required: true },
                { name: 'limit', type: 'number', description: 'Max results', required: false },
            ],
            returns: { name: 'results', type: 'object', description: '{ records, total }' },
        },
        {
            name: 'email_compose',
            description: 'Compose personalized outreach emails based on lead data and templates.',
            category: 'sales',
            parameters: [
                { name: 'to', type: 'string', description: 'Recipient name or email', required: true },
                { name: 'purpose', type: 'string', description: 'Email purpose: intro, followup, proposal, thankyou', required: true },
                { name: 'context', type: 'string', description: 'Additional context about the lead', required: false },
                { name: 'tone', type: 'string', description: 'Tone: formal, friendly, direct', required: false },
            ],
            returns: { name: 'email', type: 'object', description: '{ subject, body, callToAction }' },
        },
        {
            name: 'lead_score',
            description: 'AI-powered lead scoring based on engagement, firmographics, and behavior.',
            category: 'sales',
            parameters: [
                { name: 'leadData', type: 'object', description: 'Lead information and activity data', required: true },
            ],
            returns: { name: 'score', type: 'object', description: '{ score, tier, factors, recommendation }' },
        },
        {
            name: 'pipeline_report',
            description: 'Generate sales pipeline reports with stage analysis and forecasting.',
            category: 'sales',
            parameters: [
                { name: 'period', type: 'string', description: 'Report period: week, month, quarter, year', required: true },
                { name: 'team', type: 'string', description: 'Team filter', required: false },
            ],
            returns: { name: 'report', type: 'object', description: '{ totalDeals, totalValue, stageBreakdown, forecast }' },
        },
        {
            name: 'schedule_followup',
            description: 'Schedule follow-up activities, reminders, and tasks for leads.',
            category: 'sales',
            parameters: [
                { name: 'contactId', type: 'string', description: 'Contact or lead ID', required: true },
                { name: 'type', type: 'string', description: 'Activity type: call, email, meeting, task', required: true },
                { name: 'scheduledAt', type: 'string', description: 'Scheduled date/time (ISO)', required: true },
                { name: 'notes', type: 'string', description: 'Activity notes', required: false },
            ],
            returns: { name: 'activity', type: 'object', description: '{ activityId, status, scheduledAt }' },
        },
    ],
    config: [],
};

export const salesCrmSkill = defineSkill(manifest, {
    async crm_search(args) {
        return { records: [], total: 0, entity: args.entity, query: args.query };
    },
    async email_compose(args) {
        return { subject: `Re: ${args.purpose}`, body: `Email to ${args.to}`, callToAction: 'Schedule a call' };
    },
    async lead_score(args) {
        return { score: 0, tier: 'cold', factors: [], recommendation: 'Needs more data' };
    },
    async pipeline_report(args) {
        return { totalDeals: 0, totalValue: 0, stageBreakdown: {}, forecast: {}, period: args.period };
    },
    async schedule_followup(args) {
        return { activityId: `act_${Date.now()}`, status: 'scheduled', scheduledAt: args.scheduledAt };
    },
});

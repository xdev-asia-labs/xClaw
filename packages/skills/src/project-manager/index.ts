// ============================================================
// Project Manager Agent - Tasks, sprints, risk assessment
// ============================================================

import { defineSkill } from '@xclaw/core';
import type { SkillManifest } from '@xclaw/shared';

const manifest: SkillManifest = {
    id: 'project-manager',
    name: 'Project Manager',
    version: '1.0.0',
    description: 'Task tracking, sprint planning, progress reports, standup summaries, and risk assessment',
    author: 'xClaw',
    category: 'project-management',
    tags: ['project', 'tasks', 'sprint', 'agile', 'planning'],
    tools: [
        {
            name: 'task_create',
            description: 'Create and assign project tasks with priority, labels, and due dates.',
            category: 'project-management',
            parameters: [
                { name: 'title', type: 'string', description: 'Task title', required: true },
                { name: 'description', type: 'string', description: 'Task description', required: false },
                { name: 'assignee', type: 'string', description: 'Assignee name or ID', required: false },
                { name: 'priority', type: 'string', description: 'Priority: critical, high, medium, low', required: false },
                { name: 'dueDate', type: 'string', description: 'Due date (ISO format)', required: false },
                { name: 'labels', type: 'array', description: 'Task labels', required: false },
            ],
            returns: { name: 'task', type: 'object', description: '{ taskId, title, status, assignee }' },
        },
        {
            name: 'sprint_plan',
            description: 'Plan sprint cycles: select stories, estimate velocity, assign capacity.',
            category: 'project-management',
            parameters: [
                { name: 'sprintName', type: 'string', description: 'Sprint name', required: true },
                { name: 'duration', type: 'number', description: 'Duration in days (default 14)', required: false },
                { name: 'stories', type: 'array', description: 'Story IDs to include', required: false },
                { name: 'capacity', type: 'number', description: 'Team capacity in story points', required: false },
            ],
            returns: { name: 'sprint', type: 'object', description: '{ sprintId, stories, totalPoints, startDate, endDate }' },
        },
        {
            name: 'progress_report',
            description: 'Generate project progress reports with burndown, velocity, and completion metrics.',
            category: 'project-management',
            parameters: [
                { name: 'projectId', type: 'string', description: 'Project identifier', required: true },
                { name: 'period', type: 'string', description: 'Report period: sprint, week, month', required: false },
            ],
            returns: { name: 'report', type: 'object', description: '{ completion, burndown, velocity, blockers }' },
        },
        {
            name: 'standup_summary',
            description: 'Generate standup meeting summaries from team updates.',
            category: 'project-management',
            parameters: [
                { name: 'updates', type: 'array', description: 'Array of team member updates', required: true },
                { name: 'format', type: 'string', description: 'Output format: text, markdown, slack', required: false },
            ],
            returns: { name: 'summary', type: 'object', description: '{ text, highlights, blockers, actionItems }' },
        },
        {
            name: 'risk_assess',
            description: 'Assess project risks with impact/probability scoring and mitigation strategies.',
            category: 'project-management',
            parameters: [
                { name: 'projectId', type: 'string', description: 'Project identifier', required: true },
                { name: 'risks', type: 'array', description: 'Known risk descriptions', required: false },
            ],
            returns: { name: 'assessment', type: 'object', description: '{ risks, overallScore, mitigations }' },
        },
    ],
    config: [],
};

export const projectManagerSkill = defineSkill(manifest, {
    async task_create(args) {
        return { taskId: `task_${Date.now()}`, title: args.title, status: 'created', assignee: args.assignee || 'unassigned' };
    },
    async sprint_plan(args) {
        return { sprintId: `sprint_${Date.now()}`, name: args.sprintName, stories: [], totalPoints: 0 };
    },
    async progress_report(args) {
        return { projectId: args.projectId, completion: 0, burndown: [], velocity: 0, blockers: [] };
    },
    async standup_summary(args) {
        return { text: 'Standup summary', highlights: [], blockers: [], actionItems: [], memberCount: (args.updates as any[]).length };
    },
    async risk_assess(args) {
        return { projectId: args.projectId, risks: [], overallScore: 0, mitigations: [] };
    },
});

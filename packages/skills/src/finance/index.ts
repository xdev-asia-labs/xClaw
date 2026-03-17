// ============================================================
// Finance & Accounting Agent - Budget, invoicing, tax
// ============================================================

import { defineSkill } from '@xclaw/core';
import type { SkillManifest } from '@xclaw/shared';

const manifest: SkillManifest = {
    id: 'finance',
    name: 'Finance & Accounting',
    version: '1.0.0',
    description: 'Budget tracking, invoicing, expense reports, tax calculation, and financial forecasting',
    author: 'xClaw',
    category: 'finance',
    tags: ['finance', 'budget', 'invoice', 'tax', 'accounting'],
    tools: [
        {
            name: 'budget_track',
            description: 'Track and manage budgets: set limits, monitor spending, compare actuals vs planned.',
            category: 'finance',
            parameters: [
                { name: 'action', type: 'string', description: 'Action: create, update, status, compare', required: true },
                { name: 'budgetName', type: 'string', description: 'Budget name', required: true },
                { name: 'amount', type: 'number', description: 'Budget amount', required: false },
                { name: 'period', type: 'string', description: 'Budget period: monthly, quarterly, yearly', required: false },
            ],
            returns: { name: 'budget', type: 'object', description: '{ budgetId, allocated, spent, remaining }' },
        },
        {
            name: 'invoice_create',
            description: 'Create professional invoices with line items, tax, and payment terms.',
            category: 'finance',
            parameters: [
                { name: 'client', type: 'string', description: 'Client name', required: true },
                { name: 'items', type: 'array', description: 'Line items: [{ description, quantity, unitPrice }]', required: true },
                { name: 'taxRate', type: 'number', description: 'Tax rate percentage', required: false },
                { name: 'dueDate', type: 'string', description: 'Payment due date', required: false },
                { name: 'currency', type: 'string', description: 'Currency code (USD, VND, EUR)', required: false },
            ],
            returns: { name: 'invoice', type: 'object', description: '{ invoiceId, subtotal, tax, total, dueDate }' },
        },
        {
            name: 'expense_report',
            description: 'Generate expense reports grouped by category, department, or time period.',
            category: 'finance',
            parameters: [
                { name: 'period', type: 'string', description: 'Report period: week, month, quarter, year', required: true },
                { name: 'category', type: 'string', description: 'Expense category filter', required: false },
                { name: 'department', type: 'string', description: 'Department filter', required: false },
            ],
            returns: { name: 'report', type: 'object', description: '{ total, byCategory, byDepartment, trends }' },
        },
        {
            name: 'tax_calculate',
            description: 'Calculate taxes, deductions, and estimated payments.',
            category: 'finance',
            parameters: [
                { name: 'income', type: 'number', description: 'Total income', required: true },
                { name: 'deductions', type: 'array', description: 'Array of deductions', required: false },
                { name: 'jurisdiction', type: 'string', description: 'Tax jurisdiction (country/state)', required: false },
                { name: 'type', type: 'string', description: 'Tax type: income, sales, vat', required: false },
            ],
            returns: { name: 'result', type: 'object', description: '{ taxableIncome, taxAmount, effectiveRate, deductions }' },
        },
        {
            name: 'financial_forecast',
            description: 'Generate financial forecasts based on historical data and trends.',
            category: 'finance',
            parameters: [
                { name: 'data', type: 'object', description: 'Historical financial data', required: true },
                { name: 'periods', type: 'number', description: 'Number of periods to forecast', required: false },
                { name: 'model', type: 'string', description: 'Forecast model: linear, seasonal, moving-average', required: false },
            ],
            returns: { name: 'forecast', type: 'object', description: '{ predictions, confidence, trend, insights }' },
        },
    ],
    config: [
        { key: 'defaultCurrency', label: 'Default Currency', type: 'string', description: 'Default currency code', required: false, default: 'USD' },
    ],
};

export const financeSkill = defineSkill(manifest, {
    async budget_track(args) {
        return { budgetId: `budget_${Date.now()}`, name: args.budgetName, allocated: args.amount || 0, spent: 0, remaining: args.amount || 0 };
    },
    async invoice_create(args) {
        const items = args.items as any[];
        const subtotal = items.reduce((sum, i) => sum + (i.quantity || 1) * (i.unitPrice || 0), 0);
        const tax = subtotal * ((args.taxRate as number || 0) / 100);
        return { invoiceId: `inv_${Date.now()}`, client: args.client, subtotal, tax, total: subtotal + tax };
    },
    async expense_report(args) {
        return { period: args.period, total: 0, byCategory: {}, byDepartment: {}, trends: [] };
    },
    async tax_calculate(args) {
        return { taxableIncome: args.income, taxAmount: 0, effectiveRate: 0, deductions: args.deductions || [] };
    },
    async financial_forecast(args) {
        return { predictions: [], confidence: 0, trend: 'neutral', insights: [], periods: args.periods || 3 };
    },
});

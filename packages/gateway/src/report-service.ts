// ============================================================
// Report Service - Analytics & report generation from PG data
// ============================================================

import pg from 'pg';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface ReportSummary {
  period: string;
  totalChats: number;
  totalMessages: number;
  totalTokensUsed: number;
  avgResponseLatencyMs: number;
  activeUsers: number;
  newUsers: number;
  topUsers: { username: string; displayName: string; messageCount: number }[];
  dailyVolume: { date: string; chats: number; messages: number }[];
  modelUsage: { model: string; count: number }[];
}

export interface UserActivityReport {
  userId: string;
  username: string;
  displayName: string;
  totalConversations: number;
  totalMessages: number;
  totalTokensUsed: number;
  lastActiveAt: string | null;
  joinedAt: string;
}

export class ReportService {
  constructor(private pool: pg.Pool) {}

  /**
   * Generate a summary report for the given period (in days).
   */
  async getSummary(days: number = 7): Promise<ReportSummary> {
    const period = `${days}d`;

    // Total chats and messages in period
    const chatStats = await this.pool.query(
      `SELECT
         COUNT(DISTINCT c.id) AS total_chats,
         COUNT(m.id) AS total_messages,
         COALESCE(SUM(m.tokens_used), 0)::bigint AS total_tokens,
         COALESCE(AVG(m.latency_ms) FILTER (WHERE m.role = 'assistant'), 0)::int AS avg_latency
       FROM conversations c
       LEFT JOIN chat_messages m ON m.conversation_id = c.id
       WHERE c.created_at >= NOW() - make_interval(days => $1)`,
      [days],
    );

    const row = chatStats.rows[0];

    // Active users (users who sent messages in period)
    const activeUsersResult = await this.pool.query(
      `SELECT COUNT(DISTINCT c.user_id)::int AS active_users
       FROM conversations c
       JOIN chat_messages m ON m.conversation_id = c.id
       WHERE m.created_at >= NOW() - make_interval(days => $1) AND m.role = 'user'`,
      [days],
    );

    // New users in period
    const newUsersResult = await this.pool.query(
      `SELECT COUNT(*)::int AS new_users FROM users
       WHERE created_at >= NOW() - make_interval(days => $1)`,
      [days],
    );

    // Top users by message count
    const topUsersResult = await this.pool.query(
      `SELECT u.username, u.display_name, COUNT(m.id)::int AS message_count
       FROM users u
       JOIN conversations c ON c.user_id = u.id
       JOIN chat_messages m ON m.conversation_id = c.id
       WHERE m.created_at >= NOW() - make_interval(days => $1) AND m.role = 'user'
       GROUP BY u.id, u.username, u.display_name
       ORDER BY message_count DESC
       LIMIT 10`,
      [days],
    );

    // Daily volume
    const dailyResult = await this.pool.query(
      `SELECT
         d.day::date AS date,
         COUNT(DISTINCT c.id)::int AS chats,
         COUNT(m.id)::int AS messages
       FROM generate_series(
         (NOW() - make_interval(days => $1))::date,
         NOW()::date,
         '1 day'::interval
       ) AS d(day)
       LEFT JOIN conversations c ON c.created_at::date = d.day::date
         AND c.created_at >= NOW() - make_interval(days => $1)
       LEFT JOIN chat_messages m ON m.conversation_id = c.id
         AND m.created_at::date = d.day::date
       GROUP BY d.day
       ORDER BY d.day`,
      [days],
    );

    // Model usage (from conversations with model_id set)
    const modelResult = await this.pool.query(
      `SELECT COALESCE(c.model_id, 'default') AS model, COUNT(*)::int AS count
       FROM conversations c
       WHERE c.created_at >= NOW() - make_interval(days => $1)
       GROUP BY c.model_id
       ORDER BY count DESC`,
      [days],
    );

    return {
      period,
      totalChats: parseInt(row.total_chats) || 0,
      totalMessages: parseInt(row.total_messages) || 0,
      totalTokensUsed: parseInt(row.total_tokens) || 0,
      avgResponseLatencyMs: parseInt(row.avg_latency) || 0,
      activeUsers: activeUsersResult.rows[0]?.active_users ?? 0,
      newUsers: newUsersResult.rows[0]?.new_users ?? 0,
      topUsers: topUsersResult.rows.map(r => ({
        username: r.username,
        displayName: r.display_name,
        messageCount: r.message_count,
      })),
      dailyVolume: dailyResult.rows.map(r => ({
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
        chats: r.chats,
        messages: r.messages,
      })),
      modelUsage: modelResult.rows.map(r => ({
        model: r.model,
        count: r.count,
      })),
    };
  }

  /**
   * Generate a per-user activity report.
   */
  async getUserActivity(days: number = 30): Promise<UserActivityReport[]> {
    const result = await this.pool.query(
      `SELECT
         u.id AS user_id, u.username, u.display_name,
         COUNT(DISTINCT c.id)::int AS total_conversations,
         COUNT(m.id)::int AS total_messages,
         COALESCE(SUM(m.tokens_used), 0)::bigint AS total_tokens,
         MAX(m.created_at) AS last_active_at,
         u.created_at AS joined_at
       FROM users u
       LEFT JOIN conversations c ON c.user_id = u.id
         AND c.created_at >= NOW() - make_interval(days => $1)
       LEFT JOIN chat_messages m ON m.conversation_id = c.id
         AND m.created_at >= NOW() - make_interval(days => $1)
       GROUP BY u.id, u.username, u.display_name, u.created_at
       ORDER BY total_messages DESC`,
      [days],
    );

    return result.rows.map(r => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name,
      totalConversations: r.total_conversations,
      totalMessages: r.total_messages,
      totalTokensUsed: parseInt(r.total_tokens) || 0,
      lastActiveAt: r.last_active_at,
      joinedAt: r.joined_at,
    }));
  }

  /**
   * Generate a text-formatted report suitable for AI consumption.
   */
  async generateTextReport(type: string, days: number = 7): Promise<string> {
    if (type === 'user-activity') {
      const users = await this.getUserActivity(days);
      const lines = [
        `# User Activity Report (Last ${days} Days)`,
        `Generated: ${new Date().toISOString()}`,
        '',
        `| User | Conversations | Messages | Tokens Used | Last Active |`,
        `|------|--------------|----------|-------------|-------------|`,
      ];
      for (const u of users) {
        lines.push(
          `| ${u.displayName} (@${u.username}) | ${u.totalConversations} | ${u.totalMessages} | ${u.totalTokensUsed.toLocaleString()} | ${u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : 'Never'} |`,
        );
      }
      return lines.join('\n');
    }

    // Default: summary report
    const summary = await this.getSummary(days);
    const lines = [
      `# Platform Summary Report (Last ${days} Days)`,
      `Generated: ${new Date().toISOString()}`,
      '',
      `## Key Metrics`,
      `- Total Conversations: ${summary.totalChats}`,
      `- Total Messages: ${summary.totalMessages}`,
      `- Total Tokens Used: ${summary.totalTokensUsed.toLocaleString()}`,
      `- Average Response Latency: ${summary.avgResponseLatencyMs}ms`,
      `- Active Users: ${summary.activeUsers}`,
      `- New Users: ${summary.newUsers}`,
      '',
      `## Daily Volume`,
    ];
    for (const d of summary.dailyVolume) {
      lines.push(`- ${d.date}: ${d.chats} chats, ${d.messages} messages`);
    }
    lines.push('', `## Top Users`);
    for (const u of summary.topUsers) {
      lines.push(`- ${u.displayName} (@${u.username}): ${u.messageCount} messages`);
    }
    if (summary.modelUsage.length > 0) {
      lines.push('', `## Model Usage`);
      for (const m of summary.modelUsage) {
        lines.push(`- ${m.model}: ${m.count} conversations`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Generate an Excel workbook buffer for the given report type.
   */
  async generateExcel(type: string, days: number = 7): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'xClaw';
    wb.created = new Date();

    if (type === 'user-activity') {
      const users = await this.getUserActivity(days);
      const ws = wb.addWorksheet('User Activity');
      ws.columns = [
        { header: 'Username', key: 'username', width: 18 },
        { header: 'Display Name', key: 'displayName', width: 22 },
        { header: 'Conversations', key: 'totalConversations', width: 16 },
        { header: 'Messages', key: 'totalMessages', width: 14 },
        { header: 'Tokens Used', key: 'totalTokensUsed', width: 16 },
        { header: 'Last Active', key: 'lastActiveAt', width: 22 },
        { header: 'Joined', key: 'joinedAt', width: 22 },
      ];
      this.styleHeaderRow(ws);
      for (const u of users) {
        ws.addRow({
          ...u,
          lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : 'Never',
          joinedAt: new Date(u.joinedAt).toLocaleDateString(),
        });
      }
    } else {
      // Summary report with multiple sheets
      const summary = await this.getSummary(days);

      // Overview sheet
      const overview = wb.addWorksheet('Overview');
      overview.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value', key: 'value', width: 20 },
      ];
      this.styleHeaderRow(overview);
      overview.addRows([
        { metric: 'Period', value: `Last ${days} days` },
        { metric: 'Total Conversations', value: summary.totalChats },
        { metric: 'Total Messages', value: summary.totalMessages },
        { metric: 'Total Tokens Used', value: summary.totalTokensUsed },
        { metric: 'Avg Response Latency (ms)', value: summary.avgResponseLatencyMs },
        { metric: 'Active Users', value: summary.activeUsers },
        { metric: 'New Users', value: summary.newUsers },
      ]);

      // Daily volume sheet
      const daily = wb.addWorksheet('Daily Volume');
      daily.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Chats', key: 'chats', width: 12 },
        { header: 'Messages', key: 'messages', width: 14 },
      ];
      this.styleHeaderRow(daily);
      for (const d of summary.dailyVolume) daily.addRow(d);

      // Top users sheet
      const topUsers = wb.addWorksheet('Top Users');
      topUsers.columns = [
        { header: 'Rank', key: 'rank', width: 8 },
        { header: 'Username', key: 'username', width: 18 },
        { header: 'Display Name', key: 'displayName', width: 22 },
        { header: 'Messages', key: 'messageCount', width: 14 },
      ];
      this.styleHeaderRow(topUsers);
      summary.topUsers.forEach((u, i) => topUsers.addRow({ rank: i + 1, ...u }));

      // Model usage sheet
      const models = wb.addWorksheet('Model Usage');
      models.columns = [
        { header: 'Model', key: 'model', width: 28 },
        { header: 'Conversations', key: 'count', width: 16 },
      ];
      this.styleHeaderRow(models);
      for (const m of summary.modelUsage) models.addRow(m);
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Generate a PDF buffer for the given report type.
   */
  async generatePdf(type: string, days: number = 7): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    return new Promise<Buffer>(async (resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text('xClaw Report', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#666666')
        .text(`Generated: ${new Date().toLocaleString()} • Period: Last ${days} days`, { align: 'center' });
      doc.moveDown(1);

      if (type === 'user-activity') {
        await this.writePdfUserActivity(doc, days);
      } else {
        await this.writePdfSummary(doc, days);
      }

      doc.end();
    });
  }

  // ── PDF helpers ─────────────────────────────────────

  private async writePdfSummary(doc: PDFKit.PDFDocument, days: number) {
    const summary = await this.getSummary(days);

    // Key metrics
    doc.fontSize(14).fillColor('#000000').text('Key Metrics');
    doc.moveDown(0.5);
    const metrics = [
      ['Conversations', String(summary.totalChats)],
      ['Messages', String(summary.totalMessages)],
      ['Tokens Used', summary.totalTokensUsed.toLocaleString()],
      ['Avg Latency', `${summary.avgResponseLatencyMs}ms`],
      ['Active Users', String(summary.activeUsers)],
      ['New Users', String(summary.newUsers)],
    ];
    this.drawPdfTable(doc, ['Metric', 'Value'], metrics);

    // Daily volume chart (text-based bar chart in PDF)
    doc.moveDown(1);
    doc.fontSize(14).text('Daily Volume');
    doc.moveDown(0.5);
    const maxMsg = Math.max(...summary.dailyVolume.map(d => d.messages), 1);
    const barMaxWidth = 300;
    for (const d of summary.dailyVolume) {
      const barWidth = Math.max(2, (d.messages / maxMsg) * barMaxWidth);
      const y = doc.y;
      doc.fontSize(8).fillColor('#333333').text(d.date.slice(5), 50, y, { width: 40 });
      doc.rect(95, y, barWidth, 10).fill('#3b82f6');
      doc.fillColor('#333333').text(`${d.messages}`, 95 + barWidth + 5, y, { width: 60 });
      doc.moveDown(0.4);
    }

    // Top users
    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#000000').text('Top Users');
    doc.moveDown(0.5);
    this.drawPdfTable(doc, ['#', 'User', 'Messages'],
      summary.topUsers.map((u, i) => [String(i + 1), `${u.displayName} (@${u.username})`, String(u.messageCount)]));

    // Model usage
    if (summary.modelUsage.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(14).fillColor('#000000').text('Model Usage');
      doc.moveDown(0.5);
      this.drawPdfTable(doc, ['Model', 'Conversations'],
        summary.modelUsage.map(m => [m.model, String(m.count)]));
    }
  }

  private async writePdfUserActivity(doc: PDFKit.PDFDocument, days: number) {
    const users = await this.getUserActivity(days);
    doc.fontSize(14).fillColor('#000000').text('User Activity');
    doc.moveDown(0.5);
    this.drawPdfTable(doc,
      ['User', 'Convs', 'Msgs', 'Tokens', 'Last Active'],
      users.map(u => [
        `${u.displayName} (@${u.username})`,
        String(u.totalConversations),
        String(u.totalMessages),
        u.totalTokensUsed.toLocaleString(),
        u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : 'Never',
      ]),
    );
  }

  private drawPdfTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
    const colCount = headers.length;
    const tableWidth = 500;
    const colWidth = tableWidth / colCount;
    const startX = 50;

    // Header row
    let y = doc.y;
    doc.rect(startX, y, tableWidth, 18).fill('#f1f5f9');
    doc.fillColor('#334155').fontSize(9);
    headers.forEach((h, i) => doc.text(h, startX + i * colWidth + 4, y + 4, { width: colWidth - 8, ellipsis: true }));
    doc.y = y + 20;

    // Data rows
    doc.fillColor('#1e293b').fontSize(8);
    for (const row of rows) {
      y = doc.y;
      if (y > 750) { doc.addPage(); y = doc.y; } // page break
      row.forEach((cell, i) => doc.text(cell, startX + i * colWidth + 4, y + 2, { width: colWidth - 8, ellipsis: true }));
      doc.y = y + 16;
    }
  }

  // ── Excel helper ─────────────────────────────────────

  private styleHeaderRow(ws: ExcelJS.Worksheet) {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FF334155' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    row.alignment = { vertical: 'middle' };
    row.height = 22;
  }
}

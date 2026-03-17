// ============================================================
// Clinical Alert System – Integration Test
// Kiểm tra toàn bộ luồng cảnh báo lâm sàng FHIR R5
// Sử dụng Ollama local (meditron:7b / llama3.1:8b)
// ============================================================

import { EventBus } from '@xclaw/core';
import { ToolRegistry } from '@xclaw/core';
import { SkillManager } from '@xclaw/core';
import { OpenAIAdapter } from '@xclaw/core';
import { healthcareSkill } from '@xclaw/skills';

// ─── Helpers ────────────────────────────────────────────────

const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const HEADER = '\x1b[36m';
const RESET = '\x1b[0m';
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}` + (detail ? ` — ${detail}` : ''));
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${HEADER}══════════════════════════════════════════${RESET}`);
  console.log(`${HEADER}  ${title}${RESET}`);
  console.log(`${HEADER}══════════════════════════════════════════${RESET}`);
}

// ─── Main Test ──────────────────────────────────────────────

async function main() {
  console.log('\n🏥 Clinical Alert System — Integration Test');
  console.log('   HL7 FHIR R5 | Ollama Local\n');

  // ── 1. Khởi tạo hệ thống ──────────────────────────────

  section('1. Khởi tạo hệ thống xClaw');

  const eventBus = new EventBus();
  const toolRegistry = new ToolRegistry(eventBus);
  const skillManager = new SkillManager(toolRegistry, eventBus);

  await skillManager.register(healthcareSkill);
  await skillManager.activate('healthcare');

  assert(skillManager.isActive('healthcare'), 'Healthcare skill activated');

  const allTools = toolRegistry.getAllDefinitions();
  const clinicalTools = ['allergy_record', 'prescription_alert_check', 'prescription_quick_check', 'drug_substance_lookup'];
  for (const name of clinicalTools) {
    assert(allTools.some(t => t.name === name), `Tool "${name}" registered`);
  }

  // ── 2. Tra cứu hoạt chất thuốc ────────────────────────

  section('2. Tra cứu hoạt chất thuốc (drug_substance_lookup)');

  const amoxResult = await toolRegistry.execute({
    id: 'test-1', name: 'drug_substance_lookup',
    arguments: { query: 'amoxicillin' },
  });
  const amoxData = amoxResult.result as Record<string, unknown>;
  assert(amoxResult.success, 'Tra cứu Amoxicillin thành công');
  assert(amoxData.found === true, 'Tìm thấy Amoxicillin trong DB');
  console.log(`    → Thuốc: ${amoxData.drugDisplay}`);
  console.log(`    → Hoạt chất: ${JSON.stringify(amoxData.substanceNames)}`);

  const augResult = await toolRegistry.execute({
    id: 'test-2', name: 'drug_substance_lookup',
    arguments: { query: 'augmentin' },
  });
  const augData = augResult.result as Record<string, unknown>;
  assert(augData.found === true, 'Tìm thấy Augmentin (đa hoạt chất)');
  console.log(`    → Thuốc: ${augData.drugDisplay}`);
  console.log(`    → Hoạt chất: ${JSON.stringify(augData.substanceNames)}`);

  const unknownResult = await toolRegistry.execute({
    id: 'test-3', name: 'drug_substance_lookup',
    arguments: { query: 'thuoc-khong-ton-tai-xyz' },
  });
  const unknownData = unknownResult.result as Record<string, unknown>;
  assert(unknownData.found === false, 'Thuốc không tồn tại → found=false');

  // ── 3. Ghi nhận dị ứng ────────────────────────────────

  section('3. Ghi nhận tiền sử dị ứng (allergy_record)');

  const PATIENT_ID = 'BN-001';

  // Ghi nhận dị ứng Penicillin (high criticality)
  const addPenicillin = await toolRegistry.execute({
    id: 'test-4', name: 'allergy_record',
    arguments: {
      action: 'add',
      patientId: PATIENT_ID,
      substance: 'penicillin',
      criticality: 'high',
      reactions: [
        { manifestation: 'anaphylaxis', severity: 'severe' },
        { manifestation: 'urticaria', severity: 'moderate' },
      ],
      recordedBy: 'BS. Nguyễn Văn A',
      note: 'Bệnh nhân phản ứng sốc phản vệ với Penicillin năm 2020',
    },
  });
  const penicillinData = addPenicillin.result as Record<string, unknown>;
  assert(addPenicillin.success, 'Ghi nhận dị ứng Penicillin thành công');
  assert(penicillinData.action === 'added', 'Action = added');
  const penicillinAllergy = penicillinData.allergy as Record<string, unknown>;
  assert(penicillinAllergy.resourceType === 'AllergyIntolerance', 'Resource type = AllergyIntolerance (FHIR R5)');
  console.log(`    → ID: ${penicillinAllergy.id}`);
  console.log(`    → Message: ${penicillinData.message}`);

  // Ghi nhận dị ứng Aspirin (low criticality)
  const addAspirin = await toolRegistry.execute({
    id: 'test-5', name: 'allergy_record',
    arguments: {
      action: 'add',
      patientId: PATIENT_ID,
      substance: 'aspirin',
      criticality: 'low',
      reactions: [{ manifestation: 'rash', severity: 'mild' }],
      recordedBy: 'BS. Trần Thị B',
    },
  });
  assert(addAspirin.success, 'Ghi nhận dị ứng Aspirin thành công');

  // Liệt kê dị ứng
  const listAllergies = await toolRegistry.execute({
    id: 'test-6', name: 'allergy_record',
    arguments: { action: 'list', patientId: PATIENT_ID },
  });
  const listData = listAllergies.result as Record<string, unknown>;
  assert(listData.count === 2, `Có 2 dị ứng active (got ${listData.count})`);

  // ── 4. KIỂM TRA ĐƠN THUỐC – CỐT LÕI ────────────────

  section('4. Kiểm tra đơn thuốc – Cảnh báo lâm sàng');

  // 4a. Thuốc AN TOÀN (Metformin — không liên quan penicillin/aspirin)
  console.log('\n  📋 Test 4a: Đơn thuốc AN TOÀN');
  const safeCheck = await toolRegistry.execute({
    id: 'test-7', name: 'prescription_alert_check',
    arguments: {
      patientId: PATIENT_ID,
      medications: [
        { medicationName: 'Metformin 850mg', dosageText: '850mg x 2 lần/ngày', prescriberName: 'BS. Lê C' },
      ],
    },
  });
  const safeData = safeCheck.result as Record<string, unknown>;
  assert(safeCheck.success, 'Kiểm tra đơn thuốc thành công');
  assert(safeData.hasAlerts === false, 'Metformin → Không có cảnh báo ✅');
  console.log(`    → ${(safeData.summary as string[])[0]}`);

  // 4b. Thuốc NGUY HIỂM — Amoxicillin (dị ứng chéo penicillin)
  console.log('\n  📋 Test 4b: Đơn thuốc NGUY HIỂM (dị ứng chéo)');
  const dangerCheck = await toolRegistry.execute({
    id: 'test-8', name: 'prescription_alert_check',
    arguments: {
      patientId: PATIENT_ID,
      medications: [
        { medicationName: 'Amoxicillin 500mg', dosageText: '500mg x 3 lần/ngày', prescriberName: 'BS. Phạm D' },
      ],
    },
  });
  const dangerData = dangerCheck.result as Record<string, unknown>;
  assert(dangerData.hasAlerts === true, 'Amoxicillin → CÓ CẢNH BÁO 🚨 (dị ứng chéo Penicillin)');
  const dangerIssues = dangerData.issues as Array<Record<string, unknown>>;
  assert(dangerIssues.length > 0, `Có ${dangerIssues.length} DetectedIssue`);
  assert(dangerIssues[0].resourceType === 'DetectedIssue', 'Resource type = DetectedIssue (FHIR R5)');
  assert(dangerIssues[0].severity === 'high', `Severity = high (criticality cao)`);
  for (const line of dangerData.summary as string[]) {
    console.log(`    → ${line}`);
  }

  // 4c. Thuốc NGUY HIỂM — Augmentin (chứa amoxicillin, dị ứng chéo penicillin)
  console.log('\n  📋 Test 4c: Đơn thuốc phức hợp (Augmentin = Amoxicillin + Clavulanate)');
  const augCheck = await toolRegistry.execute({
    id: 'test-9', name: 'prescription_alert_check',
    arguments: {
      patientId: PATIENT_ID,
      medications: [
        { medicationName: 'Augmentin 625mg', dosageText: '625mg x 2 lần/ngày' },
      ],
    },
  });
  const augCheckData = augCheck.result as Record<string, unknown>;
  assert(augCheckData.hasAlerts === true, 'Augmentin → CÓ CẢNH BÁO 🚨 (chứa amoxicillin → dị ứng chéo penicillin)');
  for (const line of augCheckData.summary as string[]) {
    console.log(`    → ${line}`);
  }

  // 4d. Thuốc NGUY HIỂM — Ibuprofen (dị ứng chéo Aspirin)
  console.log('\n  📋 Test 4d: Ibuprofen (dị ứng chéo Aspirin)');
  const ibuCheck = await toolRegistry.execute({
    id: 'test-10', name: 'prescription_alert_check',
    arguments: {
      patientId: PATIENT_ID,
      medications: [
        { medicationName: 'Ibuprofen 400mg', dosageText: '400mg khi đau' },
      ],
    },
  });
  const ibuData = ibuCheck.result as Record<string, unknown>;
  assert(ibuData.hasAlerts === true, 'Ibuprofen → CÓ CẢNH BÁO ⚠️ (dị ứng chéo Aspirin)');
  const ibuIssues = ibuData.issues as Array<Record<string, unknown>>;
  assert(ibuIssues[0]?.severity === 'low', 'Severity = low (criticality thấp)');
  for (const line of ibuData.summary as string[]) {
    console.log(`    → ${line}`);
  }

  // 4e. Đơn thuốc NHIỀU loại cùng lúc (mix safe + dangerous)
  console.log('\n  📋 Test 4e: Đơn thuốc nhiều loại (Metformin + Amoxicillin + Ciprofloxacin)');
  const multiCheck = await toolRegistry.execute({
    id: 'test-11', name: 'prescription_alert_check',
    arguments: {
      patientId: PATIENT_ID,
      medications: [
        { medicationName: 'Metformin 850mg', dosageText: '850mg x 2 lần/ngày' },
        { medicationName: 'Amoxicillin 500mg', dosageText: '500mg x 3 lần/ngày' },
        { medicationName: 'Ciprofloxacin 500mg', dosageText: '500mg x 2 lần/ngày' },
      ],
    },
  });
  const multiData = multiCheck.result as Record<string, unknown>;
  assert(multiData.hasAlerts === true, 'Đơn thuốc hỗn hợp → CÓ CẢNH BÁO (Amoxicillin)');
  const multiIssues = multiData.issues as Array<Record<string, unknown>>;
  console.log(`    → Phát hiện ${multiIssues.length} cảnh báo`);
  for (const line of multiData.summary as string[]) {
    console.log(`    → ${line}`);
  }

  // ── 5. Quick Check (UI real-time) ─────────────────────

  section('5. Quick Check (kiểm tra nhanh khi chọn thuốc)');

  const quickSafe = await toolRegistry.execute({
    id: 'test-12', name: 'prescription_quick_check',
    arguments: { patientId: PATIENT_ID, medicationName: 'Ciprofloxacin' },
  });
  const quickSafeData = quickSafe.result as Record<string, unknown>;
  assert(quickSafeData.hasAlerts === false, 'Quick check Ciprofloxacin → An toàn ✅');

  const quickDanger = await toolRegistry.execute({
    id: 'test-13', name: 'prescription_quick_check',
    arguments: { patientId: PATIENT_ID, medicationName: 'Ampicillin' },
  });
  const quickDangerData = quickDanger.result as Record<string, unknown>;
  assert(quickDangerData.hasAlerts === true, 'Quick check Ampicillin → CẢNH BÁO 🚨 (dị ứng chéo Penicillin)');

  // ── 6. FHIR R5 Bundle validation ──────────────────────

  section('6. Kiểm tra cấu trúc FHIR R5 Bundle');

  const bundle = dangerData.bundle as Record<string, unknown>;
  assert(bundle.resourceType === 'Bundle', 'Bundle.resourceType = Bundle');
  assert(bundle.type === 'collection', 'Bundle.type = collection');
  assert(typeof bundle.timestamp === 'string', 'Bundle.timestamp có giá trị');
  const entries = bundle.entry as Array<Record<string, unknown>>;
  assert(entries.length > 0, `Bundle có ${entries.length} entries`);

  const resourceTypes = entries.map(e => (e.resource as Record<string, unknown>).resourceType);
  assert(resourceTypes.includes('AllergyIntolerance'), 'Bundle chứa AllergyIntolerance');
  assert(resourceTypes.includes('MedicationRequest'), 'Bundle chứa MedicationRequest');
  assert(resourceTypes.includes('DetectedIssue'), 'Bundle chứa DetectedIssue');
  console.log(`    → Resource types trong Bundle: ${[...new Set(resourceTypes)].join(', ')}`);

  // ── 7. Kết nối Ollama – Kiểm tra LLM hiểu kết quả ───

  section('7. Ollama Integration – LLM phân tích kết quả cảnh báo');

  try {
    const ollamaAdapter = new OpenAIAdapter({
      provider: 'ollama',
      model: 'llama3.1:8b',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'ollama',
      temperature: 0.3,
      maxTokens: 1024,
    });

    const alertSummary = (dangerData.summary as string[]).join('\n');
    const response = await ollamaAdapter.chat([
      {
        role: 'system',
        content: 'Bạn là trợ lý y tế trong hệ thống HIS. Khi nhận được cảnh báo lâm sàng, hãy giải thích ngắn gọn cho bác sĩ bằng tiếng Việt. Trả lời ngắn gọn trong 3-5 câu.',
      },
      {
        role: 'user',
        content: `Hệ thống phát hiện cảnh báo khi kê đơn cho bệnh nhân BN-001:\n\n${alertSummary}\n\nHãy giải thích cảnh báo này cho bác sĩ.`,
      },
    ]);

    assert(response.content.length > 0, 'Ollama trả về phản hồi thành công');
    assert(response.finishReason === 'stop', `Finish reason: ${response.finishReason}`);
    console.log(`\n    🤖 Ollama (${response.model}):`);
    console.log(`    ─────────────────────────────────────`);
    for (const line of response.content.split('\n')) {
      console.log(`    ${line}`);
    }
    console.log(`    ─────────────────────────────────────`);
    console.log(`    Tokens: ${response.usage.promptTokens} prompt + ${response.usage.completionTokens} completion = ${response.usage.totalTokens} total`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ${FAIL} Ollama connection failed: ${msg}`);
    failed++;
  }

  // ── Summary ───────────────────────────────────────────

  section('KẾT QUẢ TỔNG HỢP');
  console.log(`\n  Tổng: ${passed + failed} tests`);
  console.log(`  ${PASS}: ${passed}`);
  console.log(`  ${FAIL}: ${failed}`);
  console.log(`  ${failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️ Some tests failed.'}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

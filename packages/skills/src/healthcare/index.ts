// ============================================================
// Healthcare Skill Pack - Y tế, chẩn đoán hỗ trợ, quản lý sức khỏe
// ============================================================

import { defineSkill } from '@xclaw/core';
import type { SkillManifest } from '@xclaw/shared';
import {
  addAllergy,
  getActiveAllergies,
  getAllAllergies,
  removeAllergy,
  buildAllergyIntolerance,
  buildMedicationRequest,
  checkPrescriptionAlerts,
  checkSingleMedication,
  lookupDrug,
  ingestDataSource,
  checkDrugInteraction,
  findInteractionsFor,
  checkContraindicationsForDiagnosis,
  isContraindicated,
  lookupVNFormulary,
  getIngestedStats,
} from './clinical-alert/index.js';
import type { MedicationRequest } from './clinical-alert/index.js';
import { PluginLoader } from '@xclaw/core';

const manifest: SkillManifest = {
  id: 'healthcare',
  name: 'Healthcare & Medical Assistant',
  version: '1.0.0',
  description: 'Health monitoring, symptom analysis, medication management, appointment scheduling, medical record organization, and clinical workflow support',
  author: 'xClaw',
  category: 'healthcare',
  tags: ['health', 'medical', 'symptoms', 'medication', 'appointment', 'patient', 'clinical', 'fhir', 'allergy', 'his', 'prescription-alert'],
  tools: [
    // ─── Symptom & Triage ─────────────────────────────────
    {
      name: 'symptom_analyze',
      description: 'Analyze symptoms and provide differential diagnosis suggestions with triage level. NOT a replacement for professional medical advice.',
      category: 'healthcare',
      parameters: [
        { name: 'symptoms', type: 'array', description: 'List of symptoms (e.g. ["headache", "fever", "nausea"])', required: true },
        { name: 'duration', type: 'string', description: 'How long symptoms have been present', required: false },
        { name: 'severity', type: 'string', description: 'Severity: mild, moderate, severe', required: false, enum: ['mild', 'moderate', 'severe'] },
        { name: 'patientAge', type: 'number', description: 'Patient age', required: false },
        { name: 'patientGender', type: 'string', description: 'Patient gender', required: false },
        { name: 'existingConditions', type: 'array', description: 'Known conditions/allergies', required: false },
      ],
      returns: { name: 'analysis', type: 'object', description: 'Symptom analysis with triage level' },
    },
    // ─── Medication Management ────────────────────────────
    {
      name: 'medication_check_interaction',
      description: 'Check potential drug interactions between medications',
      category: 'healthcare',
      parameters: [
        { name: 'medications', type: 'array', description: 'List of medication names', required: true },
      ],
      returns: { name: 'interactions', type: 'object', description: 'Interaction check results' },
    },
    {
      name: 'medication_schedule',
      description: 'Create or manage a medication schedule with reminders',
      category: 'healthcare',
      parameters: [
        { name: 'action', type: 'string', description: 'add, remove, list, update', required: true, enum: ['add', 'remove', 'list', 'update'] },
        { name: 'medication', type: 'string', description: 'Medication name', required: false },
        { name: 'dosage', type: 'string', description: 'Dosage (e.g. "500mg")', required: false },
        { name: 'frequency', type: 'string', description: 'Frequency (e.g. "2 times daily", "every 8 hours")', required: false },
        { name: 'times', type: 'array', description: 'Specific times (e.g. ["08:00", "20:00"])', required: false },
        { name: 'notes', type: 'string', description: 'Special instructions (e.g. "take with food")', required: false },
      ],
      returns: { name: 'schedule', type: 'object', description: 'Updated medication schedule' },
    },
    // ─── Health Metrics ───────────────────────────────────
    {
      name: 'health_metrics_log',
      description: 'Log health metrics like blood pressure, blood sugar, weight, heart rate, temperature, SpO2',
      category: 'healthcare',
      parameters: [
        { name: 'metric', type: 'string', description: 'Metric type', required: true, enum: ['blood_pressure', 'blood_sugar', 'weight', 'heart_rate', 'temperature', 'spo2', 'bmi', 'custom'] },
        { name: 'value', type: 'string', description: 'Metric value (e.g. "120/80" for BP)', required: true },
        { name: 'unit', type: 'string', description: 'Unit of measurement', required: false },
        { name: 'notes', type: 'string', description: 'Additional notes', required: false },
        { name: 'measuredAt', type: 'string', description: 'When the measurement was taken (ISO datetime)', required: false },
      ],
      returns: { name: 'entry', type: 'object', description: 'Logged metric entry' },
    },
    {
      name: 'health_metrics_query',
      description: 'Query health metrics history, trends, and statistics',
      category: 'healthcare',
      parameters: [
        { name: 'metric', type: 'string', description: 'Metric type to query', required: true },
        { name: 'period', type: 'string', description: 'Time period: today, week, month, year, all', required: false, enum: ['today', 'week', 'month', 'year', 'all'] },
        { name: 'format', type: 'string', description: 'Output format: summary, chart-data, table', required: false, enum: ['summary', 'chart-data', 'table'] },
      ],
      returns: { name: 'data', type: 'object', description: 'Metrics history and statistics' },
    },
    // ─── Appointment Management ───────────────────────────
    {
      name: 'appointment_manage',
      description: 'Manage medical appointments: create, list, cancel, reschedule',
      category: 'healthcare',
      parameters: [
        { name: 'action', type: 'string', description: 'Action to perform', required: true, enum: ['create', 'list', 'cancel', 'reschedule', 'upcoming'] },
        { name: 'doctor', type: 'string', description: 'Doctor name or specialty', required: false },
        { name: 'datetime', type: 'string', description: 'Appointment date/time (ISO)', required: false },
        { name: 'location', type: 'string', description: 'Hospital/clinic name', required: false },
        { name: 'reason', type: 'string', description: 'Reason for visit', required: false },
        { name: 'appointmentId', type: 'string', description: 'Appointment ID (for cancel/reschedule)', required: false },
      ],
      returns: { name: 'result', type: 'object', description: 'Appointment details' },
    },
    // ─── Medical Records ──────────────────────────────────
    {
      name: 'medical_record',
      description: 'Store and retrieve medical records, lab results, prescriptions, and notes',
      category: 'healthcare',
      parameters: [
        { name: 'action', type: 'string', description: 'save, search, list, get', required: true, enum: ['save', 'search', 'list', 'get'] },
        { name: 'recordType', type: 'string', description: 'Type of record', required: false, enum: ['lab_result', 'prescription', 'diagnosis', 'imaging', 'note', 'vaccination', 'allergy'] },
        { name: 'content', type: 'string', description: 'Record content or description', required: false },
        { name: 'date', type: 'string', description: 'Record date', required: false },
        { name: 'doctor', type: 'string', description: 'Attending doctor', required: false },
        { name: 'tags', type: 'array', description: 'Tags for categorization', required: false },
        { name: 'query', type: 'string', description: 'Search query (for search action)', required: false },
        { name: 'recordId', type: 'string', description: 'Record ID (for get action)', required: false },
      ],
      returns: { name: 'result', type: 'object', description: 'Medical record(s)' },
    },
    // ─── Health Report ────────────────────────────────────
    {
      name: 'health_report',
      description: 'Generate a comprehensive health report combining metrics, medications, and records',
      category: 'healthcare',
      parameters: [
        { name: 'period', type: 'string', description: 'Report period', required: false, enum: ['week', 'month', 'quarter', 'year'] },
        { name: 'sections', type: 'array', description: 'Sections to include: metrics, medications, appointments, records', required: false },
      ],
      returns: { name: 'report', type: 'object', description: 'Health report' },
    },
    // ─── Clinical Workflow (dành cho bác sĩ/phòng khám) ──
    {
      name: 'clinical_note',
      description: 'Generate structured clinical notes (SOAP format) from conversation',
      category: 'healthcare',
      parameters: [
        { name: 'subjective', type: 'string', description: 'Patient complaints and history', required: true },
        { name: 'objective', type: 'string', description: 'Examination findings, vitals, lab results', required: false },
        { name: 'assessment', type: 'string', description: 'Diagnosis or differential diagnosis', required: false },
        { name: 'plan', type: 'string', description: 'Treatment plan', required: false },
        { name: 'patientId', type: 'string', description: 'Patient identifier', required: false },
      ],
      returns: { name: 'note', type: 'object', description: 'Structured SOAP note' },
    },
    {
      name: 'icd_lookup',
      description: 'Look up ICD-10 diagnostic codes by keyword or code',
      category: 'healthcare',
      parameters: [
        { name: 'query', type: 'string', description: 'Search keyword or ICD code', required: true },
        { name: 'limit', type: 'number', description: 'Max results', required: false },
      ],
      returns: { name: 'codes', type: 'array', description: 'Matching ICD-10 codes' },
    },
    // ─── Clinical Alert – Cảnh báo lâm sàng (FHIR R5) ──
    {
      name: 'allergy_record',
      description: 'Ghi nhận tiền sử dị ứng thuốc cho bệnh nhân (FHIR R5 AllergyIntolerance). Dùng trong HIS để xây dựng hồ sơ dị ứng.',
      category: 'healthcare',
      parameters: [
        { name: 'action', type: 'string', description: 'add | list | remove', required: true, enum: ['add', 'list', 'remove'] },
        { name: 'patientId', type: 'string', description: 'ID bệnh nhân', required: true },
        { name: 'substance', type: 'string', description: 'Tên hoạt chất gây dị ứng (e.g. "amoxicillin", "aspirin")', required: false },
        { name: 'substanceCode', type: 'string', description: 'Mã RxNorm hoạt chất (nếu biết)', required: false },
        { name: 'criticality', type: 'string', description: 'Mức nguy hiểm: low, high, unable-to-assess', required: false, enum: ['low', 'high', 'unable-to-assess'] },
        { name: 'reactions', type: 'array', description: 'Danh sách phản ứng [{manifestation, severity}]', required: false },
        { name: 'recordedBy', type: 'string', description: 'Tên bác sĩ ghi nhận', required: false },
        { name: 'note', type: 'string', description: 'Ghi chú thêm', required: false },
        { name: 'allergyId', type: 'string', description: 'ID dị ứng (cho action remove)', required: false },
      ],
      returns: { name: 'result', type: 'object', description: 'FHIR AllergyIntolerance resource hoặc danh sách' },
    },
    {
      name: 'prescription_alert_check',
      description: 'Kiểm tra đơn thuốc so với tiền sử dị ứng, sinh cảnh báo lâm sàng (FHIR R5 DetectedIssue). Gọi TRƯỚC khi lưu đơn thuốc trong HIS.',
      category: 'healthcare',
      parameters: [
        { name: 'patientId', type: 'string', description: 'ID bệnh nhân', required: true },
        { name: 'medications', type: 'array', description: 'Danh sách thuốc [{medicationName, dosageText?, route?, reasonCode?, reasonDisplay?, prescriberName?}]', required: true },
      ],
      returns: { name: 'alerts', type: 'object', description: 'ClinicalAlert chứa DetectedIssue[] và Bundle FHIR R5' },
    },
    {
      name: 'prescription_quick_check',
      description: 'Kiểm tra nhanh một thuốc duy nhất với tiền sử dị ứng bệnh nhân. Dùng khi bác sĩ vừa chọn thuốc trong UI.',
      category: 'healthcare',
      parameters: [
        { name: 'patientId', type: 'string', description: 'ID bệnh nhân', required: true },
        { name: 'medicationName', type: 'string', description: 'Tên thuốc cần kiểm tra', required: true },
      ],
      returns: { name: 'alert', type: 'object', description: 'ClinicalAlert cho thuốc đó' },
    },
    {
      name: 'drug_substance_lookup',
      description: 'Tra cứu hoạt chất (active ingredients) của một thuốc từ cơ sở dữ liệu RxNorm.',
      category: 'healthcare',
      parameters: [
        { name: 'query', type: 'string', description: 'Tên thuốc hoặc mã RxNorm', required: true },
      ],
      returns: { name: 'drug', type: 'object', description: 'Thông tin thuốc và danh sách hoạt chất' },
    },
    // ─── Knowledge Pack Tools – Tra cứu dữ liệu từ knowledge packs ──
    {
      name: 'drug_interaction_check',
      description: 'Kiểm tra tương tác thuốc-thuốc (drug-drug interaction) từ knowledge pack ICD-10 Drug Interactions. Trả về mức độ nghiêm trọng, cơ chế, và khuyến cáo.',
      category: 'healthcare',
      parameters: [
        { name: 'drugA', type: 'string', description: 'Tên hoạt chất/thuốc thứ nhất', required: true },
        { name: 'drugB', type: 'string', description: 'Tên hoạt chất/thuốc thứ hai (nếu kiểm tra cặp). Bỏ trống để xem tất cả tương tác của drugA.', required: false },
      ],
      returns: { name: 'interactions', type: 'object', description: 'Danh sách tương tác thuốc' },
    },
    {
      name: 'icd10_contraindication_check',
      description: 'Kiểm tra chống chỉ định thuốc theo mã bệnh ICD-10. Ví dụ: bệnh nhân loét dạ dày (K25) không được dùng NSAIDs.',
      category: 'healthcare',
      parameters: [
        { name: 'icd10Code', type: 'string', description: 'Mã ICD-10 (e.g. "K25", "J45", "N17")', required: true },
        { name: 'substance', type: 'string', description: 'Tên hoạt chất cần kiểm tra (nếu muốn kiểm tra thuốc cụ thể)', required: false },
      ],
      returns: { name: 'contraindications', type: 'object', description: 'Danh sách chống chỉ định' },
    },
    {
      name: 'vn_formulary_lookup',
      description: 'Tra cứu danh mục thuốc Việt Nam (VN Drug Formulary). Tìm theo tên biệt dược, tên generic, hoặc nhóm dược lý. Bao gồm thông tin BHYT.',
      category: 'healthcare',
      parameters: [
        { name: 'query', type: 'string', description: 'Tên thuốc, hoạt chất, hoặc nhóm dược lý cần tra cứu', required: true },
      ],
      returns: { name: 'drugs', type: 'object', description: 'Danh sách thuốc phù hợp từ danh mục VN' },
    },
  ],
  config: [
    { key: 'disclaimerEnabled', label: 'Show Medical Disclaimer', type: 'boolean', description: 'Always show disclaimer that AI is not a doctor', required: false, default: true },
    { key: 'emergencyContact', label: 'Emergency Contact', type: 'string', description: 'Phone number for emergency alerts', required: false },
    { key: 'healthDataPath', label: 'Health Data Path', type: 'string', description: 'Path to store health data locally', required: false, default: './data/health' },
    { key: 'fhirServerUrl', label: 'FHIR Server URL', type: 'string', description: 'Optional FHIR server for EHR integration', required: false },
  ],
};

// ─── In-memory stores (will be replaced by DB in production) ─

interface MetricEntry {
  id: string;
  metric: string;
  value: string;
  unit?: string;
  notes?: string;
  measuredAt: string;
}

interface MedicationEntry {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  times: string[];
  notes?: string;
  active: boolean;
}

interface AppointmentEntry {
  id: string;
  doctor: string;
  datetime: string;
  location: string;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

interface MedicalRecordEntry {
  id: string;
  recordType: string;
  content: string;
  date: string;
  doctor?: string;
  tags: string[];
}

const metricsStore: MetricEntry[] = [];
const medicationStore: MedicationEntry[] = [];
const appointmentStore: AppointmentEntry[] = [];
const recordStore: MedicalRecordEntry[] = [];

const DISCLAIMER = '⚠️ DISCLAIMER: This is AI-generated health information and NOT a substitute for professional medical advice. Always consult a qualified healthcare provider.';

// ─── ICD-10 basic lookup data (subset for demo) ─────────────

const ICD10_SUBSET: { code: string; description: string }[] = [
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism' },
  { code: 'I10', description: 'Essential (primary) hypertension' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'R51', description: 'Headache' },
  { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis' },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated' },
  { code: 'F41.1', description: 'Generalized anxiety disorder' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified' },
  { code: 'B34.9', description: 'Viral infection, unspecified' },
  { code: 'R50.9', description: 'Fever, unspecified' },
  { code: 'R05', description: 'Cough' },
  { code: 'R11.2', description: 'Nausea with vomiting, unspecified' },
  { code: 'R10.9', description: 'Unspecified abdominal pain' },
  { code: 'L30.9', description: 'Dermatitis, unspecified' },
  { code: 'H10.9', description: 'Unspecified conjunctivitis' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified' },
  { code: 'Z00.00', description: 'Encounter for general adult medical examination' },
  { code: 'Z23', description: 'Encounter for immunization' },
];

// ─── Tool Implementations ───────────────────────────────────

export const healthcareSkill = defineSkill(manifest, {
  async symptom_analyze(args) {
    const symptoms = args.symptoms as string[];
    const severity = (args.severity as string) ?? 'moderate';
    const duration = args.duration as string;
    const age = args.patientAge as number;
    const conditions = args.existingConditions as string[] ?? [];

    // Triage level logic
    const emergencySymptoms = ['chest pain', 'difficulty breathing', 'severe bleeding', 'unconscious', 'stroke symptoms', 'seizure'];
    const urgentSymptoms = ['high fever', 'severe pain', 'vomiting blood', 'sudden vision loss'];

    const hasEmergency = symptoms.some(s => emergencySymptoms.some(e => s.toLowerCase().includes(e)));
    const hasUrgent = symptoms.some(s => urgentSymptoms.some(u => s.toLowerCase().includes(u)));

    let triageLevel: string;
    let triageAction: string;

    if (hasEmergency || severity === 'severe') {
      triageLevel = 'EMERGENCY';
      triageAction = 'Seek immediate emergency medical care (call 115 / go to ER)';
    } else if (hasUrgent) {
      triageLevel = 'URGENT';
      triageAction = 'See a doctor within 24 hours';
    } else if (severity === 'moderate') {
      triageLevel = 'SEMI-URGENT';
      triageAction = 'Schedule an appointment within a few days';
    } else {
      triageLevel = 'NON-URGENT';
      triageAction = 'Monitor symptoms, see a doctor if they worsen';
    }

    return {
      disclaimer: DISCLAIMER,
      symptoms,
      severity,
      duration,
      triageLevel,
      triageAction,
      riskFactors: [
        ...(age && age > 65 ? ['Age > 65 (higher risk)'] : []),
        ...(conditions.length > 0 ? [`Existing conditions: ${conditions.join(', ')}`] : []),
      ],
      recommendations: [
        triageAction,
        'Keep track of symptom changes',
        'Stay hydrated and rest',
        'Prepare a list of symptoms, duration, and medications for your doctor visit',
      ],
      note: 'This analysis is AI-generated and for informational purposes only. Always consult a qualified healthcare professional for diagnosis and treatment.',
    };
  },

  async medication_check_interaction(args) {
    const medications = args.medications as string[];

    // In production, this would call a real drug interaction API (e.g. RxNorm, OpenFDA)
    return {
      disclaimer: DISCLAIMER,
      medications,
      note: 'For accurate interaction checking, connect to a drug interaction API (e.g. OpenFDA, DrugBank, RxNorm). This is a placeholder.',
      recommendation: 'Always inform your doctor/pharmacist about all medications you are taking.',
      checkedAt: new Date().toISOString(),
    };
  },

  async medication_schedule(args) {
    const action = args.action as string;

    switch (action) {
      case 'add': {
        const entry: MedicationEntry = {
          id: crypto.randomUUID(),
          medication: args.medication as string,
          dosage: args.dosage as string ?? '',
          frequency: args.frequency as string ?? '',
          times: args.times as string[] ?? [],
          notes: args.notes as string,
          active: true,
        };
        medicationStore.push(entry);
        return { action: 'added', medication: entry };
      }
      case 'remove': {
        const idx = medicationStore.findIndex(m => m.medication === args.medication);
        if (idx >= 0) {
          medicationStore[idx].active = false;
          return { action: 'removed', medication: medicationStore[idx] };
        }
        return { action: 'not_found', medication: args.medication };
      }
      case 'list':
        return { medications: medicationStore.filter(m => m.active) };
      case 'update': {
        const med = medicationStore.find(m => m.medication === args.medication && m.active);
        if (med) {
          if (args.dosage) med.dosage = args.dosage as string;
          if (args.frequency) med.frequency = args.frequency as string;
          if (args.times) med.times = args.times as string[];
          if (args.notes) med.notes = args.notes as string;
          return { action: 'updated', medication: med };
        }
        return { action: 'not_found' };
      }
      default:
        return { error: 'Invalid action' };
    }
  },

  async health_metrics_log(args) {
    const entry: MetricEntry = {
      id: crypto.randomUUID(),
      metric: args.metric as string,
      value: args.value as string,
      unit: args.unit as string,
      notes: args.notes as string,
      measuredAt: (args.measuredAt as string) ?? new Date().toISOString(),
    };
    metricsStore.push(entry);

    // Check for abnormal values
    const alerts: string[] = [];
    if (entry.metric === 'blood_pressure') {
      const [sys, dia] = entry.value.split('/').map(Number);
      if (sys >= 140 || dia >= 90) alerts.push('⚠️ Blood pressure is elevated (≥140/90). Please consult your doctor.');
      if (sys >= 180 || dia >= 120) alerts.push('🚨 HYPERTENSIVE CRISIS: Seek emergency care immediately!');
    }
    if (entry.metric === 'blood_sugar') {
      const val = parseFloat(entry.value);
      if (val > 200) alerts.push('⚠️ Blood sugar is very high. Check with your healthcare provider.');
      if (val < 70) alerts.push('⚠️ Blood sugar is low (hypoglycemia). Eat something with sugar immediately.');
    }
    if (entry.metric === 'spo2') {
      const val = parseFloat(entry.value);
      if (val < 95) alerts.push('⚠️ SpO2 below 95%. Monitor closely.');
      if (val < 90) alerts.push('🚨 SpO2 critically low. Seek medical attention immediately!');
    }
    if (entry.metric === 'temperature') {
      const val = parseFloat(entry.value);
      if (val >= 38.5) alerts.push('⚠️ High fever detected. Monitor and consult doctor if persistent.');
      if (val >= 40) alerts.push('🚨 Very high fever! Seek medical attention.');
    }

    return { logged: entry, alerts: alerts.length > 0 ? alerts : undefined };
  },

  async health_metrics_query(args) {
    const metric = args.metric as string;
    const period = (args.period as string) ?? 'month';
    const now = new Date();

    let cutoff = new Date(0);
    switch (period) {
      case 'today': cutoff = new Date(now.toDateString()); break;
      case 'week': cutoff = new Date(now.getTime() - 7 * 86400000); break;
      case 'month': cutoff = new Date(now.getTime() - 30 * 86400000); break;
      case 'year': cutoff = new Date(now.getTime() - 365 * 86400000); break;
    }

    const entries = metricsStore.filter(e =>
      e.metric === metric && new Date(e.measuredAt) >= cutoff
    ).sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

    const values = entries.map(e => parseFloat(e.value)).filter(v => !isNaN(v));
    const stats = values.length > 0 ? {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
      latest: values[values.length - 1],
      count: values.length,
    } : null;

    return {
      metric,
      period,
      entries,
      statistics: stats,
      chartData: entries.map(e => ({ date: e.measuredAt, value: e.value })),
    };
  },

  async appointment_manage(args) {
    const action = args.action as string;

    switch (action) {
      case 'create': {
        const entry: AppointmentEntry = {
          id: crypto.randomUUID(),
          doctor: args.doctor as string ?? '',
          datetime: args.datetime as string ?? '',
          location: args.location as string ?? '',
          reason: args.reason as string ?? '',
          status: 'scheduled',
        };
        appointmentStore.push(entry);
        return { action: 'created', appointment: entry };
      }
      case 'list':
        return { appointments: appointmentStore };
      case 'upcoming':
        return {
          appointments: appointmentStore
            .filter(a => a.status === 'scheduled' && new Date(a.datetime) >= new Date())
            .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()),
        };
      case 'cancel': {
        const apt = appointmentStore.find(a => a.id === args.appointmentId);
        if (apt) { apt.status = 'cancelled'; return { action: 'cancelled', appointment: apt }; }
        return { error: 'Appointment not found' };
      }
      case 'reschedule': {
        const apt = appointmentStore.find(a => a.id === args.appointmentId);
        if (apt) {
          apt.datetime = args.datetime as string;
          return { action: 'rescheduled', appointment: apt };
        }
        return { error: 'Appointment not found' };
      }
      default:
        return { error: 'Invalid action' };
    }
  },

  async medical_record(args) {
    const action = args.action as string;

    switch (action) {
      case 'save': {
        const entry: MedicalRecordEntry = {
          id: crypto.randomUUID(),
          recordType: args.recordType as string ?? 'note',
          content: args.content as string ?? '',
          date: (args.date as string) ?? new Date().toISOString(),
          doctor: args.doctor as string,
          tags: args.tags as string[] ?? [],
        };
        recordStore.push(entry);
        return { action: 'saved', record: entry };
      }
      case 'search': {
        const query = (args.query as string ?? '').toLowerCase();
        const results = recordStore.filter(r =>
          r.content.toLowerCase().includes(query) ||
          r.tags.some(t => t.toLowerCase().includes(query))
        );
        return { results };
      }
      case 'list': {
        const type = args.recordType as string;
        const records = type ? recordStore.filter(r => r.recordType === type) : recordStore;
        return { records };
      }
      case 'get': {
        const record = recordStore.find(r => r.id === args.recordId);
        return record ? { record } : { error: 'Record not found' };
      }
      default:
        return { error: 'Invalid action' };
    }
  },

  async health_report(args) {
    const period = (args.period as string) ?? 'month';
    const sections = args.sections as string[] ?? ['metrics', 'medications', 'appointments', 'records'];

    const report: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      period,
      disclaimer: DISCLAIMER,
    };

    if (sections.includes('metrics')) {
      const metricTypes = [...new Set(metricsStore.map(m => m.metric))];
      report.metrics = metricTypes.map(type => {
        const entries = metricsStore.filter(e => e.metric === type);
        const values = entries.map(e => parseFloat(e.value)).filter(v => !isNaN(v));
        return {
          type,
          count: entries.length,
          latest: entries[entries.length - 1]?.value,
          avg: values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null,
        };
      });
    }

    if (sections.includes('medications')) {
      report.activeMedications = medicationStore.filter(m => m.active);
    }

    if (sections.includes('appointments')) {
      report.upcomingAppointments = appointmentStore
        .filter(a => a.status === 'scheduled' && new Date(a.datetime) >= new Date())
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    }

    if (sections.includes('records')) {
      report.recentRecords = recordStore.slice(-10);
    }

    return report;
  },

  async clinical_note(args) {
    const note = {
      id: crypto.randomUUID(),
      format: 'SOAP',
      subjective: args.subjective as string,
      objective: args.objective as string ?? '',
      assessment: args.assessment as string ?? '',
      plan: args.plan as string ?? '',
      patientId: args.patientId as string,
      createdAt: new Date().toISOString(),
      disclaimer: 'This note was generated with AI assistance. Review and verify all information.',
    };
    return note;
  },

  async icd_lookup(args) {
    const query = (args.query as string).toLowerCase();
    const limit = (args.limit as number) ?? 10;

    const results = ICD10_SUBSET.filter(icd =>
      icd.code.toLowerCase().includes(query) ||
      icd.description.toLowerCase().includes(query)
    ).slice(0, limit);

    return {
      query: args.query,
      results,
      note: 'This is a subset. Connect to a full ICD-10 API for complete coverage.',
    };
  },

  // ═══════════════════════════════════════════════════════════
  // Clinical Alert Tools – Cảnh báo lâm sàng (HL7 FHIR R5)
  // ═══════════════════════════════════════════════════════════

  async allergy_record(args) {
    const action = args.action as string;
    const patientId = args.patientId as string;

    switch (action) {
      case 'add': {
        const substance = args.substance as string;
        if (!substance) return { error: 'Thiếu tên hoạt chất (substance)' };

        const allergyResource = buildAllergyIntolerance({
          patientId,
          substance,
          substanceCode: args.substanceCode as string | undefined,
          criticality: args.criticality as 'low' | 'high' | 'unable-to-assess' | undefined,
          reactions: args.reactions as Array<{ manifestation: string; severity?: 'mild' | 'moderate' | 'severe' }> | undefined,
          recordedBy: args.recordedBy as string | undefined,
          note: args.note as string | undefined,
        });

        const saved = addAllergy(patientId, allergyResource);
        return {
          action: 'added',
          allergy: saved,
          message: `✅ Đã ghi nhận dị ứng "${substance}" cho bệnh nhân ${patientId}.`,
        };
      }
      case 'list': {
        const activeOnly = true;
        const allergies = activeOnly
          ? getActiveAllergies(patientId)
          : getAllAllergies(patientId);
        return {
          patientId,
          count: allergies.length,
          allergies,
          message: allergies.length > 0
            ? `Bệnh nhân có ${allergies.length} dị ứng đang hoạt động.`
            : 'Bệnh nhân chưa có tiền sử dị ứng nào được ghi nhận.',
        };
      }
      case 'remove': {
        const allergyId = args.allergyId as string;
        if (!allergyId) return { error: 'Thiếu allergyId' };
        const removed = removeAllergy(patientId, allergyId);
        return {
          action: removed ? 'removed' : 'not_found',
          message: removed
            ? `Đã đánh dấu dị ứng ${allergyId} là entered-in-error.`
            : `Không tìm thấy dị ứng ${allergyId}.`,
        };
      }
      default:
        return { error: `Action không hợp lệ: ${action}` };
    }
  },

  async prescription_alert_check(args) {
    const patientId = args.patientId as string;
    const medications = args.medications as Array<{
      medicationName: string;
      dosageText?: string;
      route?: string;
      reasonCode?: string;
      reasonDisplay?: string;
      prescriberName?: string;
    }>;

    if (!medications || medications.length === 0) {
      return { error: 'Danh sách thuốc trống' };
    }

    // Xây dựng MedicationRequest FHIR R5
    const medRequests: MedicationRequest[] = medications.map(m =>
      buildMedicationRequest({
        patientId,
        medicationName: m.medicationName,
        dosageText: m.dosageText,
        route: m.route,
        reasonCode: m.reasonCode,
        reasonDisplay: m.reasonDisplay,
        prescriberName: m.prescriberName,
      })
    );

    const result = checkPrescriptionAlerts(patientId, medRequests);
    return {
      ...result,
      instruction: result.hasAlerts
        ? '🛑 ĐƠN THUỐC CÓ CẢNH BÁO. Vui lòng xem xét trước khi xác nhận lưu đơn.'
        : '✅ Đơn thuốc an toàn, không phát hiện xung đột dị ứng.',
    };
  },

  async prescription_quick_check(args) {
    const patientId = args.patientId as string;
    const medicationName = args.medicationName as string;
    return checkSingleMedication(patientId, medicationName);
  },

  async drug_substance_lookup(args) {
    const query = args.query as string;
    const drug = lookupDrug(query);
    if (!drug) {
      return {
        found: false,
        query,
        message: `Không tìm thấy thuốc "${query}" trong CSDL. Kết nối RxNorm API để tra cứu đầy đủ.`,
      };
    }
    return {
      found: true,
      drugCode: drug.drugCode,
      drugDisplay: drug.drugDisplay,
      substances: drug.substances,
      substanceNames: drug.substances.map(s => s.text),
    };
  },

  // ═══════════════════════════════════════════════════════════
  // Knowledge Pack Tools – Tra cứu dữ liệu từ knowledge packs
  // ═══════════════════════════════════════════════════════════

  async drug_interaction_check(args) {
    const drugA = args.drugA as string;
    const drugB = args.drugB as string | undefined;

    if (drugB) {
      const interaction = checkDrugInteraction(drugA, drugB);
      if (!interaction) {
        return {
          found: false,
          drugA,
          drugB,
          message: `Không tìm thấy tương tác giữa "${drugA}" và "${drugB}" trong CSDL knowledge pack.`,
        };
      }
      return { found: true, interaction };
    }

    const interactions = findInteractionsFor(drugA);
    return {
      substance: drugA,
      count: interactions.length,
      interactions,
      message: interactions.length > 0
        ? `Tìm thấy ${interactions.length} tương tác cho "${drugA}".`
        : `Không có tương tác nào được ghi nhận cho "${drugA}" trong CSDL.`,
    };
  },

  async icd10_contraindication_check(args) {
    const icd10Code = args.icd10Code as string;
    const substance = args.substance as string | undefined;

    if (substance) {
      const result = isContraindicated(icd10Code, substance);
      return {
        icd10Code,
        substance,
        contraindicated: result.contraindicated,
        reason: result.reason ?? null,
        severity: result.severity ?? null,
        message: result.contraindicated
          ? `⚠️ "${substance}" bị CHỐNG CHỈ ĐỊNH cho bệnh nhân có mã ICD-10 ${icd10Code}. Lý do: ${result.reason ?? 'N/A'}`
          : `✅ "${substance}" không bị chống chỉ định cho mã ICD-10 ${icd10Code} theo CSDL hiện có.`,
      };
    }

    const rules = checkContraindicationsForDiagnosis(icd10Code);
    return {
      icd10Code,
      count: rules.length,
      contraindications: rules,
      message: rules.length > 0
        ? `Tìm thấy ${rules.length} quy tắc chống chỉ định cho mã ICD-10 ${icd10Code}.`
        : `Không tìm thấy chống chỉ định nào cho mã ICD-10 ${icd10Code} trong CSDL.`,
    };
  },

  async vn_formulary_lookup(args) {
    const query = args.query as string;
    const results = lookupVNFormulary(query);
    return {
      query,
      count: results.length,
      drugs: results,
      message: results.length > 0
        ? `Tìm thấy ${results.length} thuốc phù hợp cho "${query}".`
        : `Không tìm thấy thuốc "${query}" trong danh mục VN. Thử tìm bằng tên generic hoặc tên biệt dược.`,
    };
  },
});

// ═══════════════════════════════════════════════════════════
// Knowledge Pack Auto-Loading
// Tự động nạp dữ liệu từ tất cả knowledge-pack cài đặt
// vào bộ nhớ clinical-alert khi healthcare skill khởi tạo.
// ═══════════════════════════════════════════════════════════

let _knowledgePacksLoaded = false;

export async function loadHealthcareKnowledgePacks(pluginLoader: PluginLoader): Promise<{ loaded: string[]; errors: string[] }> {
  if (_knowledgePacksLoaded) return { loaded: [], errors: [] };

  const packs = pluginLoader.getKnowledgePacksByDomain('healthcare');
  const loaded: string[] = [];
  const errors: string[] = [];

  for (const pack of packs) {
    for (const ds of pack.dataSources) {
      try {
        ingestDataSource(ds.source.kind, ds.data);
        loaded.push(`${pack.manifest.name}/${ds.source.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${pack.manifest.name}/${ds.source.id}: ${msg}`);
      }
    }
  }

  _knowledgePacksLoaded = true;
  const stats = getIngestedStats();
  console.log(`[Healthcare] Knowledge packs loaded: ${loaded.length} sources. Stats:`, stats);
  return { loaded, errors };
}

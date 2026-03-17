// ============================================================
// Substance Database – Ánh xạ thuốc → hoạt chất (active ingredients)
// Dùng làm dữ liệu mẫu; production nên kết nối RxNorm / DrugBank.
// ============================================================

import type { CodeableConcept } from './fhir-r5-types.js';

/** Mỗi thuốc (drug) chứa danh sách hoạt chất (substances). */
export interface DrugSubstanceMapping {
  drugCode: string;      // RxNorm CUI hoặc mã nội bộ
  drugDisplay: string;   // Tên biệt dược / generic
  substances: CodeableConcept[];
}

/**
 * Bảng ánh xạ thuốc → hoạt chất mẫu.
 * Key = drugCode (lowercase), value = mapping.
 */
const DRUG_SUBSTANCE_DB: Map<string, DrugSubstanceMapping> = new Map();

// ── Khởi tạo dữ liệu mẫu ──────────────────────────────────

const SAMPLE_DRUGS: DrugSubstanceMapping[] = [
  {
    drugCode: '723',
    drugDisplay: 'Amoxicillin 500mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '723', display: 'amoxicillin' }], text: 'amoxicillin' },
    ],
  },
  {
    drugCode: '733',
    drugDisplay: 'Ampicillin 250mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '733', display: 'ampicillin' }], text: 'ampicillin' },
    ],
  },
  {
    drugCode: '7980',
    drugDisplay: 'Penicillin V 500mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7980', display: 'penicillin V' }], text: 'penicillin V' },
    ],
  },
  {
    drugCode: '2551',
    drugDisplay: 'Ciprofloxacin 500mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '2551', display: 'ciprofloxacin' }], text: 'ciprofloxacin' },
    ],
  },
  {
    drugCode: '161',
    drugDisplay: 'Acetaminophen 500mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '161', display: 'acetaminophen' }], text: 'acetaminophen' },
    ],
  },
  {
    drugCode: '5640',
    drugDisplay: 'Ibuprofen 400mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '5640', display: 'ibuprofen' }], text: 'ibuprofen' },
    ],
  },
  {
    drugCode: '7052',
    drugDisplay: 'Naproxen 500mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '7052', display: 'naproxen' }], text: 'naproxen' },
    ],
  },
  {
    drugCode: '1191',
    drugDisplay: 'Aspirin 100mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '1191', display: 'aspirin' }], text: 'aspirin' },
    ],
  },
  {
    drugCode: '3640',
    drugDisplay: 'Diclofenac 75mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '3640', display: 'diclofenac' }], text: 'diclofenac' },
    ],
  },
  {
    drugCode: '6809',
    drugDisplay: 'Metformin 850mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '6809', display: 'metformin' }], text: 'metformin' },
    ],
  },
  {
    drugCode: '10582',
    drugDisplay: 'Sulfamethoxazole/Trimethoprim 800/160mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '10207', display: 'sulfamethoxazole' }], text: 'sulfamethoxazole' },
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '10831', display: 'trimethoprim' }], text: 'trimethoprim' },
    ],
  },
  {
    drugCode: 'augmentin',
    drugDisplay: 'Augmentin 625mg (Amoxicillin + Clavulanate)',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '723', display: 'amoxicillin' }], text: 'amoxicillin' },
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '2348', display: 'clavulanate' }], text: 'clavulanate' },
    ],
  },
  {
    drugCode: '4053',
    drugDisplay: 'Enalapril 10mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '4053', display: 'enalapril' }], text: 'enalapril' },
    ],
  },
  {
    drugCode: '29046',
    drugDisplay: 'Lisinopril 10mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '29046', display: 'lisinopril' }], text: 'lisinopril' },
    ],
  },
  {
    drugCode: '321988',
    drugDisplay: 'Cefuroxime 500mg',
    substances: [
      { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '2193', display: 'cefuroxime' }], text: 'cefuroxime' },
    ],
  },
];

// Nhóm dị ứng chéo (cross-reactivity groups)
// Ví dụ: dị ứng penicillin → cảnh báo amoxicillin, ampicillin
const CROSS_REACTIVITY_GROUPS: Record<string, string[]> = {
  // Beta-lactam group
  penicillin: ['penicillin v', 'penicillin g', 'amoxicillin', 'ampicillin', 'clavulanate', 'piperacillin'],
  amoxicillin: ['penicillin v', 'penicillin g', 'ampicillin', 'clavulanate'],
  ampicillin: ['penicillin v', 'penicillin g', 'amoxicillin', 'clavulanate'],
  // NSAID group
  aspirin: ['ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'piroxicam'],
  ibuprofen: ['aspirin', 'naproxen', 'diclofenac'],
  naproxen: ['aspirin', 'ibuprofen', 'diclofenac'],
  // Sulfonamide group
  sulfamethoxazole: ['sulfasalazine', 'sulfadiazine'],
  // ACE inhibitor group (angioedema risk)
  enalapril: ['lisinopril', 'captopril', 'ramipril', 'benazepril'],
  lisinopril: ['enalapril', 'captopril', 'ramipril', 'benazepril'],
};

// ── Populate map ────────────────────────────────────────────

for (const drug of SAMPLE_DRUGS) {
  DRUG_SUBSTANCE_DB.set(drug.drugCode.toLowerCase(), drug);
  // Cũng index theo tên thuốc (lowercase) để dễ tra cứu
  DRUG_SUBSTANCE_DB.set(drug.drugDisplay.toLowerCase(), drug);
}

// ── Public API ──────────────────────────────────────────────

/**
 * Tra cứu thuốc theo mã hoặc tên. Trả về null nếu không tìm thấy.
 */
export function lookupDrug(query: string): DrugSubstanceMapping | null {
  const key = query.toLowerCase();
  // Exact match
  const exact = DRUG_SUBSTANCE_DB.get(key);
  if (exact) return exact;
  // Partial match: tìm record có tên chứa query
  for (const mapping of DRUG_SUBSTANCE_DB.values()) {
    if (mapping.drugDisplay.toLowerCase().includes(key) ||
        mapping.substances.some(s => s.text?.toLowerCase().includes(key))) {
      return mapping;
    }
  }
  return null;
}

/**
 * Trả danh sách hoạt chất (substance text, lowercase) của thuốc.
 */
export function getSubstancesForDrug(query: string): string[] {
  const drug = lookupDrug(query);
  if (!drug) return [];
  return drug.substances.map(s => (s.text ?? s.coding?.[0]?.display ?? '').toLowerCase());
}

/**
 * Kiểm tra xem một hoạt chất dị ứng có dị ứng chéo với hoạt chất thuốc không.
 * Trả về true nếu có khả năng phản ứng chéo.
 */
export function hasCrossReactivity(allergySubstance: string, drugSubstance: string): boolean {
  const allergyKey = allergySubstance.toLowerCase();
  const drugKey = drugSubstance.toLowerCase();
  if (allergyKey === drugKey) return true;
  const crossGroup = CROSS_REACTIVITY_GROUPS[allergyKey];
  if (crossGroup && crossGroup.includes(drugKey)) return true;
  return false;
}

/**
 * Thêm thuốc tuỳ chỉnh vào CSDL (runtime addition).
 */
export function registerDrug(mapping: DrugSubstanceMapping): void {
  DRUG_SUBSTANCE_DB.set(mapping.drugCode.toLowerCase(), mapping);
  DRUG_SUBSTANCE_DB.set(mapping.drugDisplay.toLowerCase(), mapping);
}

/**
 * Thêm / mở rộng nhóm dị ứng chéo (runtime addition từ knowledge pack).
 */
export function registerCrossReactivityGroup(substance: string, crossReactiveWith: string[]): void {
  const key = substance.toLowerCase();
  const existing = CROSS_REACTIVITY_GROUPS[key] ?? [];
  const merged = [...new Set([...existing, ...crossReactiveWith.map(s => s.toLowerCase())])];
  CROSS_REACTIVITY_GROUPS[key] = merged;
}

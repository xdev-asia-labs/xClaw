// ============================================================
// Prescription Alert Engine – Cơ chế cảnh báo lâm sàng
// Phát hiện xung đột dị ứng thuốc trước khi lưu đơn thuốc
// Chuẩn HL7 FHIR R5: AllergyIntolerance + MedicationRequest → DetectedIssue
// ============================================================

declare const crypto: { randomUUID(): string };

import type {
  AllergyIntolerance,
  MedicationRequest,
  DetectedIssue,
  DetectedIssueSeverity,
  CodeableConcept,
  PrescriptionAlertBundle,
} from './fhir-r5-types.js';
import { getActiveAllergies } from './allergy-repository.js';
import { getSubstancesForDrug, hasCrossReactivity, lookupDrug } from './substance-db.js';

// ─── Alert Result ───────────────────────────────────────────

export interface ClinicalAlert {
  /** Có cảnh báo hay không */
  hasAlerts: boolean;
  /** Danh sách DetectedIssue theo chuẩn FHIR R5 */
  issues: DetectedIssue[];
  /** Bundle FHIR chứa đầy đủ tài nguyên liên quan */
  bundle: PrescriptionAlertBundle;
  /** Tóm tắt dạng text cho UI */
  summary: string[];
}

// ─── Helpers ────────────────────────────────────────────────

function extractAllergySubstances(allergy: AllergyIntolerance): string[] {
  const result: string[] = [];
  // Từ trường code (hoạt chất chính)
  if (allergy.code?.text) result.push(allergy.code.text.toLowerCase());
  if (allergy.code?.coding) {
    for (const c of allergy.code.coding) {
      if (c.display) result.push(c.display.toLowerCase());
    }
  }
  // Từ reaction.substance
  if (allergy.reaction) {
    for (const r of allergy.reaction) {
      if (r.substance?.text) result.push(r.substance.text.toLowerCase());
      if (r.substance?.coding) {
        for (const c of r.substance.coding) {
          if (c.display) result.push(c.display.toLowerCase());
        }
      }
    }
  }
  return [...new Set(result)];
}

function mapCriticalityToSeverity(criticality?: string): DetectedIssueSeverity {
  switch (criticality) {
    case 'high': return 'high';
    case 'low': return 'low';
    default: return 'moderate';
  }
}

function buildDetectedIssue(
  patientId: string,
  allergy: AllergyIntolerance,
  medication: MedicationRequest,
  matchedAllergySubstance: string,
  matchedDrugSubstance: string,
  isCrossReactivity: boolean,
): DetectedIssue {
  const severity = mapCriticalityToSeverity(allergy.criticality);
  const directMatch = matchedAllergySubstance === matchedDrugSubstance;
  const matchType = directMatch ? 'trực tiếp' : 'chéo (cross-reactivity)';

  return {
    resourceType: 'DetectedIssue',
    id: crypto.randomUUID(),
    status: 'preliminary',
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'DRG',
        display: 'Drug Interaction Alert',
      }],
      text: 'Cảnh báo tương tác dị ứng thuốc',
    }],
    code: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'DALG',
        display: 'Drug Allergy',
      }],
      text: `Dị ứng thuốc – khớp ${matchType}`,
    },
    severity,
    subject: { reference: `Patient/${patientId}` },
    identified: new Date().toISOString(),
    implicated: [
      { reference: `AllergyIntolerance/${allergy.id}`, display: `Dị ứng: ${matchedAllergySubstance}` },
      { reference: `MedicationRequest/${medication.id}`, display: `Thuốc: ${medication.medication?.text ?? matchedDrugSubstance}` },
    ],
    evidence: [{
      code: [{
        coding: [{
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          display: matchedDrugSubstance,
        }],
        text: `Hoạt chất thuốc: ${matchedDrugSubstance}`,
      }],
    }],
    detail: isCrossReactivity
      ? `⚠️ Bệnh nhân có tiền sử dị ứng với "${matchedAllergySubstance}". Thuốc "${medication.medication?.text}" chứa hoạt chất "${matchedDrugSubstance}" thuộc nhóm dị ứng chéo. Mức nghiêm trọng: ${severity}.`
      : `🚨 Bệnh nhân có tiền sử dị ứng với "${matchedAllergySubstance}". Thuốc "${medication.medication?.text}" chứa chính hoạt chất này. Mức nghiêm trọng: ${severity}.`,
  };
}

// ─── Main Engine ────────────────────────────────────────────

/**
 * Kiểm tra đơn thuốc (MedicationRequest) so với tiền sử dị ứng của bệnh nhân.
 * Trả về danh sách DetectedIssue (FHIR R5) nếu phát hiện xung đột.
 *
 * Quy trình:
 * 1. Lấy danh sách AllergyIntolerance active của bệnh nhân.
 * 2. Với mỗi thuốc trong đơn, tra cứu hoạt chất.
 * 3. So khớp trực tiếp + dị ứng chéo (cross-reactivity).
 * 4. Sinh DetectedIssue cho mỗi xung đột phát hiện được.
 */
export function checkPrescriptionAlerts(
  patientId: string,
  medicationRequests: MedicationRequest[],
): ClinicalAlert {
  const allergies = getActiveAllergies(patientId);
  const issues: DetectedIssue[] = [];
  const involvedAllergies = new Set<AllergyIntolerance>();
  const involvedMedications = new Set<MedicationRequest>();
  const summary: string[] = [];

  if (allergies.length === 0) {
    return {
      hasAlerts: false,
      issues: [],
      bundle: buildBundle([], [], []),
      summary: ['✅ Bệnh nhân không có tiền sử dị ứng thuốc đã ghi nhận.'],
    };
  }

  for (const medReq of medicationRequests) {
    // Xác định hoạt chất của thuốc
    let drugSubstances: string[] = [];

    // Ưu tiên _activeIngredients nếu có
    if (medReq._activeIngredients && medReq._activeIngredients.length > 0) {
      drugSubstances = medReq._activeIngredients.map(s =>
        (s.text ?? s.coding?.[0]?.display ?? '').toLowerCase()
      );
    } else {
      // Tra cứu từ substance DB
      const medName = medReq.medication?.text ?? medReq.medication?.coding?.[0]?.display ?? '';
      drugSubstances = getSubstancesForDrug(medName);
      // Fallback: dùng tên thuốc làm substance
      if (drugSubstances.length === 0 && medName) {
        drugSubstances = [medName.toLowerCase()];
      }
    }

    for (const allergy of allergies) {
      const allergySubstances = extractAllergySubstances(allergy);

      for (const allergySubst of allergySubstances) {
        for (const drugSubst of drugSubstances) {
          if (hasCrossReactivity(allergySubst, drugSubst)) {
            const isCross = allergySubst !== drugSubst;
            const issue = buildDetectedIssue(
              patientId, allergy, medReq,
              allergySubst, drugSubst, isCross,
            );
            issues.push(issue);
            involvedAllergies.add(allergy);
            involvedMedications.add(medReq);

            const drugDisplay = medReq.medication?.text ?? drugSubst;
            summary.push(
              isCross
                ? `⚠️ [Dị ứng chéo] Dị ứng "${allergySubst}" → Thuốc "${drugDisplay}" (chứa "${drugSubst}") – Mức: ${issue.severity}`
                : `🚨 [Dị ứng trực tiếp] Dị ứng "${allergySubst}" → Thuốc "${drugDisplay}" – Mức: ${issue.severity}`
            );
          }
        }
      }
    }
  }

  return {
    hasAlerts: issues.length > 0,
    issues,
    bundle: buildBundle(
      [...involvedAllergies],
      [...involvedMedications],
      issues,
    ),
    summary: issues.length > 0
      ? [`🔴 Phát hiện ${issues.length} cảnh báo dị ứng thuốc:`, ...summary]
      : ['✅ Không phát hiện xung đột dị ứng thuốc.'],
  };
}

/**
 * Kiểm tra nhanh một thuốc duy nhất cho bệnh nhân.
 */
export function checkSingleMedication(
  patientId: string,
  medicationName: string,
): ClinicalAlert {
  const drug = lookupDrug(medicationName);
  const medReq: MedicationRequest = {
    resourceType: 'MedicationRequest',
    id: crypto.randomUUID(),
    status: 'draft',
    intent: 'order',
    medication: drug
      ? { coding: drug.substances[0]?.coding, text: drug.drugDisplay }
      : { text: medicationName },
    subject: { reference: `Patient/${patientId}` },
    authoredOn: new Date().toISOString(),
    _activeIngredients: drug?.substances,
  };
  return checkPrescriptionAlerts(patientId, [medReq]);
}

// ─── Bundle builder ─────────────────────────────────────────

function buildBundle(
  allergies: AllergyIntolerance[],
  medications: MedicationRequest[],
  issues: DetectedIssue[],
): PrescriptionAlertBundle {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: [
      ...allergies.map(r => ({ resource: r })),
      ...medications.map(r => ({ resource: r })),
      ...issues.map(r => ({ resource: r })),
    ],
  };
}

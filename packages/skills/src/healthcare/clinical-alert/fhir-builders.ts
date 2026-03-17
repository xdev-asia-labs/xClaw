// ============================================================
// FHIR R5 Resource Builders – Helper tạo tài nguyên FHIR
// Đơn giản hóa việc xây dựng AllergyIntolerance, MedicationRequest
// ============================================================

declare const crypto: { randomUUID(): string };

import type {
  AllergyIntolerance,
  AllergyIntoleranceCategory,
  AllergyIntoleranceCriticality,
  AllergyIntoleranceSeverity,
  AllergyIntoleranceReaction,
  MedicationRequest,
  MedicationRequestIntent,
  CodeableConcept,
  Dosage,
} from './fhir-r5-types.js';
import { lookupDrug } from './substance-db.js';

// ─── AllergyIntolerance Builder ─────────────────────────────

export interface CreateAllergyInput {
  patientId: string;
  substance: string;          // Tên hoạt chất gây dị ứng
  substanceCode?: string;     // RxNorm code (nếu biết)
  criticality?: AllergyIntoleranceCriticality;
  category?: AllergyIntoleranceCategory;
  reactions?: Array<{
    manifestation: string;    // Biểu hiện (e.g. "rash", "anaphylaxis")
    severity?: AllergyIntoleranceSeverity;
  }>;
  recordedBy?: string;        // Bác sĩ ghi nhận
  note?: string;
}

export function buildAllergyIntolerance(input: CreateAllergyInput): AllergyIntolerance {
  const reactions: AllergyIntoleranceReaction[] = (input.reactions ?? []).map(r => ({
    substance: {
      coding: [{
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: input.substanceCode,
        display: input.substance,
      }],
      text: input.substance,
    },
    manifestation: [{
      coding: [{
        system: 'http://snomed.info/sct',
        display: r.manifestation,
      }],
      text: r.manifestation,
    }],
    severity: r.severity ?? 'moderate',
  }));

  return {
    resourceType: 'AllergyIntolerance',
    id: crypto.randomUUID(),
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
        code: 'active',
        display: 'Active',
      }],
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
        code: 'confirmed',
        display: 'Confirmed',
      }],
    },
    type: 'allergy',
    category: [input.category ?? 'medication'],
    criticality: input.criticality ?? 'unable-to-assess',
    code: {
      coding: [{
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: input.substanceCode,
        display: input.substance,
      }],
      text: input.substance,
    },
    patient: { reference: `Patient/${input.patientId}` },
    recordedDate: new Date().toISOString(),
    participant: input.recordedBy ? [{
      function: {
        coding: [{ system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type', code: 'author' }],
      },
      actor: { display: input.recordedBy },
    }] : undefined,
    note: input.note ? [{ text: input.note }] : undefined,
    reaction: reactions.length > 0 ? reactions : undefined,
  };
}

// ─── MedicationRequest Builder ──────────────────────────────

export interface CreateMedicationRequestInput {
  patientId: string;
  medicationName: string;           // Tên thuốc
  medicationCode?: string;          // RxNorm code
  dosageText?: string;              // e.g. "500mg x 2 lần/ngày"
  route?: string;                   // e.g. "oral"
  intent?: MedicationRequestIntent;
  prescriberId?: string;            // ID bác sĩ kê đơn
  prescriberName?: string;
  reasonCode?: string;              // ICD-10 code
  reasonDisplay?: string;
  note?: string;
}

export function buildMedicationRequest(input: CreateMedicationRequestInput): MedicationRequest {
  // Tra cứu hoạt chất từ substance DB
  const drug = lookupDrug(input.medicationName);

  const medicationConcept: CodeableConcept = drug
    ? { coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: input.medicationCode ?? drug.drugCode, display: drug.drugDisplay }], text: drug.drugDisplay }
    : { coding: input.medicationCode ? [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: input.medicationCode, display: input.medicationName }] : undefined, text: input.medicationName };

  const dosageInstruction: Dosage[] | undefined = input.dosageText ? [{
    text: input.dosageText,
    route: input.route ? { text: input.route } : undefined,
  }] : undefined;

  return {
    resourceType: 'MedicationRequest',
    id: crypto.randomUUID(),
    status: 'draft',
    intent: input.intent ?? 'order',
    medication: medicationConcept,
    subject: { reference: `Patient/${input.patientId}` },
    authoredOn: new Date().toISOString(),
    requester: input.prescriberName
      ? { reference: input.prescriberId ? `Practitioner/${input.prescriberId}` : undefined, display: input.prescriberName }
      : undefined,
    reason: input.reasonCode ? [{
      coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: input.reasonCode, display: input.reasonDisplay }],
      text: input.reasonDisplay,
    }] : undefined,
    dosageInstruction,
    note: input.note ? [{ text: input.note }] : undefined,
    _activeIngredients: drug?.substances,
  };
}

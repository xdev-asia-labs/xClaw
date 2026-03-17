// ============================================================
// HL7 FHIR R5 Type Definitions – Clinical Alert Subsystem
// Chuẩn biểu diễn dữ liệu y tế cho cảnh báo lâm sàng
// Ref: https://hl7.org/fhir/R5/
// ============================================================

// ─── Shared FHIR primitives ────────────────────────────────

/** FHIR CodeableConcept – mã hóa một khái niệm y tế */
export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

export interface Coding {
  system?: string;   // e.g. "http://www.nlm.nih.gov/research/umls/rxnorm"
  code?: string;
  display?: string;
}

export interface Reference {
  reference?: string; // e.g. "Patient/123"
  display?: string;
}

export interface Period {
  start?: string; // ISO date
  end?: string;
}

export interface Annotation {
  authorReference?: Reference;
  time?: string;
  text: string;
}

// ─── FHIR R5 AllergyIntolerance ────────────────────────────
// https://hl7.org/fhir/R5/allergyintolerance.html

export type AllergyIntoleranceClinicalStatus = 'active' | 'inactive' | 'resolved';
export type AllergyIntoleranceVerificationStatus = 'unconfirmed' | 'presumed' | 'confirmed' | 'refuted' | 'entered-in-error';
export type AllergyIntoleranceType = 'allergy' | 'intolerance';
export type AllergyIntoleranceCategory = 'food' | 'medication' | 'environment' | 'biologic';
export type AllergyIntoleranceCriticality = 'low' | 'high' | 'unable-to-assess';
export type AllergyIntoleranceSeverity = 'mild' | 'moderate' | 'severe';

export interface AllergyIntoleranceReaction {
  substance?: CodeableConcept;
  manifestation: CodeableConcept[];
  description?: string;
  onset?: string;
  severity?: AllergyIntoleranceSeverity;
  exposureRoute?: CodeableConcept;
  note?: Annotation[];
}

export interface AllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id?: string;
  clinicalStatus: CodeableConcept;
  verificationStatus: CodeableConcept;
  type?: AllergyIntoleranceType;
  category?: AllergyIntoleranceCategory[];
  criticality?: AllergyIntoleranceCriticality;
  code?: CodeableConcept;          // Hoạt chất gây dị ứng (substance)
  patient: Reference;
  encounter?: Reference;
  onset?: string;                   // ISO datetime or Period
  recordedDate?: string;
  participant?: Array<{
    function?: CodeableConcept;
    actor: Reference;
  }>;
  lastOccurrence?: string;
  note?: Annotation[];
  reaction?: AllergyIntoleranceReaction[];
}

// ─── FHIR R5 MedicationRequest ─────────────────────────────
// https://hl7.org/fhir/R5/medicationrequest.html

export type MedicationRequestStatus = 'active' | 'on-hold' | 'ended' | 'stopped' | 'completed' | 'cancelled' | 'entered-in-error' | 'draft' | 'unknown';
export type MedicationRequestIntent = 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';

export interface Dosage {
  text?: string;
  timing?: {
    repeat?: {
      frequency?: number;
      period?: number;
      periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
    };
    code?: CodeableConcept;
  };
  route?: CodeableConcept;
  doseAndRate?: Array<{
    type?: CodeableConcept;
    doseQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  }>;
}

export interface MedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  status: MedicationRequestStatus;
  intent: MedicationRequestIntent;
  medication: CodeableConcept;      // Thuốc được kê
  subject: Reference;               // Bệnh nhân
  encounter?: Reference;
  authoredOn?: string;              // Ngày kê đơn
  requester?: Reference;            // Bác sĩ kê đơn
  reason?: CodeableConcept[];       // Lý do kê đơn (ICD)
  dosageInstruction?: Dosage[];
  note?: Annotation[];
  /** Danh sách hoạt chất (active ingredients) — extension */
  _activeIngredients?: CodeableConcept[];
}

// ─── FHIR R5 DetectedIssue ─────────────────────────────────
// https://hl7.org/fhir/R5/detectedissue.html

export type DetectedIssueSeverity = 'high' | 'moderate' | 'low';
export type DetectedIssueStatus = 'preliminary' | 'final' | 'entered-in-error' | 'mitigated';

export interface DetectedIssueEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

export interface DetectedIssueMitigation {
  action: CodeableConcept;
  date?: string;
  author?: Reference;
  note?: Annotation[];
}

export interface DetectedIssue {
  resourceType: 'DetectedIssue';
  id?: string;
  status: DetectedIssueStatus;
  category?: CodeableConcept[];
  code?: CodeableConcept;
  severity?: DetectedIssueSeverity;
  subject?: Reference;
  encounter?: Reference;
  identified?: string;              // ISO datetime
  author?: Reference;
  implicated?: Reference[];         // Tài nguyên liên quan (AllergyIntolerance + MedicationRequest)
  evidence?: DetectedIssueEvidence[];
  detail?: string;
  mitigation?: DetectedIssueMitigation[];
}

// ─── FHIR R5 Patient (simplified) ──────────────────────────

export interface Patient {
  resourceType: 'Patient';
  id?: string;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    text?: string;
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

// ─── Aggregate: PrescriptionAlertBundle ─────────────────────

export interface PrescriptionAlertBundle {
  resourceType: 'Bundle';
  type: 'collection';
  timestamp: string;
  entry: Array<{
    resource: AllergyIntolerance | MedicationRequest | DetectedIssue;
  }>;
}

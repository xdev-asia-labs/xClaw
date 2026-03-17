// ============================================================
// Clinical Alert Module – Public API
// ============================================================

export type {
  AllergyIntolerance,
  MedicationRequest,
  DetectedIssue,
  PrescriptionAlertBundle,
  Patient,
  CodeableConcept,
  Coding,
  Reference,
  Dosage,
} from './fhir-r5-types.js';

export { addAllergy, getActiveAllergies, getAllAllergies, removeAllergy } from './allergy-repository.js';
export { lookupDrug, getSubstancesForDrug, hasCrossReactivity, registerDrug, registerCrossReactivityGroup } from './substance-db.js';
export { checkPrescriptionAlerts, checkSingleMedication, type ClinicalAlert } from './prescription-alert-engine.js';
export { buildAllergyIntolerance, buildMedicationRequest, type CreateAllergyInput, type CreateMedicationRequestInput } from './fhir-builders.js';
export {
  ingestDataSource,
  checkDrugInteraction,
  findInteractionsFor,
  checkContraindicationsForDiagnosis,
  isContraindicated,
  lookupVNFormulary,
  getIngestedStats,
} from './knowledge-pack-ingestion.js';

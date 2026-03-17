// ============================================================
// Knowledge Pack Ingestion — Nạp dữ liệu từ knowledge-pack plugins
// vào substance-db, cross-reactivity groups, và drug-interaction engine
// ============================================================

import { registerDrug, registerCrossReactivityGroup } from './substance-db.js';
import type { DrugSubstanceMapping } from './substance-db.js';

// ─── Types matching the JSON data schemas ───────────────────

interface DrugInteractionEntry {
  id: string;
  drugA: { code: string; system: string; display: string };
  drugB: { code: string; system: string; display: string };
  severity: 'high' | 'moderate' | 'low';
  effect: string;
  mechanism: string;
  recommendation: string;
}

interface ICD10ContraindicationEntry {
  id: string;
  icd10: string[];
  icd10Display: string;
  contraindicated: { substance: string; rxnorm: string; reason: string }[];
  severity: 'high' | 'moderate' | 'low';
  notes?: string;
}

interface CrossReactivityGroupEntry {
  id: string;
  name: string;
  description: string;
  members: string[];
  relatedGroups?: string[];
  crossReactivityRate?: string;
  notes?: string;
}

interface VNFormularyEntry {
  id: string;
  brandName: string;
  genericName: string;
  substances: { name: string; rxnorm: string; strength: string }[];
  pharmacoGroup: string;
  atcCode: string;
  dosageForm: string;
  commonDosage: string;
  bhyt: boolean;
  manufacturer?: string;
  notes?: string;
}

// ─── In-memory stores for ingested data ─────────────────────

const drugInteractions: DrugInteractionEntry[] = [];
const icd10Contraindications: ICD10ContraindicationEntry[] = [];
const vnFormulary: VNFormularyEntry[] = [];

// ─── Ingest functions ───────────────────────────────────────

/** Ingest drug-drug interactions data */
export function ingestDrugInteractions(data: { interactions: DrugInteractionEntry[] }): number {
  for (const entry of data.interactions) {
    drugInteractions.push(entry);
  }
  console.log(`[KnowledgePack] Ingested ${data.interactions.length} drug-drug interactions`);
  return data.interactions.length;
}

/** Ingest ICD-10 contraindications */
export function ingestICD10Contraindications(data: { contraindications: ICD10ContraindicationEntry[] }): number {
  for (const entry of data.contraindications) {
    icd10Contraindications.push(entry);
  }
  console.log(`[KnowledgePack] Ingested ${data.contraindications.length} ICD-10 contraindication rules`);
  return data.contraindications.length;
}

/** Ingest cross-reactivity groups into substance-db */
export function ingestCrossReactivityGroups(data: { groups: CrossReactivityGroupEntry[] }): number {
  for (const group of data.groups) {
    // Register each member as having cross-reactivity with all other members
    for (const member of group.members) {
      const others = group.members.filter(m => m !== member);
      registerCrossReactivityGroup(member, others);
    }
  }
  console.log(`[KnowledgePack] Ingested ${data.groups.length} cross-reactivity groups`);
  return data.groups.length;
}

/** Ingest VN drug formulary into substance-db */
export function ingestDrugFormulary(data: { drugs: VNFormularyEntry[] }): number {
  for (const drug of data.drugs) {
    vnFormulary.push(drug);

    // Register each drug into substance-db for lookup
    const mapping: DrugSubstanceMapping = {
      drugCode: drug.id.toLowerCase(),
      drugDisplay: drug.brandName,
      substances: drug.substances.map(s => ({
        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: s.rxnorm, display: s.name }],
        text: s.name,
      })),
    };
    registerDrug(mapping);

    // Also register by generic name for easier lookup
    const genericMapping: DrugSubstanceMapping = {
      ...mapping,
      drugCode: drug.genericName.toLowerCase(),
      drugDisplay: drug.genericName,
    };
    registerDrug(genericMapping);
  }
  console.log(`[KnowledgePack] Ingested ${data.drugs.length} VN formulary drugs into substance-db`);
  return data.drugs.length;
}

// ─── Auto ingest from a loaded data source ──────────────────

/**
 * Route a loaded data source to the correct ingest function based on its kind.
 */
export function ingestDataSource(kind: string, data: unknown): number {
  switch (kind) {
    case 'drug-interactions':
      return ingestDrugInteractions(data as { interactions: DrugInteractionEntry[] });
    case 'icd10-contraindications':
      return ingestICD10Contraindications(data as { contraindications: ICD10ContraindicationEntry[] });
    case 'cross-reactivity':
      return ingestCrossReactivityGroups(data as { groups: CrossReactivityGroupEntry[] });
    case 'drug-formulary':
      return ingestDrugFormulary(data as { drugs: VNFormularyEntry[] });
    default:
      console.warn(`[KnowledgePack] Unknown data source kind: ${kind}`);
      return 0;
  }
}

// ─── Query APIs ─────────────────────────────────────────────

/** Check drug-drug interaction between two substances */
export function checkDrugInteraction(substanceA: string, substanceB: string): DrugInteractionEntry | null {
  const a = substanceA.toLowerCase();
  const b = substanceB.toLowerCase();
  return drugInteractions.find(entry =>
    (entry.drugA.display.toLowerCase() === a && entry.drugB.display.toLowerCase() === b) ||
    (entry.drugA.display.toLowerCase() === b && entry.drugB.display.toLowerCase() === a)
  ) ?? null;
}

/** Check all drug interactions for a given substance */
export function findInteractionsFor(substance: string): DrugInteractionEntry[] {
  const s = substance.toLowerCase();
  return drugInteractions.filter(entry =>
    entry.drugA.display.toLowerCase() === s || entry.drugB.display.toLowerCase() === s
  );
}

/** Check ICD-10 contraindications for a given diagnosis code */
export function checkContraindicationsForDiagnosis(icd10Code: string): ICD10ContraindicationEntry[] {
  const code = icd10Code.toUpperCase();
  return icd10Contraindications.filter(entry =>
    entry.icd10.some(c => code.startsWith(c))
  );
}

/** Check if a substance is contraindicated for a given ICD-10 code */
export function isContraindicated(icd10Code: string, substance: string): { contraindicated: boolean; reason?: string; severity?: string } {
  const code = icd10Code.toUpperCase();
  const sub = substance.toLowerCase();
  for (const entry of icd10Contraindications) {
    if (entry.icd10.some(c => code.startsWith(c))) {
      const match = entry.contraindicated.find(ci => ci.substance.toLowerCase() === sub);
      if (match) {
        return { contraindicated: true, reason: match.reason, severity: entry.severity };
      }
    }
  }
  return { contraindicated: false };
}

/** Lookup VN formulary by brand name or generic name */
export function lookupVNFormulary(query: string): VNFormularyEntry[] {
  const q = query.toLowerCase();
  return vnFormulary.filter(d =>
    d.brandName.toLowerCase().includes(q) ||
    d.genericName.toLowerCase().includes(q) ||
    d.substances.some(s => s.name.toLowerCase().includes(q))
  );
}

/** Get all ingested statistics */
export function getIngestedStats(): { drugInteractions: number; icd10Rules: number; vnFormularyDrugs: number } {
  return {
    drugInteractions: drugInteractions.length,
    icd10Rules: icd10Contraindications.length,
    vnFormularyDrugs: vnFormulary.length,
  };
}

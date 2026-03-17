// ============================================================
// Allergy Repository – Quản lý tiền sử dị ứng bệnh nhân
// In-memory store (thay bằng DB trong production)
// ============================================================

import type { AllergyIntolerance } from './fhir-r5-types.js';

declare const crypto: { randomUUID(): string };

const allergyStore = new Map<string, AllergyIntolerance[]>(); // patientId → allergies

/**
 * Lưu hồ sơ dị ứng cho bệnh nhân.
 * Mỗi record được gắn ID tự sinh.
 */
export function addAllergy(patientId: string, allergy: AllergyIntolerance): AllergyIntolerance {
  allergy.id = allergy.id ?? crypto.randomUUID();
  allergy.patient = { reference: `Patient/${patientId}` };
  allergy.recordedDate = allergy.recordedDate ?? new Date().toISOString();

  const list = allergyStore.get(patientId) ?? [];
  list.push(allergy);
  allergyStore.set(patientId, list);
  return allergy;
}

/**
 * Truy vấn danh sách dị ứng *active* của bệnh nhân.
 * Chỉ trả về những record có clinicalStatus = active.
 */
export function getActiveAllergies(patientId: string): AllergyIntolerance[] {
  const list = allergyStore.get(patientId) ?? [];
  return list.filter(a => {
    const code = a.clinicalStatus?.coding?.[0]?.code;
    return code === 'active';
  });
}

/**
 * Truy vấn tất cả dị ứng (bao gồm inactive, resolved).
 */
export function getAllAllergies(patientId: string): AllergyIntolerance[] {
  return allergyStore.get(patientId) ?? [];
}

/**
 * Xoá dị ứng (đánh dấu entered-in-error).
 */
export function removeAllergy(patientId: string, allergyId: string): boolean {
  const list = allergyStore.get(patientId);
  if (!list) return false;
  const allergy = list.find(a => a.id === allergyId);
  if (!allergy) return false;
  allergy.verificationStatus = {
    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification', code: 'entered-in-error', display: 'Entered in Error' }],
  };
  return true;
}

/**
 * Xoá toàn bộ dữ liệu (dùng cho test).
 */
export function clearAllergyStore(): void {
  allergyStore.clear();
}

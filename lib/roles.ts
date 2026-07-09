export const SALE_PARTNER_ROLE = "sale_partner";

export function normalizeRole(role?: string | null) {
  return String(role ?? "").trim().toLowerCase();
}

export function isSalePartnerRole(role?: string | null) {
  return normalizeRole(role) === SALE_PARTNER_ROLE;
}

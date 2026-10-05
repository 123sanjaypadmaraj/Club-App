/** An admin must always keep at least one verified authenticator, or they would lock themselves out of admin pages. */
export function canRemoveFactor(o: { role: string; verifiedCount: number; adminMfaOff?: boolean }): boolean {
  if (o.verifiedCount <= 0) return false;
  if (o.role === "super_admin" && !o.adminMfaOff && o.verifiedCount <= 1) return false;
  return true;
}

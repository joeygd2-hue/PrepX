/** Age in whole years on `today` (YYYY-MM-DD) for a birth date (YYYY-MM-DD). */
export function ageOn(birth: string, today: string) {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}
export const MIN_AGE = 13;
export const TERMS_VERSION = "2026-10-09";

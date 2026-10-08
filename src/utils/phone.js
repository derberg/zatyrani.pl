// Strip zero-width (U+200B-U+200F), bidi (U+202A-U+202E) and isolate (U+2066-U+2069)
// formatting marks that sneak into phone numbers via copy-paste.
export function cleanPhone(s) {
  return (s || "").replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "").trim();
}

// Normalize a member phone number for storage in `members.phone`.
// Polish numbers (9 digits, optionally prefixed with 0, 48, +48 or 0048)
// become +48XXXXXXXXX, which is the format login lookups match on.
// Other numbers must be given with a leading + (or 00) and are kept as E.164.
// Returns null when the input is not a usable number.
export function normalizeMemberPhone(raw) {
  if (typeof raw !== "string") return null;
  const cleaned = cleanPhone(raw);
  if (!cleaned) return null;
  if (/[^\d\s+()\-.]/.test(cleaned)) return null;

  const international = cleaned.startsWith("+") || cleaned.startsWith("00");
  let digits = cleaned.replace(/\D/g, "");
  if (cleaned.startsWith("00")) digits = digits.slice(2);

  if (!international) {
    if (digits.length === 9) return `+48${digits}`;
    if (digits.length === 10 && digits.startsWith("0")) return `+48${digits.slice(1)}`;
    if (digits.length === 11 && digits.startsWith("48")) return `+${digits}`;
    return null;
  }

  if (digits.startsWith("48")) {
    return digits.length === 11 ? `+${digits}` : null;
  }
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

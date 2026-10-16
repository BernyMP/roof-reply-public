// Format US numbers progressively without making international numbers uneditable.
export function formatPhoneInput(value: string) {
  if (value.startsWith("+") && !value.startsWith("+1")) return value;
  let digits = value.replace(/\D/g, "");
  if (value.startsWith("+") && digits.length <= 1) return value;
  if (
    value.startsWith("+1") ||
    (digits.length === 11 && digits.startsWith("1"))
  ) {
    digits = digits.slice(1);
  }
  if (digits.length > 10) return value;
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatPhoneNumber(phoneNumber?: string | null) {
  if (!phoneNumber) return "Not set";

  const digits = phoneNumber.replace(/\D/g, "");
  const normalized =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (normalized.length !== 10) {
    return phoneNumber;
  }

  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

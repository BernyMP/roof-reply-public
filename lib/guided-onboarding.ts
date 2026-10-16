import { normalizeConsentPhone } from "./account-sms-consent.ts";

export type ServiceArea = { type: "zip" | "city" | "radius"; value: string };
export type BusinessDetails = {
  legalBusinessName: string;
  businessPhone: string;
  website: string;
  serviceAreas: ServiceArea[];
};
export type BusinessForm = {
  legalBusinessName: string;
  businessPhone: string;
  website: string;
  areas: string;
};

export function validSetupPhone(value: string) {
  return /^\+[1-9]\d{9,14}$/.test(normalizeConsentPhone(value));
}

export function normalizeSetupWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function addServiceAreas(existing: ServiceArea[], input: string) {
  const areas = [...existing];
  for (const raw of input.split(/[,\n]/)) {
    const value = raw.trim();
    if (
      value &&
      !areas.some((area) => area.value.toLowerCase() === value.toLowerCase())
    )
      areas.push({ type: /^\d{5}$/.test(value) ? "zip" : "city", value });
  }
  return areas;
}

export function businessFormErrors(form: BusinessForm) {
  const errors: Partial<Record<keyof BusinessForm, string>> = {};
  if (
    !form.legalBusinessName.trim() ||
    form.legalBusinessName.trim().length > 200
  )
    errors.legalBusinessName = "Enter your business name.";
  if (!validSetupPhone(form.businessPhone))
    errors.businessPhone =
      "Enter a valid business phone number, including the area code.";
  if (!form.areas.split(/[,\n]/).some((area) => area.trim()))
    errors.areas = "Add at least one city or ZIP code.";
  else if (form.areas.length > 1000)
    errors.areas =
      "Keep your coverage under 1,000 characters. We can confirm the rest together.";
  if (form.website.trim()) {
    try {
      const url = new URL(normalizeSetupWebsite(form.website));
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !url.hostname.includes(".") ||
        url.username ||
        url.password ||
        /\s/.test(form.website) ||
        form.website.length > 200
      )
        throw new Error();
    } catch {
      errors.website =
        "Enter a website such as yourcompany.com, or leave this blank.";
    }
  }
  return errors;
}

export function businessDetails(
  form: BusinessForm,
  existing: ServiceArea[] = [],
): BusinessDetails {
  const values = [
    ...new Set(
      form.areas
        .split(/[,\n]/)
        .map((area) => area.trim())
        .filter(Boolean),
    ),
  ];
  return {
    legalBusinessName: form.legalBusinessName.trim(),
    businessPhone: normalizeConsentPhone(form.businessPhone),
    website: normalizeSetupWebsite(form.website),
    // Keep original types, including radius coverage, when resuming older setup.
    serviceAreas:
      form.areas === existing.map((area) => area.value).join(", ")
        ? existing
        : values.map(
            (value) =>
              existing.find((area) => area.value === value) || {
                type: /^\d{5}$/.test(value) ? "zip" : "city",
                value,
              },
          ),
  };
}

export function guidedSetupDefaults(existing: {
  aiTone?: string;
  leadHandoffMode?: string;
}) {
  return {
    ...(!existing.aiTone ? { aiTone: "friendly" as const } : {}),
    ...(!existing.leadHandoffMode
      ? { leadHandoffMode: "review_first" as const }
      : {}),
  };
}

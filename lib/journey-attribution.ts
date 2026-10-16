const campaignKeys = [
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
] as const;

// Campaign identifiers only: never forward assessment answers or contact fields.
export function campaignQuery(search: string) {
  const input = new URLSearchParams(search);
  const output = new URLSearchParams();
  for (const key of campaignKeys) {
    const value = input.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,100}$/.test(value)) output.set(key, value);
  }
  return output.toString();
}

export function attributedJourneyHref(href: string, campaign: string) {
  const url = new URL(href, "https://www.roofreply.com");
  if (
    !(url.origin === "https://www.roofreply.com" && ["/calculator", "/specials/pilot", "/rescue-kit"].includes(url.pathname)) &&
    url.origin !== "https://calendly.com"
  ) return href;
  for (const [key, value] of new URLSearchParams(campaignQuery(campaign))) {
    url.searchParams.set(key, value);
  }
  return href.startsWith("/") ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}

export function currentCampaign() {
  if (typeof window === "undefined") return "";
  const campaign = campaignQuery(window.location.search);
  try {
    if (campaign) sessionStorage.setItem("roofreply-campaign", campaign);
    return campaign || campaignQuery(sessionStorage.getItem("roofreply-campaign") ?? "");
  } catch {
    return campaign;
  }
}

export function originalCampaign() {
  const current = currentCampaign();
  try {
    const original = campaignQuery(sessionStorage.getItem("roofreply-original-campaign") ?? "");
    if (!original && current) sessionStorage.setItem("roofreply-original-campaign", current);
    return original || current;
  } catch {
    return current;
  }
}

export const FOUNDING_IMPLEMENTATION_FEE = 1500;
export const FOUNDING_MONTHLY_FEE = 750;
export const FOUNDING_INITIAL_MONTHS = 3;
export const FOUNDING_INITIAL_DAYS = 90;
export const FOUNDING_INCLUDED_FOLLOWUPS = 500;
export const FOUNDING_KICKOFF_PAYMENT =
  FOUNDING_IMPLEMENTATION_FEE + FOUNDING_MONTHLY_FEE;
export const FOUNDING_INITIAL_COMMITMENT =
  FOUNDING_IMPLEMENTATION_FEE + FOUNDING_MONTHLY_FEE * FOUNDING_INITIAL_MONTHS;

const dollars = (value: number) => `$${value.toLocaleString("en-US")}`;
// Historical paid constants above are retained for existing agreements and legacy calculations.
// They do not describe the current acquisition offer or change billing configuration.
export const FREE_FOUNDING_CLIENTS = 5;
export const FREE_FOUNDING_DAYS = 30;
export const FREE_FOUNDING_USAGE_USD = 100;
export const FREE_OFFER_HEADLINE = "Free setup and managed missed-call recovery for our first five qualifying roofing companies.";
export const FREE_OFFER_SUMMARY = "Try RoofReply for up to 30 days, with up to $100 in usage included per company. The free period ends after 30 days or when the usage allowance is reached, whichever comes first. No automatic charges. Any paid continuation requires a separate agreement.";
export const FREE_USAGE_COPY = "RoofReply covers setup and standard provider costs. The $100 allowance counts account-specific messaging registration, number rental, call forwarding, SMS carrier charges and AI usage at provider cost, without markup. Founder setup and support are free and do not reduce the allowance. We confirm applicable costs in your written scope before activation.";
export const FREE_EXIT_COPY = "The 30 days start at verified activation. At the end date or usage limit, we notify your team, stop managed delivery safely and restore the agreed phone routing. Your team takes over outstanding inquiries. Any paid continuation requires a separate written agreement; there is no automatic charge or paid conversion.";
export const EXISTING_AGREEMENTS_COPY = "Existing signed agreements remain governed by their agreed terms. This offer does not change existing obligations.";
export const IMPLEMENTATION_COPY = "Free setup";
export const MONTHLY_MANAGEMENT_COPY = "Free for up to 30 days";
export const INITIAL_COMMITMENT_COPY = "No automatic charges";
export const INCLUDED_FOLLOWUPS_COPY = "Up to $100 in provider usage per company, within the free period";
export const ENTERPRISE_EMAIL = "hello@example.com";
export const ENTERPRISE_CONTACT_URL = `mailto:${ENTERPRISE_EMAIL}?subject=RoofReply%20Enterprise`;
export const ENTERPRISE_SCOPE_COPY = `Need a different scope? Email ${ENTERPRISE_EMAIL}. Any expanded or paid service requires a separate agreement; no automatic overage charges.`;
export const LEGACY_PAYMENT_SCHEDULE_COPY = `${dollars(FOUNDING_KICKOFF_PAYMENT)} at kickoff (implementation plus month one), then ${dollars(FOUNDING_MONTHLY_FEE)} at the start of months two and three. The initial ${FOUNDING_INITIAL_DAYS} days begin on the agreed service activation date.`;
export const PAYMENT_SCHEDULE_COPY = FREE_EXIT_COPY;
export const CORE_PRICE_COPY = `${FREE_OFFER_HEADLINE} ${FREE_OFFER_SUMMARY}`;
export const QUALIFICATION_ASSURANCE_COPY =
  "We review real missed-call activity and useful handoffs with you. The free offer does not guarantee homeowner replies, booked inspections, closed jobs or revenue, and includes no automatic extension.";
export const AUDIT_CTA_LABEL = "Book a 20-minute fit call";
export const AUDIT_CTA_URL =
  "https://calendly.com/example/roofing-audit";
export const ESTIMATE_DISCLAIMER =
  "Illustrative estimates use your selected assumptions, not RoofReply performance benchmarks. Revenue potential is gross, excludes service fees and job costs, and is not guaranteed.";

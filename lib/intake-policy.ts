export interface IntakeDetails {
  name?: string;
  jobType?: string;
  location?: string;
  urgency?: "low" | "medium" | "high";
}
export function hasIntakeDetails(details: IntakeDetails) {
  return Boolean(
    details.name?.trim() &&
    details.jobType?.trim() &&
    details.location?.trim() &&
    details.urgency,
  );
}
export function needsNumericClarification(
  lastReply: string,
  lastQuestion: string,
) {
  return (
    /^(only\s+|just\s+)?(\d+|one|two)[.!\s]*$/i.test(lastReply.trim()) &&
    /leak|water|urgent|urgency|inside|right now/i.test(lastQuestion)
  );
}
export function nextIntakeQuestion(details: IntakeDetails) {
  if (!details.jobType) return "What's going on with your roof?";
  if (!details.urgency) {
    return /leak|water|stain|storm|hail|wind/i.test(details.jobType)
      ? "Is water coming inside now, or are you seeing an older stain?"
      : "Are you planning ahead, or does this need attention soon?";
  }
  if (!details.location) return "What's the property address, including the city?";
  if (!details.name) return "What name should I pass to the team?";
  return "The team will review your details and follow up.";
}
export function repeatsKnownQuestion(message: string, details: IntakeDetails) {
  if (!message.includes("?")) return false;
  return Boolean(
    (details.name &&
      /what.*name|who should|who am i|may i.*name/i.test(message)) ||
    (details.location &&
      /what.*(?:address|city|town|zip)|where.*property|tell.*address/i.test(
        message,
      )) ||
    (details.jobType &&
      /what.*(?:roofing work|going on with.*roof|help.*with)/i.test(message)),
  );
}

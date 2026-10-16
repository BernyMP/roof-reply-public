// Integration gate: the kit is owned by another branch. Enable only after its
// complete, ungated screen/PDF/CSV downloads have passed release checks.
export const FOLLOW_UP_KIT_READY: boolean = false;
export const FOLLOW_UP_REQUESTS = {
  assessment_follow_up_v1: "Want help putting your assessment to work? Leave your work email for three practical follow-up emails, including details of RoofReply’s free founding-client offer. Optional; your report is available now.",
  kit_follow_up_v1: "Want help putting the kit to work? Leave your work email for three practical follow-up emails, including details of RoofReply’s free founding-client offer. Optional; your kit is available now.",
} as const;
export const FOLLOW_UP_VERSION = FOLLOW_UP_KIT_READY ? "kit_follow_up_v1" : "assessment_follow_up_v1";
export const FOLLOW_UP_COPY = FOLLOW_UP_REQUESTS[FOLLOW_UP_VERSION];
export const OFFER_PATH = "/specials/pilot";

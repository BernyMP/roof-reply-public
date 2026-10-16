import {
  hasOwnerConsent,
  readinessBlockers,
  type ReadyAccount,
} from "./automation-policy.ts";
export function accountPresentation(account: ReadyAccount) {
  const liveBlockers = readinessBlockers(account);
  if (account.activationMode === "live" && !liveBlockers.length)
    return {
      label: "Live",
      detail: "Verified live messaging is enabled.",
      attention: false,
    };
  if (account.activationMode === "live")
    return { label: "Review needed", detail: liveBlockers[0], attention: true };
  if (account.activationMode === "rehearsal") {
    const blockers = readinessBlockers(account, false);
    return {
      label: blockers.length ? "Rehearsal needs review" : "Rehearsal only",
      detail:
        blockers[0] ||
        "Restricted testing is enabled. Live customer messaging is not enabled.",
      attention: blockers.length > 0,
    };
  }
  return {
    label: "Paused",
    detail:
      liveBlockers[0] ||
      "Checks are complete. Your operator can review live activation.",
    attention: true,
  };
}

export function customerSetupPresentation(account: ReadyAccount) {
  const blockers = readinessBlockers(account);
  const live = account.activationMode === "live" && blockers.length === 0;
  const needsConsent = !hasOwnerConsent(account);
  const configurationReady = readinessBlockers(account, false).length === 0;
  const verified = blockers.length === 0;
  return {
    live,
    needsConsent,
    configurationReady,
    verified,
    label: live
      ? "Live"
      : account.activationMode === "live"
        ? "Messaging needs review"
        : account.activationMode === "rehearsal"
          ? "Test mode"
          : verified
            ? "Messaging paused"
            : "Setup in progress",
    title: live
      ? "Ready for your next opportunity"
      : needsConsent
        ? "Confirm where your lead alerts go"
        : verified
          ? "Ready for our final review"
          : "Your details are saved",
    detail: live
      ? "Missed-call recovery is enabled. Review new leads and follow up with homeowners here."
      : needsConsent
        ? "Check your mobile number and SMS permission so we can send setup texts and lead alerts."
        : configurationReady
          ? "We’ll finish checking call forwarding and delivery with you before enabling live messaging."
          : "We’ll prepare your number, review your preferences, and arrange a test with you. Live messaging is not enabled.",
    nextStep: needsConsent
      ? "Your next step"
      : live
        ? "Your service"
        : "Next step · RoofReply",
    actionLabel: needsConsent
      ? "Confirm alert phone"
      : live
        ? "Review leads"
        : "Contact Berny",
    actionHref: needsConsent
      ? "/dashboard/config#handoff"
      : live
        ? "/dashboard/leads"
        : "mailto:hello@example.com",
  };
}

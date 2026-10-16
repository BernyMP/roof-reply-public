export function buildTestSmsMessage(roofReplyNumber: string) {
  return [
    "RoofReply test message",
    "",
    "Please confirm this message arrived.",
    `Missed calls forwarded to ${roofReplyNumber} can start a conversation when your operator enables messaging.`,
    "",
    "Reply STOP to opt out.",
  ].join("\n");
}

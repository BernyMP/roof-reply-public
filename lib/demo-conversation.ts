export function demoOpening(businessName: string) {
  return `RoofReply demo for ${businessName}.\n\nHi, sorry we missed your call. What's going on with your roof?\n\nReply STOP to opt out.`;
}

export function isClosingAcknowledgment(text: string) {
  return /^(?:(?:ok(?:ay)?|thanks(?: so much)?|thank you(?: so much)?|done|got it|sounds good|perfect|great|sure|yes|no|👍|🙏)[.! ,\s]*)+$/i.test(
    text.trim(),
  );
}

export function validateSocialPng(bytes: Uint8Array) {
  if (
    bytes.byteLength < 24 ||
    bytes.byteLength > 8_000_000 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  )
    throw new Error(
      "Social image is not a valid PNG or exceeds the size limit.",
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(16) !== 1080 || view.getUint32(20) !== 1350)
    throw new Error("Social image must be 1080 × 1350.");
}

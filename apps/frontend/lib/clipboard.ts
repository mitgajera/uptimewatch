/**
 * Copy text, rejecting (rather than throwing synchronously) when the Clipboard
 * API is unavailable, e.g. on a non-HTTPS deployment.
 */
export async function copyText(text: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard unavailable");
  }
  await navigator.clipboard.writeText(text);
}

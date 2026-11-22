// Local dev against a throwaway database on the same cluster, so testing
// never touches production data. Usage: bun run scripts/dev-isolated.ts
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

const devDb = process.env.DEV_DB_NAME ?? "uptimewatch_dev";
process.env.MONGODB_URI = uri.replace(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(\/[^?]*)?/, `$1/${devDb}`);
process.env.DNS_CHECK_SERVERS ??= "1.1.1.1,8.8.8.8";

// Trust the same Clerk instance the local frontend signs in with.
if (!process.env.CLERK_ISSUER && !process.env.CLERK_PUBLISHABLE_KEY) {
  const env = await Bun.file(new URL("../../frontend/.env.local", import.meta.url)).text().catch(() => "");
  const key = env.match(/^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim();
  if (key) process.env.CLERK_PUBLISHABLE_KEY = key;
}
console.log(`[dev] using database "${devDb}"`);

await import("../index");

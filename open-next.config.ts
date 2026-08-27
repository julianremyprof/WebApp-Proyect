import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

// Keeps the Next.js data/route cache on Cloudflare KV (see wrangler.jsonc
// binding NEXT_CACHE_WORKERS_KV) instead of the filesystem, which Workers
// does not have. This is the standard setup for the Workers Free plan.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});

import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

// Ships with the default (in-memory, non-persistent) cache so a first
// deploy works with zero extra Cloudflare setup. Once you've created the
// KV namespace (see wrangler.jsonc), uncomment the import above and the
// `incrementalCache` option below to persist the Next.js data/route cache
// across requests on the Workers Free plan.
export default defineCloudflareConfig({
  // incrementalCache: kvIncrementalCache,
});

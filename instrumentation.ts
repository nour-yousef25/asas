/** W02: install server-only tenant authority before request handling; browser runtimes are excluded. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapTenantRuntime } = await import("./src/lib/tenant-runtime-bootstrap");
  bootstrapTenantRuntime();
}

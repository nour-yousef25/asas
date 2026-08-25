import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";
import type { TenantArtifactProvider } from "@/lib/private-artifact";

export class LocalTenantArtifactError extends Error {
  constructor(public readonly code: "ROOT_DENIED" | "OBJECT_SCOPE_DENIED" | "DELIVERY_DENIED" | "FILE_DENIED") { super(`LOCAL_TENANT_ARTIFACT_${code}`); }
}

const identifier = /^[A-Za-z0-9_-]{12,160}$/;
const keyPattern = /^private\/([A-Za-z0-9_-]+)\/artifact\/([A-Za-z0-9_-]+)\/v([1-9][0-9]*)$/;
const deliveryPayloadSchema = z.object({ organizationId: z.string().regex(identifier), artifactId: z.string().regex(identifier), objectKey: z.string().regex(keyPattern), expiresAt: z.number().int().positive(), nonce: z.string().min(16).max(180) });

function canonicalObjectKey(organizationId: string, artifactId: string, objectKey: string) {
  const match = keyPattern.exec(objectKey);
  if (!identifier.test(organizationId) || !identifier.test(artifactId) || !match || match[1] !== organizationId || match[2] !== artifactId) throw new LocalTenantArtifactError("OBJECT_SCOPE_DENIED");
  return objectKey;
}

function encode(value: unknown) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
function decode(value: string) { return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown; }

export class LocalTenantArtifactProvider implements TenantArtifactProvider {
  constructor(private readonly rootDirectory: string, private readonly deliverySecret: string, private readonly deliveryPath = "/api/documents/delivery", private readonly now: () => Date = () => new Date(), private readonly expectedRootUid = 0) {
    if (!isAbsolute(rootDirectory) || deliverySecret.length < 32 || !deliveryPath.startsWith("/")) throw new LocalTenantArtifactError("ROOT_DENIED");
  }

  private async root() {
    const details = await stat(this.rootDirectory).catch(() => undefined);
    if (!details?.isDirectory() || details.uid !== this.expectedRootUid || (details.mode & 0o007) !== 0 || (details.mode & 0o002) !== 0) throw new LocalTenantArtifactError("ROOT_DENIED");
    return this.rootDirectory;
  }

  async assertReady() { await this.root(); }

  private async location(organizationId: string, artifactId: string, objectKey: string) {
    const key = canonicalObjectKey(organizationId, artifactId, objectKey);
    const root = await this.root();
    const location = resolve(root, ...key.split("/"));
    if (!location.startsWith(`${root}/`) || basename(location) !== /^v[1-9][0-9]*$/.exec(basename(location))?.[0]) throw new LocalTenantArtifactError("OBJECT_SCOPE_DENIED");
    return location;
  }

  private sign(payload: string) { return createHmac("sha256", this.deliverySecret).update(payload).digest("base64url"); }

  async put(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string; data: Uint8Array; contentType: string }>) {
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(input.contentType)) throw new LocalTenantArtifactError("OBJECT_SCOPE_DENIED");
    const location = await this.location(input.organizationId, input.artifactId, input.objectKey);
    await mkdir(dirname(location), { recursive: true, mode: 0o750 });
    const temporary = `${location}.${randomBytes(12).toString("hex")}.tmp`;
    try { await writeFile(temporary, input.data, { mode: 0o640, flag: "wx" }); await rename(temporary, location); } catch (error) { await rm(temporary, { force: true }).catch(() => undefined); throw error; }
  }

  async delete(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string }>) {
    await rm(await this.location(input.organizationId, input.artifactId, input.objectKey), { force: true });
  }

  async issueDelivery(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string; expiresInSeconds: number }>) {
    if (!Number.isInteger(input.expiresInSeconds) || input.expiresInSeconds < 1 || input.expiresInSeconds > 300) throw new LocalTenantArtifactError("DELIVERY_DENIED");
    await this.location(input.organizationId, input.artifactId, input.objectKey);
    const expiresAt = new Date(this.now().getTime() + input.expiresInSeconds * 1_000);
    const payload = encode({ organizationId: input.organizationId, artifactId: input.artifactId, objectKey: input.objectKey, expiresAt: expiresAt.getTime(), nonce: randomBytes(24).toString("base64url") });
    return { delivery: `${this.deliveryPath}?token=${encodeURIComponent(`${payload}.${this.sign(payload)}`)}`, expiresAt };
  }

  async resolveDelivery(token: string, organizationId: string) {
    const [payload, signature, ...extra] = token.split(".");
    if (!payload || !signature || extra.length) throw new LocalTenantArtifactError("DELIVERY_DENIED");
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new LocalTenantArtifactError("DELIVERY_DENIED");
    let parsed: z.infer<typeof deliveryPayloadSchema>;
    try { parsed = deliveryPayloadSchema.parse(decode(payload)); } catch { throw new LocalTenantArtifactError("DELIVERY_DENIED"); }
    if (parsed.organizationId !== organizationId || parsed.expiresAt <= this.now().getTime()) throw new LocalTenantArtifactError("DELIVERY_DENIED");
    try { return { data: await readFile(await this.location(parsed.organizationId, parsed.artifactId, parsed.objectKey)), artifactId: parsed.artifactId }; } catch { throw new LocalTenantArtifactError("FILE_DENIED"); }
  }

  async probe(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string }>) { await stat(await this.location(input.organizationId, input.artifactId, input.objectKey)); }
}

let installedLocalProvider: LocalTenantArtifactProvider | undefined;
export function installLocalTenantArtifactProvider(provider: LocalTenantArtifactProvider) { if (installedLocalProvider) throw new LocalTenantArtifactError("ROOT_DENIED"); installedLocalProvider = provider; }
export function requireLocalTenantArtifactProvider() { if (!installedLocalProvider) throw new LocalTenantArtifactError("DELIVERY_DENIED"); return installedLocalProvider; }

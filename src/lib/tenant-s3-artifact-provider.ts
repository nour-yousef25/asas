import { createHash, createHmac } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { TenantArtifactProvider } from "@/lib/private-artifact";
import { opaqueSecretReference, type OpaqueSecretReference } from "@/lib/w02-security-contracts";

export class TenantStorageProviderError extends Error {
  constructor(public readonly code: "UNCONFIGURED" | "REFERENCE_DENIED" | "CREDENTIAL_DENIED" | "OBJECT_SCOPE_DENIED" | "PROVIDER_REJECTED") {
    super(`TENANT_STORAGE_${code}`);
  }
}

export type TenantS3Credential = Readonly<{
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}>;

export type TenantStorageReferenceResolver = Readonly<{
  resolve(organizationId: string): Promise<OpaqueSecretReference>;
}>;

export type TenantStorageCredentialResolver = Readonly<{
  resolve(input: Readonly<{ organizationId: string; reference: OpaqueSecretReference }>): Promise<TenantS3Credential>;
}>;

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function requiredString(value: unknown, code: TenantStorageProviderError["code"]) {
  if (typeof value !== "string" || !value.trim()) throw new TenantStorageProviderError(code);
  return value.trim();
}

function canonicalObjectKey(organizationId: string, artifactId: string, objectKey: string) {
  const prefix = `private/${organizationId}/artifact/${artifactId}/`;
  if (!objectKey.startsWith(prefix) || !/^private\/[A-Za-z0-9_-]+\/artifact\/[A-Za-z0-9_-]+\/v[1-9][0-9]*$/.test(objectKey)) {
    throw new TenantStorageProviderError("OBJECT_SCOPE_DENIED");
  }
  return objectKey;
}

function encodedPath(bucket: string, objectKey: string) {
  return `/${[bucket, ...objectKey.split("/")].map((part) => encodeURIComponent(part)).join("/")}`;
}

function isoDate(now: Date) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function dateStamp(now: Date) { return isoDate(now).slice(0, 8); }

function canonicalQuery(input: Record<string, string>) {
  return Object.entries(input).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}

function ensureHttps(url: URL) {
  if (url.protocol !== "https:") throw new TenantStorageProviderError("CREDENTIAL_DENIED");
  return url;
}

function normalizeCredential(input: TenantS3Credential) {
  const endpoint = ensureHttps(new URL(requiredString(input.endpoint, "CREDENTIAL_DENIED")));
  return {
    endpoint,
    region: requiredString(input.region, "CREDENTIAL_DENIED"),
    bucket: requiredString(input.bucket, "CREDENTIAL_DENIED"),
    accessKeyId: requiredString(input.accessKeyId, "CREDENTIAL_DENIED"),
    secretAccessKey: requiredString(input.secretAccessKey, "CREDENTIAL_DENIED"),
  };
}

function signingKey(secret: string, stamp: string, region: string) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, stamp), region), "s3"), "aws4_request");
}

function authorization(input: Readonly<{ credential: ReturnType<typeof normalizeCredential>; method: string; path: string; query: string; payloadHash: string; contentType?: string; now: Date }>) {
  const amzDate = isoDate(input.now);
  const host = input.credential.endpoint.host;
  const headers: Record<string, string> = { host, "x-amz-content-sha256": input.payloadHash, "x-amz-date": amzDate };
  if (input.contentType) headers["content-type"] = input.contentType;
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${headers[name]}\n`).join("");
  const scope = `${dateStamp(input.now)}/${input.credential.region}/s3/aws4_request`;
  const canonicalRequest = [input.method, input.path, input.query, canonicalHeaders, signedHeaders.join(";"), input.payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", signingKey(input.credential.secretAccessKey, dateStamp(input.now), input.credential.region)).update(stringToSign).digest("hex");
  return { headers, authorization: `AWS4-HMAC-SHA256 Credential=${input.credential.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`, amzDate, scope };
}

async function readPrivateFile(path: string, allowedReadGroupId?: number) {
  const details = await stat(path).catch(() => undefined);
  if (!details || !details.isFile() || (details.mode & 0o007) !== 0 || details.mode & 0o020 || (details.mode & 0o060) === 0) throw new TenantStorageProviderError("CREDENTIAL_DENIED");
  const ownerOnly = (details.mode & 0o777) === 0o600;
  const approvedGroupRead = allowedReadGroupId !== undefined && details.uid === 0 && details.gid === allowedReadGroupId && (details.mode & 0o777) === 0o640;
  if (!ownerOnly && !approvedGroupRead) throw new TenantStorageProviderError("CREDENTIAL_DENIED");
  return readFile(path, "utf8");
}

function fileName(reference: OpaqueSecretReference) {
  const value = String(reference);
  if (!/^secretref:[A-Za-z0-9._:-]{12,256}$/.test(value)) throw new TenantStorageProviderError("REFERENCE_DENIED");
  return createHash("sha256").update(value).digest("hex");
}

export class FileTenantStorageReferenceResolver implements TenantStorageReferenceResolver {
  constructor(private readonly directory: string, private readonly allowedReadGroupId?: number) {}
  async resolve(organizationId: string) {
    if (!/^[A-Za-z0-9_-]{12,160}$/.test(organizationId)) throw new TenantStorageProviderError("REFERENCE_DENIED");
    const value = (await readPrivateFile(`${this.directory}/${organizationId}.ref`, this.allowedReadGroupId)).trim();
    return opaqueSecretReference(value);
  }
}

export class FileTenantS3CredentialResolver implements TenantStorageCredentialResolver {
  constructor(private readonly directory: string, private readonly allowedReadGroupId?: number) {}
  async resolve(input: Readonly<{ organizationId: string; reference: OpaqueSecretReference }>) {
    const raw = await readPrivateFile(`${this.directory}/${fileName(input.reference)}.json`, this.allowedReadGroupId);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new TenantStorageProviderError("CREDENTIAL_DENIED"); }
    if (!parsed || typeof parsed !== "object") throw new TenantStorageProviderError("CREDENTIAL_DENIED");
    const value = parsed as Record<string, unknown>;
    return {
      endpoint: requiredString(value.endpoint, "CREDENTIAL_DENIED"),
      region: requiredString(value.region, "CREDENTIAL_DENIED"),
      bucket: requiredString(value.bucket, "CREDENTIAL_DENIED"),
      accessKeyId: requiredString(value.accessKeyId, "CREDENTIAL_DENIED"),
      secretAccessKey: requiredString(value.secretAccessKey, "CREDENTIAL_DENIED"),
    };
  }
}

export class TenantS3ArtifactProvider implements TenantArtifactProvider {
  constructor(
    private readonly references: TenantStorageReferenceResolver,
    private readonly credentials: TenantStorageCredentialResolver,
    private readonly fetcher: FetchLike = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async request(organizationId: string, artifactId: string, objectKey: string, method: "PUT" | "DELETE" | "HEAD", body?: Uint8Array, contentType?: string) {
    const credential = normalizeCredential(await this.credentials.resolve({ organizationId, reference: await this.references.resolve(organizationId) }));
    const path = encodedPath(credential.bucket, canonicalObjectKey(organizationId, artifactId, objectKey));
    const signature = authorization({ credential, method, path, query: "", payloadHash: sha256(body ?? ""), contentType, now: this.now() });
    const url = new URL(path, credential.endpoint);
    const response = await this.fetcher(url, { method, headers: { ...signature.headers, authorization: signature.authorization }, body: body as unknown as BodyInit | undefined });
    if (!response.ok) throw new TenantStorageProviderError("PROVIDER_REJECTED");
  }

  async put(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string; data: Uint8Array; contentType: string }>) {
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(input.contentType)) throw new TenantStorageProviderError("OBJECT_SCOPE_DENIED");
    await this.request(input.organizationId, input.artifactId, input.objectKey, "PUT", input.data, input.contentType);
  }

  async delete(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string }>) {
    await this.request(input.organizationId, input.artifactId, input.objectKey, "DELETE");
  }

  async issueDelivery(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string; expiresInSeconds: number }>) {
    if (!Number.isInteger(input.expiresInSeconds) || input.expiresInSeconds < 1 || input.expiresInSeconds > 300) throw new TenantStorageProviderError("OBJECT_SCOPE_DENIED");
    const credential = normalizeCredential(await this.credentials.resolve({ organizationId: input.organizationId, reference: await this.references.resolve(input.organizationId) }));
    const now = this.now();
    const path = encodedPath(credential.bucket, canonicalObjectKey(input.organizationId, input.artifactId, input.objectKey));
    const scope = `${dateStamp(now)}/${credential.region}/s3/aws4_request`;
    const queryValues = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${credential.accessKeyId}/${scope}`, "X-Amz-Date": isoDate(now), "X-Amz-Expires": String(input.expiresInSeconds), "X-Amz-SignedHeaders": "host" };
    const query = canonicalQuery(queryValues);
    const canonicalRequest = ["GET", path, query, `host:${credential.endpoint.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
    const stringToSign = ["AWS4-HMAC-SHA256", isoDate(now), scope, sha256(canonicalRequest)].join("\n");
    const signature = createHmac("sha256", signingKey(credential.secretAccessKey, dateStamp(now), credential.region)).update(stringToSign).digest("hex");
    const url = new URL(path, credential.endpoint);
    url.search = `${query}&X-Amz-Signature=${signature}`;
    return { delivery: url.toString(), expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000) };
  }

  async probe(input: Readonly<{ organizationId: string; artifactId: string; objectKey: string }>) {
    await this.request(input.organizationId, input.artifactId, input.objectKey, "HEAD");
  }
}

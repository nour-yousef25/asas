interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}

function getS3Config(): S3Config {
  return {
    endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
    accessKey: process.env.S3_ACCESS_KEY || "minioadmin",
    secretKey: process.env.S3_SECRET_KEY || "minioadmin123",
    bucket: process.env.S3_BUCKET || "asas",
    region: process.env.S3_REGION || "sa-east-1",
  };
}

async function signRequest(
  method: string,
  path: string,
  contentType?: string
): Promise<{ url: string; headers: Record<string, string> }> {
  const config = getS3Config();
  const url = `${config.endpoint}/${config.bucket}${path}`;
  const headers: Record<string, string> = {};

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const date = new Date().toUTCString();
  headers["Date"] = date;

  const stringToSign = `${method}\n\n${contentType || ""}\n${date}\n/${config.bucket}${path}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(config.secretKey);
  const msgData = encoder.encode(stringToSign);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, msgData);
  const signatureHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  headers["Authorization"] = `AWS ${config.accessKey}:${signatureHex}`;

  return { url, headers };
}

export async function uploadFile(
  path: string,
  data: ArrayBuffer,
  contentType: string
): Promise<{ url: string; path: string }> {
  const config = getS3Config();
  const { url, headers } = await signRequest("PUT", path, contentType);

  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: data,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return {
    url: `${config.endpoint}/${config.bucket}${path}`,
    path,
  };
}

export async function deleteFile(path: string): Promise<void> {
  const { url, headers } = await signRequest("DELETE", path);

  const response = await fetch(url, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error(`Delete failed: ${response.statusText}`);
  }
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const config = getS3Config();
  return `${config.endpoint}/${config.bucket}${path}`;
}

export function getPublicUrl(path: string): string {
  const config = getS3Config();
  return `${config.endpoint}/${config.bucket}${path}`;
}

export const STORAGE_PATHS = {
  documents: (id: string, filename: string) => `documents/${id}/${filename}`,
  avatars: (id: string, ext: string) => `avatars/${id}.${ext}`,
  news: (id: string, filename: string) => `news/${id}/${filename}`,
  projects: (id: string, filename: string) => `projects/${id}/${filename}`,
  gallery: (albumId: string, filename: string) => `gallery/${albumId}/${filename}`,
  temporary: (filename: string) => `temporary/${filename}`,
} as const;

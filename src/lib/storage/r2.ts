// Cloudflare R2 signed-URL helpers. R2 is S3-compatible, so we drive it
// with the AWS SDK v3 + the s3-request-presigner. Architecture §11 / §3.2.
//
// Auth model:
//   - Uploads from the browser → server signs a PUT URL with content-type
//     and length pinned; client uploads directly, never streaming the file
//     through our app.
//   - Downloads of sensitive documents → server signs a short-lived GET URL
//     scoped to a single object.
//   - Non-sensitive public assets (e.g. marketing images) → served from the
//     R2 public bucket via getPublicUrl, no signing.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Config / client
// ---------------------------------------------------------------------------

/**
 * MIME types allowed for document uploads (FR-3.5 docs are insurance COIs,
 * registrations, etc — almost always PDF or photo).
 */
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

export type AllowedUploadContentType = (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

const ALLOWED_UPLOAD_CT_SET: ReadonlySet<string> = new Set<string>(ALLOWED_UPLOAD_CONTENT_TYPES);

/** 15 minutes — long enough for the browser to upload, short enough that
 *  a leaked URL has limited blast radius. */
export const DEFAULT_UPLOAD_EXPIRES_IN_SECONDS = 15 * 60;

/** 1 hour — for download URLs surfaced in admin doc-review UI. */
export const DEFAULT_DOWNLOAD_EXPIRES_IN_SECONDS = 60 * 60;

/** Hard cap on signed-URL lifetime — Cloudflare R2 supports up to 7 days. */
export const MAX_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

/** Hard cap on uploaded file size for documents (10 MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class R2ConfigError extends Error {
  override readonly name = "R2ConfigError";
}

export class R2ValidationError extends Error {
  override readonly name = "R2ValidationError";
}

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrlBase?: string;
}

function readConfig(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrlBase = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new R2ConfigError(
      "R2 env vars missing: require R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrlBase };
}

/**
 * Build the S3 client lazily — env vars must be present, but only at the
 * first call. Test setups override the client via dependency injection
 * (see getR2Client).
 */
let _client: S3Client | null = null;
let _bucketName: string | null = null;

export function getR2Client(): { client: S3Client; bucketName: string } {
  if (_client && _bucketName) return { client: _client, bucketName: _bucketName };

  const cfg = readConfig();
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  _bucketName = cfg.bucketName;
  return { client: _client, bucketName: _bucketName };
}

/** Test seam — reset the cached client. NOT for production use. */
export function __resetR2ClientForTests(): void {
  _client = null;
  _bucketName = null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SignedUploadInput {
  key: string;
  contentType: string;
  contentLength: number;
  expiresIn?: number;
}

export async function getSignedUploadUrl(input: SignedUploadInput): Promise<string> {
  validateKey(input.key);
  if (!ALLOWED_UPLOAD_CT_SET.has(input.contentType)) {
    throw new R2ValidationError(
      `Content-Type '${input.contentType}' is not in the allowed upload list (${ALLOWED_UPLOAD_CONTENT_TYPES.join(", ")})`,
    );
  }
  if (
    !Number.isFinite(input.contentLength) ||
    input.contentLength <= 0 ||
    input.contentLength > MAX_UPLOAD_BYTES
  ) {
    throw new R2ValidationError(
      `contentLength must be 1..${MAX_UPLOAD_BYTES} bytes, got ${input.contentLength}`,
    );
  }
  const expiresIn = clampExpires(input.expiresIn ?? DEFAULT_UPLOAD_EXPIRES_IN_SECONDS);

  const { client, bucketName } = getR2Client();
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export interface SignedDownloadInput {
  key: string;
  expiresIn?: number;
}

export async function getSignedDownloadUrl(input: SignedDownloadInput): Promise<string> {
  validateKey(input.key);
  const expiresIn = clampExpires(input.expiresIn ?? DEFAULT_DOWNLOAD_EXPIRES_IN_SECONDS);

  const { client, bucketName } = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: input.key,
  });
  return getSignedUrl(client, command, { expiresIn });
}

export interface DeleteInput {
  key: string;
}

export async function deleteObject(input: DeleteInput): Promise<void> {
  validateKey(input.key);
  const { client, bucketName } = getR2Client();
  const command = new DeleteObjectCommand({ Bucket: bucketName, Key: input.key });
  await client.send(command);
}

/**
 * Build a public URL for a non-sensitive object. Requires R2_PUBLIC_URL env
 * to be set to the public bucket base (e.g.
 * `https://pub-xxxx.r2.dev` or a custom domain).
 *
 * NEVER use this for documents, holder photos, or anything PII. Reserve
 * for marketing assets only.
 */
export function getPublicUrl(key: string): string {
  validateKey(key);
  const base = process.env.R2_PUBLIC_URL;
  if (!base) {
    throw new R2ConfigError(
      "R2_PUBLIC_URL is required to build public URLs (set to the R2 public bucket base)",
    );
  }
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedKey = key.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedKey}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) {
    throw new R2ValidationError(`Object key must be a non-empty string, got ${String(key)}`);
  }
  if (key.length > 1024) {
    throw new R2ValidationError(`Object key exceeds 1024 chars (S3 limit), got ${key.length}`);
  }
  if (key.includes("..") || key.startsWith("/")) {
    // Defend against path traversal in keys constructed from user input.
    throw new R2ValidationError(`Object key '${key}' contains illegal pattern`);
  }
}

function clampExpires(expiresIn: number): number {
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new R2ValidationError(`expiresIn must be > 0 seconds, got ${expiresIn}`);
  }
  if (expiresIn > MAX_EXPIRES_IN_SECONDS) {
    throw new R2ValidationError(
      `expiresIn ${expiresIn}s exceeds maximum ${MAX_EXPIRES_IN_SECONDS}s (7 days)`,
    );
  }
  return Math.floor(expiresIn);
}

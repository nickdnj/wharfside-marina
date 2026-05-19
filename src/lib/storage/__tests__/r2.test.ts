import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the AWS SDK pieces before importing the module under test. We
// capture the command instances and the signer call so we can assert on
// them directly.
const { sendSpy, signSpy, putCtorSpy, getCtorSpy, delCtorSpy } = vi.hoisted(() => {
  const sendSpy = vi.fn(async () => ({}));
  const signSpy = vi.fn(async (_client: unknown, command: unknown, _opts: unknown) => {
    // Return a synthetic signed URL that includes a tag for the command kind so
    // tests can assert the right command was signed.
    const kind = (command as { __kind?: string }).__kind ?? "unknown";
    return `https://signed.example/${kind}?Signature=abc`;
  });
  const putCtorSpy = vi.fn();
  const getCtorSpy = vi.fn();
  const delCtorSpy = vi.fn();
  return { sendSpy, signSpy, putCtorSpy, getCtorSpy, delCtorSpy };
});

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    constructor(public readonly config: unknown) {}
    send = sendSpy;
  }
  class PutObjectCommand {
    readonly __kind = "put";
    constructor(public readonly input: unknown) {
      putCtorSpy(input);
    }
  }
  class GetObjectCommand {
    readonly __kind = "get";
    constructor(public readonly input: unknown) {
      getCtorSpy(input);
    }
  }
  class DeleteObjectCommand {
    readonly __kind = "delete";
    constructor(public readonly input: unknown) {
      delCtorSpy(input);
    }
  }
  return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: signSpy,
}));

import {
  getSignedUploadUrl,
  getSignedDownloadUrl,
  deleteObject,
  getPublicUrl,
  __resetR2ClientForTests,
  R2ConfigError,
  R2ValidationError,
  DEFAULT_UPLOAD_EXPIRES_IN_SECONDS,
  DEFAULT_DOWNLOAD_EXPIRES_IN_SECONDS,
  MAX_EXPIRES_IN_SECONDS,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_CONTENT_TYPES,
} from "../r2";

const ENV_BACKUP = { ...process.env };

beforeEach(() => {
  process.env.R2_ACCOUNT_ID = "acct123";
  process.env.R2_ACCESS_KEY_ID = "AK_TEST";
  process.env.R2_SECRET_ACCESS_KEY = "SK_TEST";
  process.env.R2_BUCKET_NAME = "wharfside-docs";
  process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
  __resetR2ClientForTests();
  sendSpy.mockClear();
  signSpy.mockClear();
  putCtorSpy.mockClear();
  getCtorSpy.mockClear();
  delCtorSpy.mockClear();
});

afterEach(() => {
  process.env = { ...ENV_BACKUP };
});

describe("getSignedUploadUrl", () => {
  it("constructs a PutObjectCommand with bucket, key, content-type, length", async () => {
    const url = await getSignedUploadUrl({
      key: "documents/holder-42/insurance-2026.pdf",
      contentType: "application/pdf",
      contentLength: 256_000,
    });

    expect(putCtorSpy).toHaveBeenCalledTimes(1);
    expect(putCtorSpy).toHaveBeenCalledWith({
      Bucket: "wharfside-docs",
      Key: "documents/holder-42/insurance-2026.pdf",
      ContentType: "application/pdf",
      ContentLength: 256_000,
    });
    expect(signSpy).toHaveBeenCalledTimes(1);
    // 3rd arg to getSignedUrl is options with expiresIn.
    expect(signSpy.mock.calls[0]?.[2]).toEqual({ expiresIn: DEFAULT_UPLOAD_EXPIRES_IN_SECONDS });
    expect(url).toBe("https://signed.example/put?Signature=abc");
  });

  it("uses caller-supplied expiresIn when given", async () => {
    await getSignedUploadUrl({
      key: "x.pdf",
      contentType: "application/pdf",
      contentLength: 1024,
      expiresIn: 300,
    });
    expect(signSpy.mock.calls[0]?.[2]).toEqual({ expiresIn: 300 });
  });

  it("rejects disallowed content-types", async () => {
    await expect(
      getSignedUploadUrl({
        key: "x.exe",
        contentType: "application/x-msdownload",
        contentLength: 1024,
      }),
    ).rejects.toThrow(R2ValidationError);
    expect(putCtorSpy).not.toHaveBeenCalled();
  });

  it("accepts every allowed content-type", async () => {
    for (const ct of ALLOWED_UPLOAD_CONTENT_TYPES) {
      await expect(
        getSignedUploadUrl({ key: `docs/${ct}.bin`, contentType: ct, contentLength: 1024 }),
      ).resolves.toMatch(/^https:\/\/signed\.example/);
    }
  });

  it("rejects contentLength <= 0 or > MAX_UPLOAD_BYTES", async () => {
    await expect(
      getSignedUploadUrl({ key: "x.pdf", contentType: "application/pdf", contentLength: 0 }),
    ).rejects.toThrow(R2ValidationError);
    await expect(
      getSignedUploadUrl({
        key: "x.pdf",
        contentType: "application/pdf",
        contentLength: MAX_UPLOAD_BYTES + 1,
      }),
    ).rejects.toThrow(R2ValidationError);
  });

  it("rejects path-traversal in key", async () => {
    await expect(
      getSignedUploadUrl({
        key: "documents/../../etc/passwd",
        contentType: "application/pdf",
        contentLength: 1024,
      }),
    ).rejects.toThrow(R2ValidationError);
  });

  it("rejects expiresIn above the 7-day max", async () => {
    await expect(
      getSignedUploadUrl({
        key: "x.pdf",
        contentType: "application/pdf",
        contentLength: 1024,
        expiresIn: MAX_EXPIRES_IN_SECONDS + 1,
      }),
    ).rejects.toThrow(R2ValidationError);
  });
});

describe("getSignedDownloadUrl", () => {
  it("constructs a GetObjectCommand and signs with default 1h expiry", async () => {
    const url = await getSignedDownloadUrl({ key: "documents/foo.pdf" });
    expect(getCtorSpy).toHaveBeenCalledWith({ Bucket: "wharfside-docs", Key: "documents/foo.pdf" });
    expect(signSpy.mock.calls[0]?.[2]).toEqual({ expiresIn: DEFAULT_DOWNLOAD_EXPIRES_IN_SECONDS });
    expect(url).toBe("https://signed.example/get?Signature=abc");
  });

  it("rejects empty key", async () => {
    await expect(getSignedDownloadUrl({ key: "" })).rejects.toThrow(R2ValidationError);
  });

  it("rejects key starting with /", async () => {
    await expect(getSignedDownloadUrl({ key: "/absolute" })).rejects.toThrow(R2ValidationError);
  });
});

describe("deleteObject", () => {
  it("issues a DeleteObjectCommand against the configured bucket", async () => {
    await deleteObject({ key: "documents/old.pdf" });
    expect(delCtorSpy).toHaveBeenCalledWith({ Bucket: "wharfside-docs", Key: "documents/old.pdf" });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});

describe("getPublicUrl", () => {
  it("builds {base}/{key}", () => {
    expect(getPublicUrl("marketing/hero.jpg")).toBe("https://pub-test.r2.dev/marketing/hero.jpg");
  });

  it("strips trailing slashes from base and leading slashes from key", () => {
    process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev/";
    expect(getPublicUrl("/marketing/hero.jpg")).toBe("https://pub-test.r2.dev/marketing/hero.jpg");
  });

  it("throws if R2_PUBLIC_URL is not set", () => {
    delete process.env.R2_PUBLIC_URL;
    expect(() => getPublicUrl("x.jpg")).toThrow(R2ConfigError);
  });
});

describe("R2 config — environment", () => {
  it("throws on missing env vars when client is first built", async () => {
    delete process.env.R2_ACCESS_KEY_ID;
    __resetR2ClientForTests();
    await expect(
      getSignedDownloadUrl({ key: "x.pdf" }),
    ).rejects.toThrow(R2ConfigError);
  });
});

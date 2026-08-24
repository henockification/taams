import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3-compatible object storage, backed by SeaweedFS in production.
 *
 * The API talks to SeaweedFS over the internal Docker network via
 * `S3_ENDPOINT`. `S3_PUBLIC_ENDPOINT` is only needed when the browser must
 * reach storage directly through presigned URLs; it defaults to the internal
 * endpoint so server-side-only deployments need no extra configuration.
 */

const DEFAULT_REGION = 'us-east-1';
const DEFAULT_PRESIGN_EXPIRY_SECONDS = 15 * 60;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required storage environment variable: ${name}`);
  }
  return value;
}

export function getBucketName(): string {
  return requireEnv('S3_BUCKET');
}

function createClient(endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION || DEFAULT_REGION,
    // SeaweedFS (like MinIO) serves buckets as a path segment, not a subdomain.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
    },
    // The SDK adds CRC32 trailers by default, which not every S3-compatible
    // gateway accepts. Only send them when the operation actually requires it.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

let internalClient: S3Client | undefined;
let publicClient: S3Client | undefined;

/** Client used for all server-side reads and writes. */
export function getStorageClient(): S3Client {
  if (!internalClient) {
    internalClient = createClient(requireEnv('S3_ENDPOINT'));
  }
  return internalClient;
}

/** Client whose signatures are valid for the origin the browser will call. */
function getPublicStorageClient(): S3Client {
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT;
  if (!publicEndpoint) {
    return getStorageClient();
  }
  if (!publicClient) {
    publicClient = createClient(publicEndpoint);
  }
  return publicClient;
}

/**
 * Builds a collision-free object key. Callers pass a logical prefix such as
 * `employees/42/documents`; the original filename is preserved as a suffix so
 * downloads keep a sensible name.
 */
export function buildObjectKey(prefix: string, filename: string): string {
  const safeName = filename
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(-120);
  const unique = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix.replace(/^\/+|\/+$/g, '')}/${unique}-${safeName}`;
}

export interface UploadObjectInput {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  /** Sent back as Content-Disposition when the object is downloaded. */
  contentDisposition?: string;
  metadata?: Record<string, string>;
}

export async function uploadObject({
  key,
  body,
  contentType,
  contentDisposition,
  metadata,
}: UploadObjectInput): Promise<{ key: string }> {
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentDisposition: contentDisposition,
      Metadata: metadata,
    })
  );
  return { key };
}

/** Streams an object back. Returns null when the key does not exist. */
export async function getObject(key: string) {
  try {
    const response = await getStorageClient().send(
      new GetObjectCommand({ Bucket: getBucketName(), Key: key })
    );
    return {
      body: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  const object = await getObject(key);
  if (!object?.body) return null;
  const bytes = await object.body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getStorageClient().send(
      new HeadObjectCommand({ Bucket: getBucketName(), Key: key })
    );
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getStorageClient().send(
    new DeleteObjectCommand({ Bucket: getBucketName(), Key: key })
  );
}

/** Time-limited download link, safe to hand to a browser. */
export async function getPresignedDownloadUrl(
  key: string,
  options: { expiresIn?: number; downloadFilename?: string } = {}
): Promise<string> {
  return getSignedUrl(
    getPublicStorageClient(),
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      ResponseContentDisposition: options.downloadFilename
        ? `attachment; filename="${options.downloadFilename.replace(/"/g, '')}"`
        : undefined,
    }),
    { expiresIn: options.expiresIn ?? DEFAULT_PRESIGN_EXPIRY_SECONDS }
  );
}

/** Time-limited upload link, letting the browser PUT straight to storage. */
export async function getPresignedUploadUrl(
  key: string,
  options: { contentType?: string; expiresIn?: number } = {}
): Promise<string> {
  return getSignedUrl(
    getPublicStorageClient(),
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      ContentType: options.contentType,
    }),
    { expiresIn: options.expiresIn ?? DEFAULT_PRESIGN_EXPIRY_SECONDS }
  );
}

function isNotFound(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
    ?.httpStatusCode;
  return name === 'NoSuchKey' || name === 'NotFound' || status === 404;
}

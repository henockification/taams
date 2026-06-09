import { S3Client, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 configuration
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

/**
 * Generate a presigned URL for getting an object from Cloudflare R2
 * @param bucketName - The name of the R2 bucket
 * @param key - The object key (file path)
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Promise<string> - The presigned URL
 */
export async function getPresignedUrl(
  bucketName: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn,
    });

    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
}

/**
 * Generate a presigned URL for uploading an object to Cloudflare R2
 * @param bucketName - The name of the R2 bucket
 * @param key - The object key (file path)
 * @param contentType - The content type of the file
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Promise<string> - The presigned URL for upload
 */
export async function getPresignedUploadUrl(
  bucketName: string,
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(r2Client, command, {
      expiresIn,
    });

    return presignedUrl;
  } catch (error) {
    console.error('Error generating presigned upload URL:', error);
    throw new Error('Failed to generate presigned upload URL');
  }
}

/**
 * Upload an object to Cloudflare R2.
 */
export async function uploadObject(
  bucketName: string,
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string
): Promise<void> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await r2Client.send(command);
  } catch (error) {
    console.error('Error uploading object:', error);
    throw new Error('Failed to upload object');
  }
}

/**
 * Build the public URL for an object key using configured R2 public URL.
 */
export function getPublicObjectUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!base) {
    throw new Error('NEXT_PUBLIC_R2_PUBLIC_URL environment variable is not set');
  }
  return `${base.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
}

/**
 * Delete an object from Cloudflare R2
 * @param bucketName - The name of the R2 bucket
 * @param key - The object key (file path)
 * @returns Promise<void>
 */
export async function deleteObject(
  bucketName: string,
  key: string
): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await r2Client.send(command);
  } catch (error) {
    console.error('Error deleting object:', error);
    throw new Error('Failed to delete object');
  }
}

/**
 * List objects in a specific prefix (folder) in Cloudflare R2
 * @param bucketName - The name of the R2 bucket
 * @param prefix - The prefix to search for (e.g., "tenantId/folder/userId/")
 * @returns Promise<string[]> - Array of object keys
 */
export async function listObjectsByPrefix(
  bucketName: string,
  prefix: string
): Promise<string[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    });

    const response = await r2Client.send(command);
    return response.Contents?.map(obj => obj.Key || '') || [];
  } catch (error) {
    console.error('Error listing objects:', error);
    throw new Error('Failed to list objects');
  }
}

/**
 * Delete all old avatar files for a user
 * @param bucketName - The name of the R2 bucket
 * @param tenantId - The tenant ID
 * @param userId - The user ID
 * @param folder - The folder name (e.g., "avatars")
 * @param excludeKey - Optional key to exclude from deletion (current file)
 * @returns Promise<void>
 */
export async function deleteOldUserAvatars(
  bucketName: string,
  tenantId: string,
  userId: string,
  folder: string = 'avatars',
  excludeKey?: string
): Promise<void> {
  try {
    const prefix = `${tenantId}/${folder}/${userId}/`;
    const objectKeys = await listObjectsByPrefix(bucketName, prefix);
    
    // Filter out the current file if specified
    const filesToDelete = excludeKey 
      ? objectKeys.filter(key => key !== excludeKey)
      : objectKeys;
    
    if (filesToDelete.length === 0) {
      console.log('No old avatar files to delete for user', userId);
      return;
    }
    
    // Delete all existing avatar files for this user (except current one)
    const deletePromises = filesToDelete.map(key => 
      deleteObject(bucketName, key)
    );
    
    await Promise.all(deletePromises);
    
    console.log(`Deleted ${filesToDelete.length} old avatar files for user ${userId}`);
  } catch (error) {
    console.error('Error deleting old avatars:', error);
    // Don't throw error here as we still want to allow new upload
    console.warn('Continuing with new upload despite cleanup error');
  }
}

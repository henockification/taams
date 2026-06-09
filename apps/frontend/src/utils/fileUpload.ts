import { useGetPresignedUrlUpload } from '@/data/hooks/files.hooks';

export type UploadType = 'avatar' | 'items' | 'general';

export interface UploadFileOptions {
  file: File;
  folder?: string;
  type?: UploadType;
  itemId?: string;
  expiresIn?: number;
  onSuccess?: (url: string, key: string) => void;
  onError?: (error: string) => void;
}

export interface UploadFileResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

/**
 * Hook for file upload with loading states
 * @returns Object with upload function and loading state
 */
export function useFileUpload() {
  const getPresignedUrlMutation = useGetPresignedUrlUpload();

  const uploadFileWithState = async (options: UploadFileOptions): Promise<UploadFileResult> => {
    const { file, folder, type, itemId, expiresIn = 3600, onSuccess, onError } = options;

    try {
      const presignedResponse = await getPresignedUrlMutation.mutateAsync({
        filename: file.name,
        contentType: file.type,
        folder,
        type,
        // Only include itemId if type is 'items'
        ...(type === 'items' && itemId ? { itemId } : {}),
        expiresIn
      });

      if (!presignedResponse.success) {
        throw new Error('Failed to get presigned URL');
      }

      // Upload file directly to Cloudflare R2 using presigned URL
      const uploadResponse = await fetch(presignedResponse.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
        mode: 'cors',
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Construct the final URL for the uploaded file
      let baseUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://your-bucket.r2.dev';
      
      // Remove trailing slash if present
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Add bucket name if not already present in the URL
      const bucketName = 'taams';
      if (!baseUrl.includes(`/${bucketName}`)) {
        baseUrl = `${baseUrl}/${bucketName}`;
      }
      
      const finalUrl = `${baseUrl}/${presignedResponse.key}`;

      // Call success callback if provided
      if (onSuccess) {
        onSuccess(finalUrl, presignedResponse.key);
      }

      return {
        success: true,
        url: finalUrl,
        key: presignedResponse.key
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Call error callback if provided
      if (onError) {
        onError(errorMessage);
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  };

  return {
    uploadFile: uploadFileWithState,
    isUploading: getPresignedUrlMutation.isPending
  };
}

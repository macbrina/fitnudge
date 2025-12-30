import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";
import * as FileSystem from "expo-file-system/legacy";
import { TokenManager } from "./base";

export type MediaType = "post" | "checkin" | "profile" | "other";

export interface MediaUploadResponse {
  id?: string; // Only present for post media
  url: string;
  filename: string;
  file_size: number;
  content_type: string;
  duration?: number; // For audio/video
  created_at: string;
}

export interface UploadOptions {
  filename?: string;
  mediaType?: MediaType;
  postId?: string;
}

// Media Service
export class MediaService extends BaseApiService {
  /**
   * Upload a media file (image, video, audio)
   * @param fileUri - Local file URI from expo-image-picker
   * @param options - Upload options (filename, mediaType, postId)
   */
  async uploadMedia(
    fileUri: string,
    options: UploadOptions = {},
  ): Promise<ApiResponse<MediaUploadResponse>> {
    const { filename, mediaType = "other", postId } = options;

    try {
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error("File does not exist");
      }

      // Determine file type from URI
      const uriParts = fileUri.split(".");
      const fileExtension =
        uriParts[uriParts.length - 1]?.toLowerCase() || "jpg";
      const mimeType = this.getMimeType(fileExtension);

      // Extract filename from URI or use provided
      const finalFilename = filename || `media.${fileExtension}`;

      // Create FormData for React Native
      const formData = new FormData();
      formData.append("file", {
        uri: fileUri,
        type: mimeType,
        name: finalFilename,
      } as any);

      // Get access token
      const token = await TokenManager.getAccessToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Build URL with query params
      const params = new URLSearchParams({ media_type: mediaType });
      if (postId) {
        params.append("post_id", postId);
      }
      const url = `${this.baseURL}${ROUTES.MEDIA.UPLOAD}?${params.toString()}`;

      const uploadResponse = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - React Native will set it with boundary for FormData
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({
          detail: uploadResponse.statusText,
        }));
        throw new Error(errorData.detail || "Upload failed");
      }

      const data = await uploadResponse.json();

      return {
        data,
        status: uploadResponse.status,
      };
    } catch (error) {
      console.error("Media upload error:", error);
      throw error;
    }
  }

  /**
   * Get access token helper
   */
  private async getAccessToken(): Promise<string | null> {
    return await TokenManager.getAccessToken();
  }

  /**
   * Upload multiple media files at once
   */
  async uploadMultipleMedia(
    fileUris: string[],
  ): Promise<
    ApiResponse<{ uploaded_files: MediaUploadResponse[]; errors: any[] }>
  > {
    const uploadedFiles: MediaUploadResponse[] = [];
    const errors: any[] = [];

    for (const fileUri of fileUris) {
      try {
        const result = await this.uploadMedia(fileUri);
        if (result.data) {
          uploadedFiles.push(result.data);
        }
      } catch (error) {
        errors.push({
          fileUri,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      data: {
        uploaded_files: uploadedFiles,
        errors,
      },
      status: 200,
    };
  }

  /**
   * Delete a media file by ID (for post media stored in database)
   */
  async deleteMedia(
    mediaId: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.delete<{ message: string }>(ROUTES.MEDIA.DELETE(mediaId));
  }

  /**
   * Delete a media file by URL (for checkin/profile media not in database)
   */
  async deleteMediaByUrl(
    url: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return this.post<{ message: string }>(ROUTES.MEDIA.DELETE_BY_URL, { url });
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      mp4: "video/mp4",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      aac: "audio/aac",
    };

    return mimeTypes[extension] || "application/octet-stream";
  }
}

// Export singleton instance
export const mediaService = new MediaService();

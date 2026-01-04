import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaService, MediaUploadResponse, UploadOptions } from "@/services/api/media";

// Query Keys
export const mediaQueryKeys = {
  all: ["media"] as const,
  user: () => [...mediaQueryKeys.all, "user"] as const
} as const;

interface UploadMediaParams {
  fileUri: string;
  options?: UploadOptions;
}

// Upload media hook
export const useUploadMedia = () => {
  return useMutation({
    mutationFn: ({ fileUri, options }: UploadMediaParams) =>
      mediaService.uploadMedia(fileUri, options)
  });
};

// Upload multiple media files hook
export const useUploadMultipleMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileUris: string[]) => mediaService.uploadMultipleMedia(fileUris),
    onSuccess: () => {
      // Invalidate user media queries
      queryClient.invalidateQueries({ queryKey: mediaQueryKeys.user() });
    }
  });
};

// Delete media hook (by ID - for post media)
export const useDeleteMedia = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mediaId: string) => mediaService.deleteMedia(mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaQueryKeys.user() });
    }
  });
};

// Delete media by URL hook (for checkin/profile media)
export const useDeleteMediaByUrl = () => {
  return useMutation({
    mutationFn: (url: string) => mediaService.deleteMediaByUrl(url)
  });
};

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { mediaService, MediaUploadResponse, UploadOptions } from "@/services/api/media";
import { voiceNotesService, VoiceNoteUploadResponse } from "@/services/api/voiceNotes";
import { checkInsQueryKeys } from "./useCheckIns";

// Query Keys
export const mediaQueryKeys = {
  all: ["media"] as const,
  user: () => [...mediaQueryKeys.all, "user"] as const
} as const;

interface UploadMediaParams {
  fileUri: string;
  options?: UploadOptions;
}

interface UploadVoiceNoteParams {
  checkinId: string;
  audioUri: string;
  duration: number;
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

// =============================================
// VOICE NOTES (consolidated into media.py)
// =============================================

// Upload voice note hook (premium feature)
export const useUploadVoiceNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ checkinId, audioUri, duration }: UploadVoiceNoteParams) =>
      voiceNotesService.uploadVoiceNote(checkinId, audioUri, duration),
    onSuccess: (_data, variables) => {
      // Invalidate check-in queries to refresh voice note data
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
    }
  });
};

// Delete voice note hook
export const useDeleteVoiceNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkinId: string) => voiceNotesService.deleteVoiceNote(checkinId),
    onSuccess: () => {
      // Invalidate check-in queries to refresh voice note data
      queryClient.invalidateQueries({ queryKey: checkInsQueryKeys.all });
    }
  });
};

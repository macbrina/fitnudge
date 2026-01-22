/**
 * V2 Voice Notes API Service
 *
 * Premium feature for recording voice reflections after check-ins.
 * - Upload voice notes to R2 storage via media.py
 * - Transcription via Whisper API
 * - Attached to check-ins
 *
 * Consolidated into media.py endpoint.
 */

import { BaseApiService, ApiResponse } from "./base";
import { ROUTES } from "@/lib/routes";

export interface VoiceNoteUploadResponse {
  url: string;
  filename: string;
  file_size: number;
  content_type: string;
  duration?: number;
  created_at: string;
  transcript?: string;
  checkin_id?: string;
}

export interface VoiceNoteDeleteResponse {
  message: string;
}

class VoiceNotesService extends BaseApiService {
  /**
   * Upload a voice note for a check-in
   * Uses the consolidated media.py endpoint with media_type=voice_note
   *
   * @param checkinId - The check-in ID to attach the voice note to
   * @param audioUri - Local file URI of the recorded audio
   * @param duration - Duration in seconds
   */
  async uploadVoiceNote(
    checkinId: string,
    audioUri: string,
    duration: number
  ): Promise<ApiResponse<VoiceNoteUploadResponse>> {
    const formData = new FormData();

    // Create file object from URI
    const filename = audioUri.split("/").pop() || "voice_note.m4a";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `audio/${match[1]}` : "audio/m4a";

    formData.append("file", {
      uri: audioUri,
      name: filename,
      type
    } as any);

    // Form data for voice note
    formData.append("checkin_id", checkinId);
    formData.append("duration", duration.toString());

    // Use request method with multipart/form-data
    // media_type=voice_note is handled by the endpoint default
    return this.request<VoiceNoteUploadResponse>(
      `${ROUTES.VOICE_NOTES.UPLOAD}?media_type=voice_note`,
      {
        method: "POST",
        body: formData as any,
        headers: {
          "Content-Type": "multipart/form-data"
        }
      }
    );
  }

  /**
   * Delete a voice note from a check-in
   */
  async deleteVoiceNote(checkinId: string): Promise<ApiResponse<VoiceNoteDeleteResponse>> {
    return this.delete<VoiceNoteDeleteResponse>(ROUTES.VOICE_NOTES.DELETE(checkinId));
  }
}

export const voiceNotesService = new VoiceNotesService();

/**
 * V2 Voice Notes API Service
 *
 * Premium feature for recording voice reflections after check-ins.
 * - Upload voice notes to R2 storage via media.py
 * - Transcription via Whisper API
 * - Attached to check-ins
 *
 * Upload uses raw fetch (like media.ts): no Content-Type header so React Native
 * sets multipart/form-data with boundary. BaseApiService.request with
 * Content-Type: multipart/form-data causes 400.
 */

import { BaseApiService, ApiResponse } from "./base";
import { TokenManager } from "./base";
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
   * Upload a voice note for a check-in.
   * Uses fetch + FormData (same pattern as media.ts). Do not set Content-Type;
   * React Native sets multipart/form-data with boundary.
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
    const filename = audioUri.split("/").pop() || "voice_note.m4a";
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `audio/${match[1]}` : "audio/m4a";

    formData.append("file", {
      uri: audioUri,
      name: filename,
      type
    } as any);
    formData.append("checkin_id", checkinId);
    formData.append("duration", duration.toString());

    const token = await TokenManager.getAccessToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const url = `${this.baseURL}${ROUTES.VOICE_NOTES.UPLOAD}?media_type=voice_note`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
        // Don't set Content-Type - React Native sets it with boundary for FormData
      },
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Voice note upload failed");
    }

    const data = (await res.json()) as VoiceNoteUploadResponse;
    return { data, status: res.status };
  }

  /**
   * Delete a voice note from a check-in
   */
  async deleteVoiceNote(checkinId: string): Promise<ApiResponse<VoiceNoteDeleteResponse>> {
    return this.delete<VoiceNoteDeleteResponse>(ROUTES.VOICE_NOTES.DELETE(checkinId));
  }
}

export const voiceNotesService = new VoiceNotesService();

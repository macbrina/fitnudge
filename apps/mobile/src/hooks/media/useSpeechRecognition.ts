/**
 * Speech Recognition Hook
 *
 * Provides speech-to-text functionality using @react-native-voice/voice.
 * Handles real-time transcription and error handling.
 *
 * @example
 * ```tsx
 * const { isListening, transcript, startListening, stopListening } = useSpeechRecognition({
 *   onTranscriptChange: (text) => setInputText(text)
 * });
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from "@react-native-voice/voice";

export interface UseSpeechRecognitionOptions {
  /** Language/locale for speech recognition (default: 'en-US') */
  locale?: string;
  /** Callback when transcription updates */
  onTranscriptChange?: (transcript: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  /** Whether speech recognition is currently active */
  isListening: boolean;
  /** Current transcription (updates in real-time) */
  transcript: string;
  /** Any error that occurred */
  error: string | null;
  /** Start listening for speech */
  startListening: () => Promise<boolean>;
  /** Stop listening and finalize transcription */
  stopListening: () => Promise<void>;
  /** Cancel listening without finalizing */
  cancelListening: () => Promise<void>;
  /** Clear the current transcript */
  clearTranscript: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { locale = "en-US", onTranscriptChange, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Use refs for callbacks so we don't need to re-register handlers
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onErrorRef = useRef(onError);
  const isListeningRef = useRef(isListening);

  // Update refs when values change
  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
    onErrorRef.current = onError;
  }, [onTranscriptChange, onError]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Auto-stop recording when app goes to background (WhatsApp-style)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState !== "active" && isListeningRef.current) {
        console.log("[Voice] App went to background, stopping recording");
        try {
          await Voice.stop();
          setIsListening(false);
        } catch (err) {
          console.warn("[Voice] Error stopping on background:", err);
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  // Set up Voice event handlers once on mount
  useEffect(() => {
    const onSpeechStart = () => {
      console.log("[Voice] Speech started");
      setIsListening(true);
      setError(null);
    };

    const onSpeechEnd = () => {
      console.log("[Voice] Speech ended");
      setIsListening(false);
    };

    const onSpeechResults = (e: SpeechResultsEvent) => {
      console.log("[Voice] Results:", e.value);
      if (e.value && e.value.length > 0) {
        const result = e.value[0];
        setTranscript(result);
        onTranscriptChangeRef.current?.(result);
      }
    };

    const onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (e.value && e.value.length > 0) {
        const partial = e.value[0];
        setTranscript(partial);
        onTranscriptChangeRef.current?.(partial);
      }
    };

    const onSpeechError = (e: SpeechErrorEvent) => {
      console.log("[Voice] Error:", e.error);
      const errorMessage = e.error?.message || "Speech recognition error";
      setError(errorMessage);
      setIsListening(false);
      onErrorRef.current?.(errorMessage);
    };

    const onSpeechVolumeChanged = () => {
      // Empty handler to prevent warnings (Android only)
    };

    // Register all handlers
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechResults = onSpeechResults;
    Voice.onSpeechPartialResults = onSpeechPartialResults;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechVolumeChanged = onSpeechVolumeChanged;

    console.log("[Voice] Handlers registered");

    // Cleanup on unmount
    return () => {
      console.log("[Voice] Cleaning up");
      Voice.destroy().then(Voice.removeAllListeners).catch(console.warn);
    };
  }, []); // Empty deps - only run once on mount

  const startListening = useCallback(async (): Promise<boolean> => {
    try {
      // Check if already listening
      const isRecognizing = await Voice.isRecognizing();
      if (isRecognizing) {
        console.log("[Voice] Already recognizing, stopping first");
        await Voice.stop();
        // Small delay to let it fully stop
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Clear previous state
      setError(null);
      setTranscript("");

      console.log("[Voice] Starting with locale:", locale);
      await Voice.start(locale);
      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start speech recognition";
      console.error("[Voice] Start error:", errorMessage);
      setError(errorMessage);
      setIsListening(false);
      onErrorRef.current?.(errorMessage);
      return false;
    }
  }, [locale]);

  const stopListening = useCallback(async (): Promise<void> => {
    try {
      console.log("[Voice] Stopping");
      await Voice.stop();
      setIsListening(false);
    } catch (err) {
      console.warn("[Voice] Stop error:", err);
    }
  }, []);

  const cancelListening = useCallback(async (): Promise<void> => {
    try {
      console.log("[Voice] Canceling");
      await Voice.cancel();
      setIsListening(false);
      setTranscript("");
    } catch (err) {
      console.warn("[Voice] Cancel error:", err);
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    cancelListening,
    clearTranscript
  };
}

export default useSpeechRecognition;

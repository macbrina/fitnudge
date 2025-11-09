import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAlertModal } from "@/contexts/AlertModalContext";
import {
  BackendStatus,
  useSystemStatusStore,
} from "@/stores/systemStatusStore";

export function SystemStatusListener() {
  const { backendStatus, reason } = useSystemStatusStore();
  const clearReason = useSystemStatusStore((state) => state.clearReason);
  const { showAlert } = useAlertModal();
  const { t } = useTranslation();
  const previousStatusRef = useRef<BackendStatus>("online");
  const previousReasonRef = useRef<string | null>(null);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const previousReason = previousReasonRef.current;

    const shouldDisplayAlert =
      backendStatus === "offline" &&
      (backendStatus !== previousStatus ||
        (reason !== null && reason !== previousReason));

    if (shouldDisplayAlert) {
      previousStatusRef.current = backendStatus;
      previousReasonRef.current = reason;

      void showAlert({
        title: t(`system_status.${backendStatus}.title`),
        message: reason || t(`system_status.${backendStatus}.message`),
        variant: backendStatus === "offline" ? "error" : "warning",
        confirmLabel: t("common.ok"),
      }).finally(() => {
        clearReason();
      });
      return;
    }

    previousStatusRef.current = backendStatus;
    previousReasonRef.current = reason;
  }, [backendStatus, reason, clearReason, showAlert, t]);

  return null;
}

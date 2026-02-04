import { Suspense } from "react";
import { ResetPasswordView } from "@/views/reset-password/ResetPasswordView";
import { Loading } from "@/components/Loading";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loading variant="page" />}>
      <ResetPasswordView />
    </Suspense>
  );
}

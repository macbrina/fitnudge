"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { Button, Input } from "@fitnudge/ui";
import { BlogEditor } from "@/components/blog/BlogEditor";
import {
  useLegalDocumentDetail,
  useLegalDocumentCreate,
  useLegalDocumentUpdate,
} from "@/hooks/api/useLegalDocuments";
import { ROUTES } from "@/lib/routes";
import { ArrowLeft, Save } from "lucide-react";

const DOC_TYPES = [
  { value: "terms_of_service", label: "Terms of Service" },
  { value: "privacy_policy", label: "Privacy Policy" },
  { value: "cookie_policy", label: "Cookie Policy" },
] as const;

type Props = {
  docId?: string | null;
};

export function LegalDocumentEditorView({ docId }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const isEdit = !!docId;

  const [form, setForm] = useState({
    type: "terms_of_service" as (typeof DOC_TYPES)[number]["value"],
    version: "",
    title: "",
    content: "",
    summary: "",
    effective_date: new Date().toISOString().slice(0, 10),
    is_current: false,
  });

  const { data: doc, isLoading: loadingDoc } = useLegalDocumentDetail(
    docId ?? "",
    isEdit
  );
  const createMutation = useLegalDocumentCreate();
  const updateMutation = useLegalDocumentUpdate();

  useEffect(() => {
    if (doc) {
      setForm({
        type: doc.type as (typeof DOC_TYPES)[number]["value"],
        version: doc.version,
        title: doc.title,
        content: doc.content,
        summary: doc.summary ?? "",
        effective_date: doc.effective_date.slice(0, 10),
        is_current: doc.is_current,
      });
    }
  }, [doc]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.version.trim()) {
      toast.error(t("admin.legal_documents.required_fields"));
      return;
    }

    try {
      if (isEdit && docId) {
        await updateMutation.mutateAsync({
          id: docId,
          payload: {
            version: form.version,
            title: form.title,
            content: form.content,
            summary: form.summary || undefined,
            effective_date: form.effective_date,
            is_current: form.is_current,
          },
        });
        toast.success(t("admin.legal_documents.updated"));
      } else {
        await createMutation.mutateAsync({
          type: form.type,
          version: form.version,
          title: form.title,
          content: form.content,
          summary: form.summary || undefined,
          effective_date: form.effective_date,
          is_current: form.is_current,
        });
        toast.success(t("admin.legal_documents.created"));
      }
      router.push(ROUTES.LEGAL_DOCUMENTS);
    } catch {
      toast.error(t("admin.legal_documents.save_failed"));
    }
  };

  if (isEdit && loadingDoc) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isEdit && !doc && !loadingDoc) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-400">
          {t("admin.analytics.load_error")}: Document not found
        </p>
        <Link href={ROUTES.LEGAL_DOCUMENTS} className="mt-4 inline-block text-sm underline">
          {t("admin.app_config.cancel")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href={ROUTES.LEGAL_DOCUMENTS}>
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">
          {isEdit ? t("admin.legal_documents.edit") : t("admin.legal_documents.new")}
        </h1>
      </div>

      <div className="space-y-6 max-w-4xl">
        {!isEdit && (
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("admin.legal_documents.type")}
            </label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as (typeof DOC_TYPES)[number]["value"],
                }))
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("admin.legal_documents.version")}
            </label>
            <Input
              value={form.version}
              onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="1.0"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("admin.legal_documents.effective_date")}
            </label>
            <Input
              type="date"
              value={form.effective_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, effective_date: e.target.value }))
              }
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            {t("admin.legal_documents.title")}
          </label>
          <Input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Terms of Service"
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            {t("admin.legal_documents.summary")}
          </label>
          <Input
            value={form.summary}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            placeholder="Optional summary of changes"
            className="w-full"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            {t("admin.legal_documents.content")}
          </label>
          <BlogEditor
            content={form.content}
            onChange={(html) => setForm((f) => ({ ...f, content: html }))}
            placeholder="HTML content..."
            className="min-h-[400px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_current"
            checked={form.is_current}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_current: e.target.checked }))
            }
            className="h-4 w-4 rounded border-gray-300"
          />
          <label htmlFor="is_current" className="text-sm">
            {t("admin.legal_documents.is_current")}
          </label>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="h-4 w-4" />
            {createMutation.isPending || updateMutation.isPending
              ? t("admin.app_config.saving")
              : t("admin.app_config.save")}
          </Button>
          <Link href={ROUTES.LEGAL_DOCUMENTS}>
            <Button variant="outline">{t("admin.app_config.cancel")}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

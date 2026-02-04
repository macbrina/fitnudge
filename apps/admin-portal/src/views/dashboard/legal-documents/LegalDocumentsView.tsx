"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
} from "@fitnudge/ui";
import {
  useLegalDocumentsList,
  useLegalDocumentSetCurrent,
  useLegalDocumentDelete,
} from "@/hooks/api/useLegalDocuments";
import type { LegalDocumentItem } from "@/lib/api";
import { Skeleton } from "@fitnudge/ui";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { ROUTES } from "@/lib/routes";

const DOC_TYPES = [
  { value: "terms_of_service", label: "Terms of Service" },
  { value: "privacy_policy", label: "Privacy Policy" },
  { value: "cookie_policy", label: "Cookie Policy" },
] as const;

export function LegalDocumentsView() {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<string>("");

  const { data, isLoading, error } = useLegalDocumentsList({
    type: typeFilter || undefined,
  });
  const setCurrentMutation = useLegalDocumentSetCurrent();
  const deleteMutation = useLegalDocumentDelete();

  const items = data?.items ?? [];

  const handleSetCurrent = async (id: string) => {
    try {
      await setCurrentMutation.mutateAsync(id);
      toast.success(t("admin.legal_documents.set_current"));
    } catch {
      toast.error(t("admin.legal_documents.set_current_failed"));
    }
  };

  const handleDelete = async (doc: LegalDocumentItem) => {
    if (!confirm(t("admin.legal_documents.confirm_delete"))) return;
    if (doc.is_current) {
      toast.error(t("admin.legal_documents.cannot_delete_current"));
      return;
    }
    try {
      await deleteMutation.mutateAsync(doc.id);
      toast.success(t("admin.legal_documents.deleted"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString();
    } catch {
      return s;
    }
  };

  const typeLabel = (type: string) =>
    DOC_TYPES.find((d) => d.value === type)?.label ?? type;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
        <p className="text-red-700 dark:text-red-400">
          {t("admin.analytics.load_error")}: {(error as Error).message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-gray-600 dark:text-gray-400">
        {t("admin.pages.legal_documents_description")}
      </p>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-4">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">{t("admin.legal_documents.filter_type")}</option>
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <Link href={ROUTES.LEGAL_DOCUMENTS_NEW}>
              <Button>
                <Plus className="h-4 w-4" />
                {t("admin.legal_documents.new")}
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.legal_documents.type")}</TableHead>
                  <TableHead>{t("admin.legal_documents.version")}</TableHead>
                  <TableHead>{t("admin.legal_documents.title")}</TableHead>
                  <TableHead>{t("admin.legal_documents.effective_date")}</TableHead>
                  <TableHead>{t("admin.legal_documents.current")}</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>{typeLabel(doc.type)}</TableCell>
                    <TableCell>{doc.version}</TableCell>
                    <TableCell>{doc.title}</TableCell>
                    <TableCell>{formatDate(doc.effective_date)}</TableCell>
                    <TableCell>{doc.is_current ? "✓" : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!doc.is_current && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleSetCurrent(doc.id)}
                            disabled={setCurrentMutation.isPending}
                            title={t("admin.legal_documents.set_current")}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Link href={ROUTES.apiLegalDocumentEdit(doc.id)}>
                          <Button variant="ghost" size="icon-sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        {!doc.is_current && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(doc)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {items.length === 0 && !isLoading && (
            <div className="py-12 text-center text-gray-500">
              {t("admin.analytics.empty")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useTranslation } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@fitnudge/ui";
import { FileText } from "lucide-react";

export function BlogView() {
  const { t } = useTranslation();

  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.blog_description")}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("admin.blog.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("admin.blog.description")}
          </p>
          <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4 text-sm">
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("admin.blog.api_note_title")}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              {t("admin.blog.api_note")}
            </p>
            <code className="block text-xs text-gray-500 dark:text-gray-500 mt-2">
              GET /api/v1/blog/admin/posts
              <br />
              POST /api/v1/blog/admin/posts
              <br />
              PUT /api/v1/blog/admin/posts/&#123;id&#125;
              <br />
              DELETE /api/v1/blog/admin/posts/&#123;id&#125;
            </code>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("admin.blog.view_docs")}
          </p>
        </CardContent>
      </Card>
    </>
  );
}

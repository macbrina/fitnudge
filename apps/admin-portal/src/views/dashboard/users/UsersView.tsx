"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Button,
  Input,
  Skeleton,
} from "@fitnudge/ui";
import { StatCard } from "@/components/StatCard";
import { useUsersList, useUsersStats } from "@/hooks/api/useUsers";
import { usersApi, type UserSummary } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, Download } from "lucide-react";

const columnHelper = createColumnHelper<UserSummary>();

export function UsersView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data: listData, isLoading: loading, isError: listError } = useUsersList({
    page,
    per_page: perPage,
    search: searchDebounced || undefined,
    status: statusFilter || undefined,
    role: roleFilter || undefined,
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const { data: stats, isLoading: statsLoading, isError: statsError } = useUsersStats();

  const users = listData?.users ?? [];
  const total = listData?.total ?? 0;

  useEffect(() => {
    if (listError) toast.error(t("admin.users.fetch_error"));
  }, [listError, t]);

  useEffect(() => {
    if (statsError) toast.error(t("admin.users.stats_error"));
  }, [statsError, t]);

  // Sortable column header
  const handleSort = useCallback((column: string) => {
    setPage(1);
    if (sortBy === column) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  }, [sortBy]);

  const SortHeader = useCallback(
    ({ column, children }: { column: string; children: React.ReactNode }) => (
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="flex items-center gap-1 hover:text-primary transition-colors text-left font-medium"
      >
        {children}
        {sortBy === column ? (
          sortOrder === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <span className="w-4 h-4 opacity-30">
            <ChevronDown className="h-4 w-4" />
          </span>
        )}
      </button>
    ),
    [sortBy, sortOrder, handleSort]
  );

  // Export CSV
  const handleExportCsv = useCallback(async () => {
    toast.info(t("admin.users.exporting"));
    const allUsers: UserSummary[] = [];
    let pageNum = 1;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await usersApi.list({
        page: pageNum,
        per_page: 100,
        search: searchDebounced || undefined,
        status: statusFilter || undefined,
        role: roleFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      if (error) {
        toast.error(t("admin.users.export_error"));
        return;
      }
      if (!data || data.users.length === 0) break;
      allUsers.push(...data.users);
      hasMore = data.users.length === 100;
      pageNum++;
    }
    const headers = [
      t("admin.users.csv_header_email"),
      t("admin.users.csv_header_name"),
      t("admin.users.csv_header_role"),
      t("admin.users.csv_header_status"),
      t("admin.users.csv_header_plan"),
      t("admin.users.col_source"),
      t("admin.users.csv_header_created"),
      t("admin.users.csv_header_last_active"),
    ];
    const srcLabel = (s: string | null | undefined) =>
      s ? t(`admin.users.source_${s}` as const) : "";
    const rows = allUsers.map((u) =>
      [
        u.email,
        u.display_name ?? "",
        u.role,
        u.status,
        u.subscription_plan ?? "free",
        srcLabel(u.subscription_source ?? undefined),
        u.created_at,
        u.last_active_at ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("admin.users.export_success", { count: allUsers.length }));
  }, [searchDebounced, statusFilter, roleFilter, sortBy, sortOrder, t]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("email", {
        header: () => <SortHeader column="email">{t("admin.users.col_email")}</SortHeader>,
        cell: (info) => (
          <span className="font-medium text-gray-900 dark:text-white">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("display_name", {
        header: () => <SortHeader column="name">{t("admin.users.col_name")}</SortHeader>,
        cell: (info) => info.getValue() || "—",
      }),
      columnHelper.accessor("role", {
        header: () => <SortHeader column="role">{t("admin.users.col_role")}</SortHeader>,
        cell: (info) => {
          const v = info.getValue();
          return (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                v === "admin"
                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {v ? v.charAt(0).toUpperCase() + v.slice(1) : "—"}
            </span>
          );
        },
      }),
      columnHelper.accessor("status", {
        header: () => <SortHeader column="status">{t("admin.users.col_status")}</SortHeader>,
        cell: (info) => {
          const v = info.getValue();
          const styles: Record<string, string> = {
            active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
            disabled: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
            suspended: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
          };
          return (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[v] ?? "bg-gray-100"}`}
            >
              {v ? v.charAt(0).toUpperCase() + v.slice(1) : "—"}
            </span>
          );
        },
      }),
      columnHelper.accessor("subscription_plan", {
        header: () => <SortHeader column="plan">{t("admin.users.col_plan")}</SortHeader>,
        cell: (info) => {
          const v = info.getValue() || "free";
          return v.charAt(0).toUpperCase() + v.slice(1);
        },
      }),
      columnHelper.accessor("subscription_source", {
        header: () => t("admin.users.col_source"),
        cell: (info) => {
          const src = info.getValue();
          if (!src) return "—";
          const key = `admin.users.source_${src}` as const;
          return t(key);
        },
      }),
      columnHelper.accessor("created_at", {
        header: () => <SortHeader column="created_at">{t("admin.users.col_created")}</SortHeader>,
        cell: (info) =>
          new Date(info.getValue()).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
      }),
      columnHelper.accessor("last_active_at", {
        header: () => <SortHeader column="last_active_at">{t("admin.users.col_last_active")}</SortHeader>,
        cell: (info) => {
          const v = info.getValue();
          if (!v) return "—";
          return new Date(v).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        },
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`${ROUTES.USERS}/${row.original.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 hover:text-primary dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-primary"
            title={t("admin.users.view")}
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        ),
      }),
    ],
    [t, SortHeader]
  );

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        {t("admin.pages.users_description")}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        {statsLoading ? (
          <>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </>
        ) : stats ? (
          <>
            <StatCard label={t("admin.users.stats_total")} value={stats.total} />
            <StatCard
              label={t("admin.users.stats_active")}
              value={stats.by_status.active}
            />
            <StatCard
              label={t("admin.users.stats_disabled")}
              value={stats.by_status.disabled}
            />
            <StatCard
              label={t("admin.users.stats_suspended")}
              value={stats.by_status.suspended}
            />
            <StatCard
              label={t("admin.users.stats_admin")}
              value={stats.by_role.admin}
            />
            <StatCard
              label={t("admin.users.stats_premium")}
              value={stats.by_subscription.premium}
            />
            <StatCard
              label={t("admin.users.stats_free")}
              value={stats.by_subscription.free}
            />
          </>
        ) : null}
      </div>

      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4 sm:items-center sm:justify-between">
        {statsLoading ? (
          <div className="flex gap-2 flex-wrap items-center flex-1">
            <Skeleton className="h-10 w-64 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md shrink-0" />
          </div>
        ) : (
        <>
        <div className="flex flex-col sm:flex-row gap-4 sm:flex-1">
        <Input
          placeholder={t("admin.users.search_placeholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">{t("admin.users.filter_status")}: {t("admin.users.filter_all")}</option>
            <option value="active">{t("admin.users.status_active")}</option>
            <option value="disabled">{t("admin.users.status_disabled")}</option>
            <option value="suspended">{t("admin.users.status_suspended")}</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
          >
            <option value="">{t("admin.users.filter_role")}: {t("admin.users.filter_all")}</option>
            <option value="user">{t("admin.users.role_user")}</option>
            <option value="admin">{t("admin.users.role_admin")}</option>
          </select>
        </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          className="flex items-center gap-2 shrink-0"
        >
          <Download className="h-4 w-4" />
          {t("admin.users.export_csv")}
        </Button>
        </>
        )}
      </div>

      {/* Table - horizontal scroll on small screens */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {loading ? (
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.users.col_email")}</TableHead>
                <TableHead>{t("admin.users.col_name")}</TableHead>
                <TableHead>{t("admin.users.col_role")}</TableHead>
                <TableHead>{t("admin.users.col_status")}</TableHead>
                <TableHead>{t("admin.users.col_plan")}</TableHead>
                <TableHead>{t("admin.users.col_source")}</TableHead>
                <TableHead>{t("admin.users.col_created")}</TableHead>
                <TableHead>{t("admin.users.col_last_active")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            {t("admin.users.empty")}
          </div>
        ) : (
          <Table className="min-w-[800px]">
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("admin.users.page_of", {
                current: page,
                total: totalPages,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("admin.users.prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("admin.users.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}


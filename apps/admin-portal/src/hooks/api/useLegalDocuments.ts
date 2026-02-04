"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  legalDocumentsApi,
  type LegalDocumentCreatePayload,
  type LegalDocumentUpdatePayload,
} from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

export function useLegalDocumentsList(params?: { type?: string }) {
  return useQuery({
    queryKey: queryKeys.legalDocuments.list(params ?? {}),
    queryFn: () => unwrap(legalDocumentsApi.list(params)),
  });
}

export function useLegalDocumentDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.legalDocuments.detail(id),
    queryFn: () => unwrap(legalDocumentsApi.get(id)),
    enabled: enabled && !!id,
  });
}

export function useLegalDocumentCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LegalDocumentCreatePayload) =>
      unwrap(legalDocumentsApi.create(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legalDocuments.all });
    },
  });
}

export function useLegalDocumentUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: LegalDocumentUpdatePayload;
    }) => unwrap(legalDocumentsApi.update(id, payload)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legalDocuments.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.legalDocuments.detail(id),
      });
    },
  });
}

export function useLegalDocumentSetCurrent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(legalDocumentsApi.setCurrent(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legalDocuments.all });
    },
  });
}

export function useLegalDocumentDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(legalDocumentsApi.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legalDocuments.all });
    },
  });
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  blogApi,
  type BlogCategoryCreatePayload,
  type BlogCategoryUpdatePayload,
  type BlogTagCreatePayload,
  type BlogTagUpdatePayload,
  type BlogPostCreatePayload,
  type BlogPostUpdatePayload,
} from "@/lib/api";
import { queryKeys } from "./queryKeys";

async function unwrap<T>(promise: Promise<{ data?: T; error?: string }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("No data");
  return data;
}

// Categories
export function useBlogCategories() {
  return useQuery({
    queryKey: queryKeys.blog.categories(),
    queryFn: () => unwrap(blogApi.categories.list()),
  });
}

export function useBlogCategoryCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BlogCategoryCreatePayload) =>
      unwrap(blogApi.categories.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

export function useBlogCategoryUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BlogCategoryUpdatePayload }) =>
      unwrap(blogApi.categories.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

export function useBlogCategoryDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(blogApi.categories.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.categories() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

// Tags
export function useBlogTags() {
  return useQuery({
    queryKey: queryKeys.blog.tags(),
    queryFn: () => unwrap(blogApi.tags.list()),
  });
}

export function useBlogTagCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BlogTagCreatePayload) =>
      unwrap(blogApi.tags.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.tags() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

export function useBlogTagUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BlogTagUpdatePayload }) =>
      unwrap(blogApi.tags.update(id, data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.tags() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

export function useBlogTagDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(blogApi.tags.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.tags() });
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

// Posts
export function useBlogPostsList(params?: {
  page?: number;
  per_page?: number;
  status_filter?: string;
  category_id?: string;
  tag_id?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: queryKeys.blog.posts.list(params ?? {}),
    queryFn: () => unwrap(blogApi.posts.list(params)),
  });
}

export function useBlogPost(postId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.blog.posts.detail(postId ?? ""),
    queryFn: () => unwrap(blogApi.posts.get(postId!)),
    enabled: enabled && !!postId,
  });
}

export function useBlogPostCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BlogPostCreatePayload) =>
      unwrap(blogApi.posts.create(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

export function useBlogPostUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BlogPostUpdatePayload }) =>
      unwrap(blogApi.posts.update(id, data)),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

export function useBlogPostDelete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(blogApi.posts.delete(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

export function useBlogPostPublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unwrap(blogApi.posts.publish(id)),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.blog.posts.lists() });
    },
  });
}

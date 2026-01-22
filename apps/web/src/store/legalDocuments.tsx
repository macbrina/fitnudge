"use client";

import { createBrowserClient } from "@/lib/supabase";

// Types for legal documents
export interface LegalDocument {
  id: string;
  type: "terms_of_service" | "privacy_policy" | "cookie_policy";
  version: string;
  title: string;
  content: string;
  effective_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

// Cache for legal documents
const documentCache: Map<
  string,
  { document: LegalDocument | null; timestamp: number }
> = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Fetch a legal document by type from the database
 * Uses in-memory caching for performance
 */
export async function fetchLegalDocument(
  type: "terms_of_service" | "privacy_policy" | "cookie_policy"
): Promise<LegalDocument | null> {
  // Check cache first
  const cached = documentCache.get(type);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.document;
  }

  try {
    const supabase = createBrowserClient();
    if (!supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("legal_documents")
      .select("*")
      .eq("type", type)
      .eq("is_current", true)
      .single();

    if (error) {
      return null;
    }

    // Cache the result
    documentCache.set(type, {
      document: data as LegalDocument,
      timestamp: Date.now(),
    });

    return data as LegalDocument;
  } catch {
    return null;
  }
}

/**
 * Clear the legal documents cache
 */
export function clearLegalDocumentsCache(): void {
  documentCache.clear();
}

/**
 * Static map of avatar id (1–32) to SVG asset.
 * Use @assetsimages/avatars/avatar-N.svg per user guidance.
 */
import type { ComponentType } from "react";

type SvgProps = { width?: number; height?: number };

/** SVG transformer may export { default } or the component directly; support both. */
const mod = (m: unknown): ComponentType<SvgProps> | null => {
  if (!m) return null;
  const x = m as { default?: unknown };
  const comp = x.default ?? x;
  if (typeof comp !== "function") return null;
  return comp as ComponentType<SvgProps>;
};

const map: Record<string, ComponentType<SvgProps> | null> = {
  "1": mod(require("@assetsimages/avatars/avatar-1.svg")),
  "2": mod(require("@assetsimages/avatars/avatar-2.svg")),
  "3": mod(require("@assetsimages/avatars/avatar-3.svg")),
  "4": mod(require("@assetsimages/avatars/avatar-4.svg")),
  "5": mod(require("@assetsimages/avatars/avatar-5.svg")),
  "6": mod(require("@assetsimages/avatars/avatar-6.svg")),
  "7": mod(require("@assetsimages/avatars/avatar-7.svg")),
  "8": mod(require("@assetsimages/avatars/avatar-8.svg")),
  "9": mod(require("@assetsimages/avatars/avatar-9.svg")),
  "10": mod(require("@assetsimages/avatars/avatar-10.svg")),
  "11": mod(require("@assetsimages/avatars/avatar-11.svg")),
  "12": mod(require("@assetsimages/avatars/avatar-12.svg")),
  "13": mod(require("@assetsimages/avatars/avatar-13.svg")),
  "14": mod(require("@assetsimages/avatars/avatar-14.svg")),
  "15": mod(require("@assetsimages/avatars/avatar-15.svg")),
  "16": mod(require("@assetsimages/avatars/avatar-16.svg")),
  "17": mod(require("@assetsimages/avatars/avatar-17.svg")),
  "18": mod(require("@assetsimages/avatars/avatar-18.svg")),
  "19": mod(require("@assetsimages/avatars/avatar-19.svg")),
  "20": mod(require("@assetsimages/avatars/avatar-20.svg")),
  "21": mod(require("@assetsimages/avatars/avatar-21.svg")),
  "22": mod(require("@assetsimages/avatars/avatar-22.svg")),
  "23": mod(require("@assetsimages/avatars/avatar-23.svg")),
  "24": mod(require("@assetsimages/avatars/avatar-24.svg")),
  "25": mod(require("@assetsimages/avatars/avatar-25.svg")),
  "26": mod(require("@assetsimages/avatars/avatar-26.svg")),
  "27": mod(require("@assetsimages/avatars/avatar-27.svg")),
  "28": mod(require("@assetsimages/avatars/avatar-28.svg")),
  "29": mod(require("@assetsimages/avatars/avatar-29.svg")),
  "30": mod(require("@assetsimages/avatars/avatar-30.svg")),
  "31": mod(require("@assetsimages/avatars/avatar-31.svg")),
  "32": mod(require("@assetsimages/avatars/avatar-32.svg"))
};

/** Normalize legacy "avatar_1" / "avatar-1" or "1" to "1"–"32", or null if invalid. */
export function normalizeAvatarId(id: string | null | undefined): string | null {
  if (!id) return null;
  const n = id.replace(/^avatar_/, "").replace(/^avatar-/, "");
  const num = parseInt(n, 10);
  return num >= 1 && num <= 32 ? String(num) : null;
}

/** True if value looks like a remote image URL (e.g. Google OAuth picture). */
export function isProfilePictureUrl(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  const v = value.trim().toLowerCase();
  return v.startsWith("http://") || v.startsWith("https://");
}

export function getAvatarSource(id: string): ComponentType<SvgProps> | null {
  const n = normalizeAvatarId(id) ?? id;
  const comp = map[n];
  return comp ?? null;
}

export const AVATAR_SOURCE_IDS = Object.keys(map);

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function storageUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//.test(path) || path.startsWith("/api/storage") || path.startsWith("data:")) {
    return path;
  }
  return `/api/storage${path.startsWith("/") ? "" : "/"}${path}`;
}

import type { StatusPage } from "@/lib/api/types";
import { DEFAULT_ACCENT, isHexColor } from "../status-meta";
import { SLUG_RE } from "../preview-data";

export interface EditorForm {
  title: string;
  slug: string;
  description: string;
  logoUrl: string;
  accentColor: string;
  websiteIds: string[];
  announcement: string;
  published: boolean;
  showIncidentHistory: boolean;
}

export type EditorErrors = Partial<Record<keyof EditorForm | "form", string>>;

export const LIMITS = { title: 100, description: 500, logoUrl: 500, announcement: 500 } as const;

/** Tasteful, non-purple accents. Stored as hex because the API accepts `#rrggbb`. */
export const ACCENT_SWATCHES: { name: string; value: string }[] = [
  { name: "Orange", value: "#ea580c" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#0d9488" },
  { name: "Sky", value: "#0284c7" },
  { name: "Blue", value: "#2563eb" },
  { name: "Slate", value: "#475569" },
  { name: "Graphite", value: "#27272a" },
  { name: "Amber", value: "#d97706" },
  { name: "Rose", value: "#e11d48" },
];

export function initialForm(page?: StatusPage): EditorForm {
  return {
    title: page?.title ?? "",
    slug: page?.slug ?? "",
    description: page?.description ?? "",
    logoUrl: page?.logoUrl ?? "",
    accentColor: isHexColor(page?.accentColor) ? page!.accentColor.toLowerCase() : DEFAULT_ACCENT,
    websiteIds: page?.websiteIds ?? [],
    announcement: page?.announcement ?? "",
    published: page?.published ?? true,
    showIncidentHistory: page?.showIncidentHistory ?? true,
  };
}

function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && Boolean(u.hostname);
  } catch {
    return false;
  }
}

export function validate(form: EditorForm): EditorErrors {
  const e: EditorErrors = {};
  if (!form.title.trim()) e.title = "Give the page a title.";
  else if (form.title.trim().length > LIMITS.title) e.title = `Keep the title under ${LIMITS.title} characters.`;
  if (!SLUG_RE.test(form.slug)) e.slug = "Use 3–48 lowercase letters, numbers and dashes; start and end with a letter or number.";
  if (form.description.length > LIMITS.description) e.description = `Keep it under ${LIMITS.description} characters.`;
  const logo = form.logoUrl.trim();
  if (logo && (!isHttpsUrl(logo) || logo.length > LIMITS.logoUrl)) e.logoUrl = "Use an https:// image URL.";
  if (!isHexColor(form.accentColor)) e.accentColor = "Use a hex color like #ea580c.";
  if (form.announcement.length > LIMITS.announcement) e.announcement = `Keep it under ${LIMITS.announcement} characters.`;
  return e;
}

/** Order in which fields appear, for focusing the first error. */
export const FIELD_ORDER: (keyof EditorForm)[] = ["title", "slug", "description", "logoUrl", "accentColor", "announcement"];

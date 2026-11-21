import type { PageStatus } from "./summary";

const STATUS_TEXT: Record<PageStatus, { text: string; color: string }> = {
  operational: { text: "operational", color: "#16a34a" },
  partial_outage: { text: "partial outage", color: "#d97706" },
  major_outage: { text: "major outage", color: "#dc2626" },
  unknown: { text: "unknown", color: "#6b7280" },
};

const escapeXml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Rough Verdana 11px width; good enough for badge layout. */
const textWidth = (s: string) => Math.round(s.length * 6.5 + 10);

/** Shields-style flat badge: "<label> | <status>". */
export function renderStatusBadge(status: PageStatus, label = "status"): string {
  const { text, color } = STATUS_TEXT[status];
  const l = escapeXml(label.slice(0, 40));
  const lw = textWidth(label.slice(0, 40));
  const rw = textWidth(text);
  const w = lw + rw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${l}: ${text}">
<title>${l}: ${text}</title>
<clipPath id="r"><rect width="${w}" height="20" rx="3"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#555"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14">${l}</text><text x="${lw + rw / 2}" y="14">${text}</text>
</g>
</svg>`;
}

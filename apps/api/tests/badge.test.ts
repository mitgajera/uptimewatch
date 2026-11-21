import { describe, expect, test } from "bun:test";
import { renderStatusBadge } from "../statusPages/badge";

describe("renderStatusBadge", () => {
  test("renders the status text and color", () => {
    const svg = renderStatusBadge("operational");
    expect(svg).toStartWith("<svg");
    expect(svg).toContain(">operational</text>");
    expect(svg).toContain("#16a34a");
    expect(svg).toContain('aria-label="status: operational"');
  });

  test("escapes the label", () => {
    const svg = renderStatusBadge("major_outage", `<script>"x"`);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&quot;x&quot;");
  });
});

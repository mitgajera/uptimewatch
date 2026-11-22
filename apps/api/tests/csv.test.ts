import { describe, expect, test } from "bun:test";
import { csvField, sendCsv, toCsv } from "../utils/csv";

describe("csvField", () => {
  test("leaves plain values alone and blanks null/undefined", () => {
    expect(csvField("UP")).toBe("UP");
    expect(csvField(200)).toBe("200");
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
    expect(csvField(new Date("2026-01-02T03:04:05Z"))).toBe("2026-01-02T03:04:05.000Z");
  });

  test("quotes fields with commas, quotes and line breaks", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField("cr\rlf")).toBe('"cr\rlf"');
  });

  test("defuses spreadsheet formulas", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("@cmd")).toBe("'@cmd");
    expect(csvField("+1,2")).toBe(`"'+1,2"`);
    // Numbers are data, not formulas.
    expect(csvField(-5)).toBe("-5");
  });
});

describe("toCsv / sendCsv", () => {
  test("builds CRLF-terminated rows", () => {
    expect(
      toCsv(
        ["a", "b"],
        [
          [1, "x,y"],
          [null, 'q"'],
        ]
      )
    ).toBe('a,b\r\n1,"x,y"\r\n,"q"""\r\n');
  });

  test("sends a download with a safe filename", () => {
    const res: any = {
      headers: {},
      status(c: number) {
        res.code = c;
        return res;
      },
      set(h: Record<string, string>) {
        Object.assign(res.headers, h);
        return res;
      },
      send(b: string) {
        res.body = b;
        return res;
      },
    };
    sendCsv(res, 'my "site"/x.csv', "a\r\n");
    expect(res.headers["Content-Type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["Content-Disposition"]).toBe('attachment; filename="my__site__x.csv"');
    expect(res.body).toBe("a\r\n");
  });
});

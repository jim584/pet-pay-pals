// Format parsers for veterinarian license source files.
// Every parser returns a plain array of { column -> value } rows; state-specific
// column naming is resolved later by the field mapping.
import type { FieldMapping, RawRow } from "./vet-license-normalize.ts";

export type FileFormat = "csv" | "tsv" | "xlsx" | "json" | "fixed_width";

function splitDelimited(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { quoted = false; }
      } else cur += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Splits a delimited document into logical lines, honouring quoted newlines. */
function splitRows(text: string): string[] {
  const rows: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { quoted = !quoted; cur += ch; continue; }
    if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (cur.trim() !== "") rows.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== "") rows.push(cur);
  return rows;
}

export function parseDelimited(text: string, delimiter = ","): RawRow[] {
  const lines = splitRows(text);
  if (lines.length === 0) return [];
  const header = splitDelimited(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, ""));
  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitDelimited(lines[i], delimiter);
    const row: RawRow = {};
    header.forEach((h, idx) => { row[h] = (cells[idx] ?? "").replace(/^"|"$/g, ""); });
    rows.push(row);
  }
  return rows;
}

export function parseFixedWidth(text: string, spec: [string, number, number][]): RawRow[] {
  return splitRows(text).map((line) => {
    const row: RawRow = {};
    for (const [field, start, len] of spec) row[field] = line.substr(start, len).trim();
    return row;
  });
}

function valueAtPath(obj: unknown, path?: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function parseJson(text: string, recordsPath?: string): RawRow[] {
  const doc = JSON.parse(text);
  const arr = valueAtPath(doc, recordsPath);
  if (Array.isArray(arr)) return arr as RawRow[];
  if (Array.isArray(doc)) return doc as RawRow[];
  throw new Error("JSON source did not contain an array of records (set mapping.records_path)");
}

export async function parseXlsx(bytes: Uint8Array): Promise<RawRow[]> {
  const XLSX = await import("npm:xlsx@0.18.5");
  const wb = XLSX.read(bytes, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) as RawRow[];
}

export async function parseSource(
  format: FileFormat,
  bytes: Uint8Array,
  mapping: FieldMapping,
): Promise<RawRow[]> {
  if (format === "xlsx") return await parseXlsx(bytes);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  switch (format) {
    case "csv": return parseDelimited(text, mapping.delimiter ?? ",");
    case "tsv": return parseDelimited(text, mapping.delimiter ?? "\t");
    case "json": return parseJson(text, mapping.records_path);
    case "fixed_width": {
      if (!mapping.fixed_width?.length) throw new Error("fixed_width format requires mapping.fixed_width");
      return parseFixedWidth(text, mapping.fixed_width);
    }
    default: throw new Error(`Unsupported file format: ${format}`);
  }
}

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, X, BadgeCheck } from "lucide-react";
import { searchVetLicenses, type VetLicenseRecord } from "@/lib/vet-licenses-api";
import { US_STATE_OPTIONS } from "@/lib/us-states";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  /** Selected license record id (pets.vet_of_record_license_id) */
  value: string | null;
  selected?: VetLicenseRecord | null;
  onChange: (record: VetLicenseRecord | null) => void;
}

export function LicensedVetPicker({ value, selected, onChange }: Props) {
  const [state, setState] = useState<string>("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VetLicenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await searchVetLicenses(query.trim(), state || null, 15);
        if (!cancelled) { setResults(data); setSearched(true); }
      } catch {
        if (!cancelled) { setResults([]); setSearched(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, state]);

  if (value && selected) {
    return (
      <div className="rounded-md border p-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <BadgeCheck className="h-4 w-4 text-primary" />
            {selected.full_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {selected.state} license #{selected.license_number}
            {selected.city ? ` · ${selected.city}` : ""}
          </p>
          <Badge variant="secondary" className="text-[10px]">Active in state records</Badge>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={state || "all"} onValueChange={(v) => setState(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="State" /></SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All states</SelectItem>
            {US_STATE_OPTIONS.map((s) => (
              <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by vet name or license number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Searching state license records…
        </p>
      )}

      {!loading && results.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => { onChange(r); setQuery(""); setResults([]); }}
              className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors"
            >
              <p className="text-sm font-medium">{r.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {r.state} #{r.license_number}
                {r.city ? ` · ${r.city}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No active standard veterinary license found for that search. Your state's data may not be imported yet.
        </p>
      )}
    </div>
  );
}

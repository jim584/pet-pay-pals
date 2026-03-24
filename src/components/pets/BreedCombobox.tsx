import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface BreedComboboxProps {
  breeds: readonly string[];
  value: string;
  onChange: (value: string) => void;
  mixedBreedDetail?: string;
  onMixedBreedDetailChange?: (detail: string) => void;
}

export function BreedCombobox({ breeds, value, onChange, mixedBreedDetail, onMixedBreedDetailChange }: BreedComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn(!value && "text-muted-foreground")}>
              {value || "Select breed..."}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search breeds..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                {search.trim() ? (
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded-sm"
                    onClick={() => {
                      onChange(search.trim());
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    Use "{search.trim()}"
                  </button>
                ) : (
                  "No breed found."
                )}
              </CommandEmpty>
              <CommandGroup className="max-h-60 overflow-y-auto">
                {breeds.map((breed) => (
                  <CommandItem
                    key={breed}
                    value={breed}
                    onSelect={() => {
                      onChange(breed === value ? "" : breed);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === breed ? "opacity-100" : "opacity-0")} />
                    {breed}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value === "Mixed Breed" && onMixedBreedDetailChange && (
        <Input
          value={mixedBreedDetail ?? ""}
          onChange={(e) => onMixedBreedDetailChange(e.target.value)}
          placeholder="Describe the mix (e.g. Golden Retriever / Poodle)"
        />
      )}
    </div>
  );
}
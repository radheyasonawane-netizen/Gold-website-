"use client";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettings, type Mode } from "@/components/providers";

export function ModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useSettings();
  return (
    <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as Mode)} aria-label="Display mode" className={className}>
      <ToggleGroupItem value="simple" aria-label="Simple mode">
        Simple
      </ToggleGroupItem>
      <ToggleGroupItem value="advanced" aria-label="Advanced mode">
        Advanced
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

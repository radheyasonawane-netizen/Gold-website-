"use client";
import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return <ToggleGroupPrimitive.Root data-slot="toggle-group" className={cn("inline-flex items-center rounded-full border border-border bg-soft-pink p-1", className)} {...props} />;
}
function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-8 min-w-10 cursor-pointer items-center justify-center rounded-full px-3 text-xs font-semibold tracking-wide text-muted-foreground transition-all outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-gold/30 disabled:pointer-events-none disabled:opacity-35 data-[state=on]:bg-charcoal data-[state=on]:text-white data-[state=on]:shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
export { ToggleGroup, ToggleGroupItem };

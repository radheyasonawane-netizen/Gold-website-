import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3 py-2 text-sm tabular-nums shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-gold focus-visible:ring-[3px] focus-visible:ring-gold/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-down",
        className,
      )}
      {...props}
    />
  );
}
export { Input };

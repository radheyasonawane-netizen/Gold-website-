"use client";
import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

const TooltipProvider = ({ delayDuration = 150, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) => <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
const Tooltip = (props: React.ComponentProps<typeof TooltipPrimitive.Root>) => <TooltipPrimitive.Root {...props} />;
const TooltipTrigger = (props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) => <TooltipPrimitive.Trigger {...props} />;
function TooltipContent({ className, sideOffset = 6, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content sideOffset={sideOffset} className={cn("z-50 max-w-72 rounded-xl bg-charcoal px-3 py-2 text-xs leading-relaxed text-white shadow-lg animate-in fade-in-0 zoom-in-95", className)} {...props}>
        {children}
        <TooltipPrimitive.Arrow className="fill-charcoal" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };

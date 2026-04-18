"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-[oklch(0.7_0.2_155)]" />
        ),
        info: <InfoIcon className="size-4 text-[oklch(0.7_0.22_260)]" />,
        warning: (
          <TriangleAlertIcon className="size-4 text-[oklch(0.85_0.18_90)]" />
        ),
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-primary" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: [
            "flex items-start gap-3 w-full p-4 rounded-xl",
            "bg-popover/90 backdrop-blur-md",
            "border border-border/60",
            "shadow-[0_8px_32px_oklch(0_0_0/0.45)]",
            "text-popover-foreground",
          ].join(" "),
          error: [
            "!border-destructive/50",
            "shadow-[0_0_24px_oklch(0.65_0.25_25/0.25),0_8px_32px_oklch(0_0_0/0.45)]",
          ].join(" "),
          success: [
            "!border-[oklch(0.7_0.2_155)]/50",
            "shadow-[0_0_24px_oklch(0.7_0.2_155/0.25),0_8px_32px_oklch(0_0_0/0.45)]",
          ].join(" "),
          warning: [
            "!border-[oklch(0.85_0.18_90)]/50",
            "shadow-[0_0_24px_oklch(0.85_0.18_90/0.2),0_8px_32px_oklch(0_0_0/0.45)]",
          ].join(" "),
          info: [
            "!border-[oklch(0.7_0.22_260)]/50",
            "shadow-[0_0_24px_oklch(0.7_0.22_260/0.25),0_8px_32px_oklch(0_0_0/0.45)]",
          ].join(" "),
          title: "text-sm font-semibold leading-tight",
          description: "text-xs text-muted-foreground leading-relaxed mt-0.5",
          icon: "shrink-0 mt-0.5",
          closeButton:
            "!border-border/60 !bg-popover/90 !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

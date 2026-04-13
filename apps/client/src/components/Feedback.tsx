import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import type { FeedbackState } from "../types";

const CONFIG: Record<
  FeedbackState["type"],
  { className: string; Icon: typeof CheckCircle }
> = {
  success: {
    className:
      "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 glow-success",
    Icon: CheckCircle,
  },
  error: {
    className: "bg-red-500/10 text-red-300 border-red-500/30",
    Icon: XCircle,
  },
  warning: {
    className: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    Icon: AlertTriangle,
  },
  neutral: {
    className: "bg-muted text-muted-foreground border-border/50",
    Icon: Info,
  },
};

export function Feedback({ feedback }: { feedback: FeedbackState }) {
  if (!feedback.visible) return null;

  const { className, Icon } = CONFIG[feedback.type];

  return (
    <div
      className={`mt-6 p-4 rounded-xl text-center text-lg font-semibold border flex items-center justify-center gap-2 ${className}`}
    >
      <Icon className="size-5 shrink-0" />
      {feedback.html ? (
        <span dangerouslySetInnerHTML={{ __html: feedback.html }} />
      ) : (
        feedback.text
      )}
    </div>
  );
}

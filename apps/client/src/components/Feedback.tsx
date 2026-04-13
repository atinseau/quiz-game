import type { FeedbackState } from "../types";

const STYLES: Record<FeedbackState["type"], string> = {
  success: "bg-emerald-950 text-emerald-300 border-emerald-800",
  error: "bg-red-950 text-red-300 border-red-800",
  warning: "bg-amber-950 text-amber-300 border-amber-800",
  neutral: "bg-gray-800 text-gray-300 border-gray-700",
};

export function Feedback({ feedback }: { feedback: FeedbackState }) {
  if (!feedback.visible) return null;

  return (
    <div className={`mt-6 p-4 rounded-xl text-center text-lg font-semibold border ${STYLES[feedback.type]}`}>
      {feedback.html ? (
        <span dangerouslySetInnerHTML={{ __html: feedback.html }} />
      ) : (
        feedback.text
      )}
    </div>
  );
}

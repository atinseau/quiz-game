import type { DrinkAlertDetails as Details } from "../../../shared/types";
import { CourageDetails } from "./CourageDetails";

/**
 * Renders the right per-kind detail block inside a `<DrinkAlert>`. To add a
 * new kind: extend `DrinkAlertDetails` in shared/types.ts, drop a renderer
 * component in this folder, and add its case to the switch below.
 */
export function DrinkAlertDetails({ details }: { details: Details }) {
  switch (details.kind) {
    case "courage":
      return (
        <CourageDetails
          givenAnswer={details.givenAnswer}
          correctAnswer={details.correctAnswer}
        />
      );
    default: {
      // Exhaustive check — new kinds must handle themselves above.
      const _exhaustive: never = details.kind;
      return _exhaustive;
    }
  }
}

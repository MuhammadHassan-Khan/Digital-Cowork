/**
 * Turn zod validation failures into a React form-state map keyed by field.
 * Shared by all action modules (pure — unit-testable).
 */

export interface ZodLikeError {
  issues: { path: PropertyKey[]; message: string }[];
}

export function fieldErrorsOf(
  error: ZodLikeError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

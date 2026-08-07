// Kept out of the "use server" action files (which may only export async
// functions) so both the actions and any client code that needs
// instanceof checks can import these.

export class CodeImmutableError extends Error {
  constructor() {
    super("This programme's code can't change — it already has an enrolment and appears on candidate certificates.");
    this.name = "CodeImmutableError";
  }
}

/** Carries the specific list of publish-check failures — README: "Return the specific failures, not a generic refusal." */
export class PublishCheckError extends Error {
  failures: string[];
  constructor(failures: string[]) {
    super(failures.join(" "));
    this.name = "PublishCheckError";
    this.failures = failures;
  }
}

export class QuizValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuizValidationError";
  }
}

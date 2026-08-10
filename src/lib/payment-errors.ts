// Plain module, not a "use server" file — a "use server" file can only
// export async functions, and these are plain error classes.

export class LiveEnrolmentExistsError extends Error {
  constructor() {
    super("You already have a live enrolment in this programme.");
    this.name = "LiveEnrolmentExistsError";
  }
}

export class PaymentNotPendingError extends Error {
  constructor() {
    super("This payment has already been settled.");
    this.name = "PaymentNotPendingError";
  }
}

export class ProgrammeNotOpenError extends Error {
  constructor() {
    super("This programme is not open for enrolment.");
    this.name = "ProgrammeNotOpenError";
  }
}

/**
 * Slice 11 Part C rule 1: archiving blocks enrolment in initiatePayment
 * itself, not only in the UI — a stale form post or a direct call must
 * be refused. Pulled out as a plain function (rather than left inline in
 * payment.ts's "use server" action) so this rule is directly testable
 * without a request context.
 */
export function assertProgrammeOpenForEnrolment(programme: { status: string }) {
  if (programme.status !== "ACTIVE") throw new ProgrammeNotOpenError();
}

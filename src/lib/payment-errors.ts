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

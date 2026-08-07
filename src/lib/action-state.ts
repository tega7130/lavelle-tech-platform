// Split out from candidate-auth.ts: a "use server" file can only export
// async functions — a plain interface/const export breaks the build
// ("A 'use server' file can only export async functions, found object").
export interface FormActionState {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  ok?: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export const emptyActionState: FormActionState = {};

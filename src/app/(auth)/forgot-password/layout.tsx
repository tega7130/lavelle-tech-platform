import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | Lavelle Institute",
  description: "Reset the password for your Lavelle Institute candidate account.",
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

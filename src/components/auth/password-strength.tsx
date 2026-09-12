"use client";

import { STAFF_PASSWORD_RULES } from "@/lib/validation/staff";

export { STAFF_PASSWORD_RULES };

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const metRules = STAFF_PASSWORD_RULES.filter((rule) => rule.test(password));
  const percentage = (metRules.length / STAFF_PASSWORD_RULES.length) * 100;

  return (
    <div className="mt-2">
      <div className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden">
        <div
          className="h-full transition-all duration-200"
          style={{
            width: `${percentage}%`,
            backgroundColor:
              percentage === 100
                ? "#10b981"
                : percentage >= 75
                  ? "#f59e0b"
                  : percentage >= 50
                    ? "#f97316"
                    : "#ef4444",
          }}
        />
      </div>
      <div className="mt-2 space-y-1">
        {STAFF_PASSWORD_RULES.map((rule) => (
          <div key={rule.key} className="flex items-center gap-2 text-[12px]">
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-white text-[10px] font-bold ${
                rule.test(password) ? "bg-green-600" : "bg-neutral-300"
              }`}
            >
              {rule.test(password) ? "✓" : "•"}
            </span>
            <span className={rule.test(password) ? "text-neutral-600" : "text-neutral-400"}>
              {rule.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

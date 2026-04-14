
import { useMemo } from "react";

interface Props {
  password: string;
}

export function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  return score;
}

export function validatePasswordRequirements(password: string) {
  const errors: string[] = [];
  if (password.length < 6) errors.push("Минимум 6 символа");
  if (!/[0-9]/.test(password)) errors.push("Поне една цифра");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Поне един специален знак (!@#$%...)");
  return errors;
}

const labels = ["Много слаба", "Слаба", "Средна", "Добра", "Силна", "Отлична"];
const colors = [
  "bg-destructive",
  "bg-destructive",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-green-600",
];

export default function PasswordStrengthIndicator({ password }: Props) {
  const score = useMemo(() => getPasswordStrength(password), [password]);
  const errors = useMemo(() => validatePasswordRequirements(password), [password]);

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < score ? colors[score] : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {labels[score]}
        </span>
      </div>
      {errors.length > 0 && (
        <ul className="space-y-0.5">
          {errors.map((e) => (
            <li key={e} className="text-xs text-destructive">• {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

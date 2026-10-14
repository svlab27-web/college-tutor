// Переменные окружения. Значения — только в Vercel / .env на сервере, никогда в коде и логах.

export function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export class ConfigError extends Error {
  constructor(public readonly variable: string) {
    super(`Не задана переменная окружения ${variable}`);
  }
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new ConfigError(name);
  return value;
}

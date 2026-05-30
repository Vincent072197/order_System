import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),

  TABLE_TOKEN_SECRET: z
    .string()
    .min(32, "TABLE_TOKEN_SECRET must be at least 32 chars"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

let placeholderChecked = false;
/**
 * Call once on the first real server request (not at module load) to enforce
 * that production deployments have replaced the dev placeholder secret. Doing
 * this lazily lets `next build` succeed on developer machines.
 */
export function assertProductionSecrets(): void {
  if (placeholderChecked) return;
  placeholderChecked = true;
  const env = loadEnv();
  if (
    env.NODE_ENV === "production" &&
    env.TABLE_TOKEN_SECRET.startsWith("dev-only-")
  ) {
    throw new Error(
      "TABLE_TOKEN_SECRET still has the dev-only placeholder. Refusing to serve in production.",
    );
  }
}

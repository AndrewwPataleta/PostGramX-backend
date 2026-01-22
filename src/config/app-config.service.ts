import dotenv from "dotenv";
import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_BOT_USERNAME: z
    .string()
    .min(1, "TELEGRAM_BOT_USERNAME is required")
    .transform((value) => (value.startsWith("@") ? value : `@${value}`)),
  APP_PUBLIC_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  PORT: z.string().optional()
});

dotenv.config();
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  const messages = Object.entries(errors)
    .map(([key, value]) => `${key}: ${value?.join(", ")}`)
    .join("; ");
  throw new Error(`Environment validation failed: ${messages}`);
}

export class AppConfigService {
  readonly telegramBotToken = parsed.data.TELEGRAM_BOT_TOKEN;
  readonly telegramBotUsername = parsed.data.TELEGRAM_BOT_USERNAME;
  readonly appPublicUrl = parsed.data.APP_PUBLIC_URL;
  readonly databaseUrl = parsed.data.DATABASE_URL;
  readonly jwtSecret = parsed.data.JWT_SECRET ?? "development-secret";
  readonly port = parsed.data.PORT ? Number(parsed.data.PORT) : 3000;
}

import { z } from "zod";
import { BOARD_COLORS } from "./db/schema.js";
import { NotFoundError } from "./errors.js";

export const nameSchema = z.string().trim().min(1).max(100);
export const titleSchema = z.string().trim().min(1).max(200);
export const colorSchema = z.enum(BOARD_COLORS);

const uuidSchema = z.uuid();

/** Un id mal formado se trata como inexistente (404). */
export function uuidParam(value: string): string {
  if (!uuidSchema.safeParse(value).success) throw new NotFoundError();
  return value;
}

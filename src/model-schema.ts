import { z } from "zod";

export const reasoningEffort = z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);
export const modelValues = z.object({ model: z.string(), provider: z.string(), reasoning: z.string(), reasoningWire: z.string() });
export const modelOption = z.object({
  model: z.string().min(1).max(512), provider: z.string().min(1).max(128), label: z.string().max(1024),
  available: z.boolean(), reasoning: z.boolean(), canDisableReasoning: z.boolean(),
});
export const modelState = z.object({
  contextUsage: z.object({ usedTokens: z.number().nonnegative(), maxTokens: z.number().positive() }).nullable().optional(),
  usage: z.array(z.object({ provider: z.string(), label: z.string(), usedPercent: z.number().min(0).max(100), resetsAt: z.string().nullable() })).optional(),
  logicalSessionId: z.string().min(1), selection: modelValues, options: z.array(modelOption).max(5000),
  revision: z.number().int().nonnegative(), generation: z.number().int().nonnegative(), running: z.boolean(),
});
export const modelChange = z.discriminatedUnion("status", [
  z.object({ status: z.literal("confirmation_required"), confirm: z.string().regex(/^[0-9a-f]{64}$/), message: z.string().max(4000) }),
  z.object({ status: z.enum(["applied", "deferred"]), settings: modelState }),
]);
export type ModelState = z.infer<typeof modelState>;
export type ModelOption = z.infer<typeof modelOption>;
export type ModelPick = { readonly kind: "model"; readonly model: string; readonly provider: string }
  | { readonly kind: "reasoning"; readonly effort: z.infer<typeof reasoningEffort> };
export function modelKey(value: { readonly model: string; readonly provider: string }): string {
  return JSON.stringify([value.provider, value.model]);
}

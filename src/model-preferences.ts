import { modelKey } from "./model-schema";
import type { ModelOption } from "./model-schema";

export function modelName(model: string): string {
  return model.replace(/^gpt-/i, "GPT-").replace(/-(luna|sol|astra|terra)$/i, (_, name: string) => ` ${name.charAt(0).toUpperCase()}${name.slice(1)}`);
}

export function visibleOptions(options: readonly ModelOption[], order: readonly string[] | null, provider = ""): readonly ModelOption[] {
  if (order === null) return [...options.filter((item) => item.provider === provider), ...options.filter((item) => item.provider !== provider)].slice(0, 8);
  const byKey = new Map(options.map((option) => [modelKey(option), option]));
  return [...new Set(order)].flatMap((key) => { const option = byKey.get(key); return option ? [option] : []; });
}

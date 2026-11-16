import { z } from "zod";
import { environmentDetails } from "./environment";
import { modelValues } from "./model-schema";

export const operationId = z.uuid().brand<"OperationId">();
export const sessionId = z.string().min(1).brand<"SessionId">();
export const phase = z.enum(["preparing", "admitted", "queued", "running", "completed", "failed", "cancelled", "unknown", "expired"]);
export const operation = z.object({
  operationId, logicalSessionId: z.string(), phase,
  profileId: z.string(), kind: z.string(), payloadHash: z.string(),
  result: z.record(z.string(), z.unknown()),
});
export type Operation = z.infer<typeof operation>;
export const message = z.object({
  id: z.string(), role: z.string(), text: z.string(), name: z.string(),
  compaction: z.boolean(), truncated: z.boolean(),
});
export type Message = z.infer<typeof message>;
export const question = z.object({
  qid: z.string(), question: z.string(), choices: z.array(z.string()).nullish(),
  multi_select: z.boolean().optional(),
});
export const requestCard = z.object({
  requestId: z.string(), kind: z.enum(["approval", "clarify", "unsupported"]),
  nativeKind: z.string(), generation: z.number().nullable(),
  state: z.enum(["open", "responding"]), question: z.string(), command: z.string(),
  choices: z.array(z.string()), questions: z.array(question),
  lockedAnswers: z.record(z.string(), z.string().nullable()), timeoutSeconds: z.number().nullish(),
});
export type RequestCard = z.infer<typeof requestCard>;
export const history = z.object({
  messages: z.array(message), nextCursor: z.string().nullable(), reset: z.boolean(),
});
export const snapshot = history.extend({
  logicalSessionId: sessionId, profileId: z.string(), title: z.string(), source: z.string(),
  running: z.boolean(), revision: z.number(), generation: z.number(), replayEpoch: z.string(),
  sequence: z.number(), instanceId: z.string(), requests: z.array(requestCard),
  operations: z.array(operation),
  modelSettings: modelValues.nullable().default(null),
});
export type Snapshot = z.infer<typeof snapshot>;
export const summary = z.object({
  logicalSessionId: sessionId, profileId: z.string(), title: z.string(), source: z.string(),
  lastActiveAt: z.number().nullable(), running: z.boolean(), canResume: z.boolean(), canFork: z.boolean(),
});
export const sessionList = z.object({
  summaries: z.array(summary), nextCursor: z.string().nullable(), listingComplete: z.boolean(),
  searchScope: z.string(), loadedCount: z.number(),
});
export type SessionList = z.infer<typeof sessionList>;
export const hello = z.object({
  apiVersion: z.literal(1), serverId: z.string(), profileId: z.string(), profileName: z.string(),
  instanceId: z.string(), codeSha: z.string(), capabilities: z.array(z.string()),
});
export const pending = z.object({
  operationId, serverId: z.string(), profileId: z.string(), logicalSessionId: z.string(),
  kind: z.enum(["send", "create", "fork"]),
});
export type Pending = z.infer<typeof pending>;
export const settingsSchema = z.object({
  deviceLabel: z.string().max(100).default("Obsidian 기기"),
  endpoint: z.string().default(""),
  profileId: z.string().default(""),
  environment: environmentDetails.default(() => environmentDetails.parse({})),
  serverId: z.string().default(""), lastSession: z.string().default(""),
  pending: z.array(pending).default([]),
  visibleModels: z.array(z.string()).nullable().default(null),
  desktopFontStep: z.number().int().min(-4).max(4).default(-2),
  mobileFontStep: z.number().int().min(-4).max(4).default(-2),
});
export type Settings = z.infer<typeof settingsSchema>;
export const eventSchema = z.object({
  logicalSessionId: sessionId, instanceId: z.string(), replayEpoch: z.string().nullish(),
  sequence: z.number().nullish(), kind: z.string(), text: z.string().nullish(),
  turnId: z.string().nullish(), segment: z.number().nullish(), offset: z.number().nullish(),
  toolId: z.string().nullish(), name: z.string().nullish(), summary: z.string().nullish(),
  result: z.unknown().optional(),
});
export type NativeEvent = z.infer<typeof eventSchema>;

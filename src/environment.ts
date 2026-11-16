import { z } from "zod";
import { BridgeError } from "./errors";
import { endpoint } from "./transport";
import type { Settings } from "./schema";

export const ENVIRONMENT_LIMIT = 128 * 1024;
const printable = (input: string): boolean => [...input].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
const value = z.string().max(2048).refine(printable);
const reference = value.min(1).max(512);
const referenceList = z.array(reference).max(100);
export const environmentDetails = z.object({
  tailscaleIp: z.union([z.literal(""), z.ipv4(), z.ipv6()]).default(""),
  ubuntuUser: value.max(64).default(""),
  windowsVaultPath: value.default(""),
  ubuntuHomePath: value.default(""),
  ubuntuPluginPath: value.default(""),
  hermesExecutable: value.default(""),
  bridgeStatePath: value.default(""),
  profileName: value.max(64).default(""),
  slackChannelIds: z.array(z.string().regex(/^[CDG][A-Z0-9]{6,31}$/)).max(100).default([]),
  verificationSessionIds: referenceList.default([]),
  operationIds: referenceList.default([]),
}).strict();
export type EnvironmentDetails = z.infer<typeof environmentDetails>;

const httpsOrigin = value.min(1).refine((input) => {
  try { endpoint(input); return true; }
  catch (error) { if (error instanceof BridgeError) return false; throw error; }
}, "경로와 인증 정보가 없는 HTTPS 주소가 필요합니다.").transform((input) => endpoint(input).origin);

export const environmentProfile = z.object({
  format: z.literal("kk-hermes-connect/environment"),
  version: z.literal(1),
  connection: z.object({ endpoint: httpsOrigin, profileId: value.min(1) }).strict(),
  environment: environmentDetails,
}).strict();
export type EnvironmentProfile = z.infer<typeof environmentProfile>;

export function parseEnvironment(contents: string): EnvironmentProfile {
  if (new TextEncoder().encode(contents).byteLength > ENVIRONMENT_LIMIT) throw new BridgeError("environment_too_large");
  const normalized = contents.trim();
  if (!normalized) throw new BridgeError("environment_empty_json");
  let parsed: unknown;
  try { parsed = JSON.parse(normalized); }
  catch (error) { if (error instanceof SyntaxError) throw new BridgeError("environment_invalid_json"); throw error; }
  const result = environmentProfile.safeParse(parsed);
  if (!result.success) throw new BridgeError("environment_invalid_schema");
  return result.data;
}

export function exportEnvironment(settings: Settings): string {
  const profile = environmentProfile.safeParse({
    format: "kk-hermes-connect/environment", version: 1,
    connection: { endpoint: settings.endpoint, profileId: settings.profileId },
    environment: settings.environment,
  });
  if (!profile.success) throw new BridgeError("environment_invalid_schema");
  return JSON.stringify(profile.data, null, 2) + "\n";
}

export function planEnvironmentImport(settings: Settings, profile: EnvironmentProfile): {
  readonly settings: Settings; readonly connectionChanged: boolean;
} {
  let currentOrigin = settings.endpoint;
  try { if (settings.endpoint) currentOrigin = endpoint(settings.endpoint).origin; }
  catch (error) { if (!(error instanceof BridgeError)) throw error; }
  const connectionChanged = currentOrigin !== profile.connection.endpoint || settings.profileId !== profile.connection.profileId;
  if (connectionChanged && settings.pending.length > 0) throw new BridgeError("environment_pending_operations");
  return { connectionChanged, settings: {
    ...settings, endpoint: profile.connection.endpoint, profileId: profile.connection.profileId,
    environment: profile.environment,
    serverId: connectionChanged ? "" : settings.serverId,
    lastSession: connectionChanged ? "" : settings.lastSession,
  } };
}

export function privateExportPath(input: string): string {
  const path = input.trim().replaceAll("\\", "/");
  if (!path || !printable(path) || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === "..") || /[:*?"<>|]/.test(path) || !path.endsWith(".private.json") || path.split("/").some((part) => part.startsWith("."))) {
    throw new BridgeError("environment_invalid_path");
  }
  return path;
}

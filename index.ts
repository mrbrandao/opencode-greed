import type { Plugin, PluginOptions } from "@opencode-ai/plugin";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  CORE_AGENT_NAMES,
  DEFAULT_PROFILES,
  OMO_CANONICAL_AGENT_NAMES,
  OMO_AGENT_TARGETS,
  type AgentOverride,
  type ProfileName,
} from "./constants.js";

const DEFAULT_PROFILE: ProfileName = "balanced";
const DEFAULT_THEME_NAME = "greed";
const PROFILE_STATE_FILE = "greed-profile.json";
const SAFE_THEME_NAME = /^[A-Za-z0-9_-]+$/;

export interface GreedPluginOptions extends PluginOptions {
  themeName?: string;
  profile?: ProfileName;
  profiles?: Partial<
    Record<ProfileName, Record<string, AgentOverride>>
  >;
  omo?: {
    enabled?: "auto" | boolean;
    agentColors?: boolean;
  };
}

type AgentConfig = Record<string, unknown>;

interface HostConfig {
  agent?: Record<string, AgentConfig | undefined>;
  default_agent?: string;
  plugin?: Array<string | [string, Record<string, unknown>]>;
}

function configHome(): string {
  return process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
}

/** Return a path-safe theme name, falling back to the bundled default. */
export function safeThemeName(value: unknown): string {
  return typeof value === "string" && SAFE_THEME_NAME.test(value)
    ? value
    : DEFAULT_THEME_NAME;
}

function profileStatePath(): string {
  return path.join(configHome(), "opencode", PROFILE_STATE_FILE);
}

function isProfile(value: unknown): value is ProfileName {
  return value === "economy" || value === "balanced" || value === "quality";
}

export function readPersistedProfile(): ProfileName | undefined {
  try {
    const contents = fs.readFileSync(profileStatePath(), "utf8");
    const parsed: unknown = JSON.parse(contents);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const profile = (parsed as { profile?: unknown }).profile;
    return isProfile(profile) ? profile : undefined;
  } catch {
    return undefined;
  }
}

/** Persist only Greed-owned state, atomically, in the user's config home. */
export function persistProfile(profile: ProfileName): boolean {
  const destination = profileStatePath();
  const directory = path.dirname(destination);
  const temporary = `${destination}.${process.pid}.tmp`;

  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      temporary,
      `${JSON.stringify({ profile }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    fs.renameSync(temporary, destination);
    return true;
  } catch (err) {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {
      // Preserve the original persistence failure.
    }
    console.error("[opencode-greed] Failed to persist profile:", err);
    return false;
  }
}

export function profileName(options: GreedPluginOptions | undefined): ProfileName {
  const requested = options?.profile;
  if (isProfile(requested)) return requested;
  return readPersistedProfile() ?? DEFAULT_PROFILE;
}

function agentDefaults(
  profile: ProfileName,
  agentName: string,
  overrides: GreedPluginOptions["profiles"],
): AgentConfig | undefined {
  const targetName = OMO_AGENT_TARGETS[agentName] ?? agentName;
  const bundled = DEFAULT_PROFILES[profile][targetName];
  const targetOverride = overrides?.[profile]?.[targetName];
  const liveOverride = overrides?.[profile]?.[agentName];

  if (!bundled && !targetOverride && !liveOverride) return undefined;
  return { ...bundled, ...targetOverride, ...liveOverride };
}

function isOmoAgentName(agentName: string): boolean {
  return (
    OMO_CANONICAL_AGENT_NAMES.includes(
      agentName as (typeof OMO_CANONICAL_AGENT_NAMES)[number],
    ) || agentName in OMO_AGENT_TARGETS
  );
}

function applyAgentDefaults(
  agents: Record<string, AgentConfig | undefined>,
  agentName: string,
  defaults: AgentConfig,
  applyColor: boolean,
): void {
  const existing = agents[agentName];
  if (!existing) return;

  const safeDefaults = { ...defaults };
  if (!applyColor) delete safeDefaults.color;
  agents[agentName] = { ...safeDefaults, ...existing };
}

function applyCoreAgents(
  agents: Record<string, AgentConfig | undefined>,
  profile: ProfileName,
  overrides: GreedPluginOptions["profiles"],
): void {
  for (const agentName of CORE_AGENT_NAMES) {
    const defaults = agentDefaults(profile, agentName, overrides);
    if (!defaults) continue;
    agents[agentName] = { ...defaults, ...agents[agentName] };
  }
}

function applyProfileAgents(
  agents: Record<string, AgentConfig | undefined>,
  profile: ProfileName,
  overrides: GreedPluginOptions["profiles"],
  omoEnabled: boolean,
  omoAgentColors: boolean,
): void {
  const profileAgents = new Set([
    ...Object.keys(DEFAULT_PROFILES[profile]),
    ...Object.keys(overrides?.[profile] ?? {}),
  ]);

  for (const agentName of profileAgents) {
    if (
      CORE_AGENT_NAMES.includes(
        agentName as (typeof CORE_AGENT_NAMES)[number],
      )
    ) {
      continue;
    }
    if (!agents[agentName]) continue;
    if (isOmoAgentName(agentName) && !omoEnabled) continue;

    const defaults = agentDefaults(profile, agentName, overrides);
    if (defaults) {
      applyAgentDefaults(
        agents,
        agentName,
        defaults,
        omoAgentColors || !isOmoAgentName(agentName),
      );
    }
  }

  if (!omoEnabled) return;

  for (const agentName of OMO_CANONICAL_AGENT_NAMES) {
    const defaults = agentDefaults(profile, agentName, overrides);
    if (!defaults) continue;
    if (!agents[agentName]) {
      const seeded = { ...defaults };
      if (!omoAgentColors) delete seeded.color;
      agents[agentName] = seeded;
      continue;
    }
    applyAgentDefaults(agents, agentName, defaults, omoAgentColors);
  }

  for (const agentName of Object.keys(OMO_AGENT_TARGETS)) {
    if (!agents[agentName] || profileAgents.has(agentName)) continue;
    const defaults = agentDefaults(profile, agentName, overrides);
    if (defaults) {
      applyAgentDefaults(agents, agentName, defaults, omoAgentColors);
    }
  }
}

function configuredOmoPlugin(config: HostConfig): boolean {
  return (config.plugin ?? []).some((entry) => {
    const name = typeof entry === "string" ? entry : entry[0];
    return /(?:^|[/@_-])oh-my-opencode(?:[-@]|$)/i.test(name);
  });
}

function hasOmoAgent(config: HostConfig): boolean {
  return Object.keys(config.agent ?? {}).some(
    (agentName) => OMO_CANONICAL_AGENT_NAMES.includes(
      agentName as (typeof OMO_CANONICAL_AGENT_NAMES)[number],
    ),
  );
}

function resolveOmoEnabled(
  configured: "auto" | boolean,
  config: HostConfig,
): boolean {
  if (configured === true) return true;
  if (configured === false) return false;
  return configuredOmoPlugin(config) || hasOmoAgent(config);
}

export function installTheme(themeName = DEFAULT_THEME_NAME) {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const srcThemePath = path.join(__dirname, "theme.json");
    if (!fs.existsSync(srcThemePath)) return;

    const userThemesDir = path.join(configHome(), "opencode", "themes");
    fs.mkdirSync(userThemesDir, { recursive: true });

    const destThemePath = path.join(
      userThemesDir,
      `${safeThemeName(themeName)}.json`,
    );
    if (!fs.existsSync(destThemePath)) {
      fs.copyFileSync(srcThemePath, destThemePath, fs.constants.COPYFILE_EXCL);
    }
  } catch (err) {
    console.error("[opencode-greed] Failed to install theme file:", err);
  }
}

export const GreedPlugin: Plugin = async (_input, options) => {
  const greedOptions = options as GreedPluginOptions | undefined;
  const themeName = safeThemeName(greedOptions?.themeName);
  const selectedProfile = profileName(greedOptions);
  const configuredOmo = greedOptions?.omo?.enabled ?? "auto";
  const omoAgentColors = greedOptions?.omo?.agentColors ?? true;

  installTheme(themeName);

  return {
    config: async (config) => {
      const hostConfig = config as HostConfig;
      hostConfig.agent ??= {};
      const omoEnabled = resolveOmoEnabled(configuredOmo, hostConfig);
      applyCoreAgents(
        hostConfig.agent,
        selectedProfile,
        greedOptions?.profiles,
      );
      applyProfileAgents(
        hostConfig.agent,
        selectedProfile,
        greedOptions?.profiles,
        omoEnabled,
        omoAgentColors,
      );
    },
  };
};

export const server = GreedPlugin;
export default {
  id: "opencode-greed",
  server: GreedPlugin,
};

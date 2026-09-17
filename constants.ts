/** Agent and profile colors owned by opencode-greed. */
export const AGENT_COLORS = {
  plan: "#22c55e", // Plan green: planning and analysis.
  build: "#a855f7", // Build purple: implementation work.
  orchestrator: "#f97316", // Orchestrator orange: delegated work.
  explorer: "#38bdf8", // Explorer sky blue: repository discovery.
  librarian: "#14b8a6", // Librarian teal: documentation and research.
  oracle: "#f59e0b", // Oracle amber: high-confidence reasoning.
  designer: "#ec4899", // Designer pink: interface and experience work.
  fixer: "#ef4444", // Fixer red: debugging and repair work.
} as const;

/** Colors used by the optional profile indicator. */
export const PROFILE_COLORS = {
  economy: "#64748b", // Economy slate: efficient, low-cost routing.
  balanced: "#3b82f6", // Balanced blue: the general-purpose preset.
  quality: "#8b5cf6", // Quality violet: maximum reasoning preset.
} as const;

/** Model IDs used by the bundled profiles. */
export const MODEL_IDS = {
  luna: "openai/gpt-5.6-luna",
  terra: "openai/gpt-5.6-terra",
  sol: "openai/gpt-5.6-sol",
} as const;

export type ProfileName = "economy" | "balanced" | "quality";

export interface AgentSettings {
  model: string;
  variant: string;
  color: string;
}

export type AgentOverride = Partial<AgentSettings>;

const settings = (
  model: string,
  variant: string,
  color: string,
): AgentSettings => ({ model, variant, color });

/** Bundled model, reasoning, and color defaults for each profile. */
export const DEFAULT_PROFILES: Record<
  ProfileName,
  Record<string, AgentSettings>
> = {
  economy: {
    plan: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.plan),
    build: settings(MODEL_IDS.luna, "low", AGENT_COLORS.build),
    orchestrator: settings(
      MODEL_IDS.luna,
      "medium",
      AGENT_COLORS.orchestrator,
    ),
    explorer: settings(MODEL_IDS.luna, "low", AGENT_COLORS.explorer),
    general: settings(MODEL_IDS.luna, "low", AGENT_COLORS.explorer),
    librarian: settings(MODEL_IDS.luna, "low", AGENT_COLORS.librarian),
    oracle: settings(MODEL_IDS.terra, "high", AGENT_COLORS.oracle),
    designer: settings(MODEL_IDS.luna, "low", AGENT_COLORS.designer),
    fixer: settings(MODEL_IDS.luna, "low", AGENT_COLORS.fixer),
  },
  balanced: {
    plan: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.plan),
    build: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.build),
    orchestrator: settings(
      MODEL_IDS.luna,
      "medium",
      AGENT_COLORS.orchestrator,
    ),
    explorer: settings(MODEL_IDS.luna, "low", AGENT_COLORS.explorer),
    general: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.explorer),
    librarian: settings(MODEL_IDS.luna, "low", AGENT_COLORS.librarian),
    oracle: settings(MODEL_IDS.sol, "high", AGENT_COLORS.oracle),
    designer: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.designer),
    fixer: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.fixer),
  },
  quality: {
    plan: settings(MODEL_IDS.terra, "high", AGENT_COLORS.plan),
    build: settings(MODEL_IDS.terra, "high", AGENT_COLORS.build),
    orchestrator: settings(
      MODEL_IDS.terra,
      "high",
      AGENT_COLORS.orchestrator,
    ),
    explorer: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.explorer),
    general: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.explorer),
    librarian: settings(MODEL_IDS.luna, "medium", AGENT_COLORS.librarian),
    oracle: settings(MODEL_IDS.sol, "high", AGENT_COLORS.oracle),
    designer: settings(MODEL_IDS.luna, "high", AGENT_COLORS.designer),
    fixer: settings(MODEL_IDS.luna, "high", AGENT_COLORS.fixer),
  },
};

/**
 * OMO aliases currently supported by the installed slim integration.
 *
 * These are aliases, rather than the regular OpenCode agent names. Keeping
 * the canonical target here makes profile application deterministic when a
 * user overrides either the alias or its target role.
 */
export const OMO_AGENT_TARGETS: Record<string, string> = {
  explore: "explorer",
  "frontend-ui-ux-engineer": "designer",
};

/** Canonical OMO agents supplied by the installed slim integration. */
export const OMO_CANONICAL_AGENT_NAMES = [
  "orchestrator",
  "explorer",
  "librarian",
  "oracle",
  "designer",
  "fixer",
] as const;

export const CORE_AGENT_NAMES = ["plan", "build"] as const;

/** Short explanation shown beside the active profile in the TUI. */
export const PROFILE_REASONING: Record<ProfileName, string> = {
  economy: "Efficient routing with lighter reasoning.",
  balanced: "General-purpose routing for everyday work.",
  quality: "Higher reasoning for difficult tasks.",
};

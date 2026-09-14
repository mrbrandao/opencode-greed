import type { Plugin, PluginOptions } from "@opencode-ai/plugin";
import type { TuiPlugin } from "@opencode-ai/plugin/dist/tui";

export const DEFAULT_COLORS = {
  plan: "#22c55e",
  build: "#a855f7",
} as const;

export interface GreedPluginOptions extends PluginOptions {
  planColor?: string;
  buildColor?: string;
  themeName?: string;
  agents?: Record<string, string>;
}

export const server: Plugin = async (_input, options) => {
  const greedOptions = options as GreedPluginOptions | undefined;
  const planColor = greedOptions?.planColor ?? DEFAULT_COLORS.plan;
  const buildColor = greedOptions?.buildColor ?? DEFAULT_COLORS.build;

  return {
    config: async (config) => {
      config.agent ??= {};
      config.agent.plan = {
        ...config.agent.plan,
        color: planColor,
      };
      config.agent.build = {
        ...config.agent.build,
        color: buildColor,
      };

      for (const [agentName, color] of Object.entries(
        greedOptions?.agents ?? {},
      )) {
        config.agent[agentName] = {
          ...config.agent[agentName],
          color,
        };
      }
    },
  };
};

export const tui: TuiPlugin = async (api, options) => {
  const greedOptions = options as GreedPluginOptions | undefined;
  const themeName = greedOptions?.themeName ?? "greed";
  const themePath = `${import.meta.dir}/theme.json`;

  await api.theme.install(themePath);
  api.theme.set(themeName);
};

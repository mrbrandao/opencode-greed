import type { Plugin, PluginOptions } from "@opencode-ai/plugin";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

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

export function installTheme(themeName = "greed") {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const srcThemePath = path.join(__dirname, "theme.json");
    if (!fs.existsSync(srcThemePath)) return;

    const userThemesDir = path.join(
      os.homedir(),
      ".config",
      "opencode",
      "themes",
    );
    fs.mkdirSync(userThemesDir, { recursive: true });

    const destThemePath = path.join(userThemesDir, `${themeName}.json`);
    fs.copyFileSync(srcThemePath, destThemePath);
  } catch (err) {
    console.error("[opencode-greed] Failed to install theme file:", err);
  }
}

export const GreedPlugin: Plugin = async (_input, options) => {
  const greedOptions = options as GreedPluginOptions | undefined;
  const planColor = greedOptions?.planColor ?? DEFAULT_COLORS.plan;
  const buildColor = greedOptions?.buildColor ?? DEFAULT_COLORS.build;
  const themeName = greedOptions?.themeName ?? "greed";

  installTheme(themeName);

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

export const server = GreedPlugin;
export default {
  id: "opencode-greed",
  server: GreedPlugin,
};

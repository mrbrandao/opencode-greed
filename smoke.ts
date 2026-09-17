import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  GreedPlugin,
  installTheme,
  profileName,
  readPersistedProfile,
  safeThemeName,
} from "./index.js";
import { buildGreedLayer, setup, tui } from "./tui.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const configHome = mkdtempSync(path.join(os.tmpdir(), "opencode-greed-"));
process.env.XDG_CONFIG_HOME = configHome;

try {
  assert(profileName({ profile: "quality" }) === "quality", "profile resolution failed");
  assert(safeThemeName("safe_theme-1") === "safe_theme-1", "safe theme rejected");
  assert(safeThemeName("../escape") === "greed", "unsafe theme accepted");
  installTheme("../escape");
  assert(
    existsSync(path.join(configHome, "opencode", "themes", "greed.json")),
    "safe theme fallback was not installed",
  );
  assert(typeof GreedPlugin === "function", "server export missing");
  assert(typeof tui === "function", "TUI export missing");
  const tuiSlots: any[] = [];
  await tui({
    slots: {
      register: (plugin: unknown) => {
        tuiSlots.push(plugin);
        return "greed-slot";
      },
    },
    event: { on: () => () => undefined },
    lifecycle: { onDispose: () => () => undefined },
  } as never, undefined, {} as never);
  assert(tuiSlots[0]?.slots?.sidebar_content, "TUI sidebar slot missing");

  const v2Slots: any[] = [];
  const v2Layers: any[] = [];
  const v2Context = {
    ui: {
      slot: (slot: unknown) => {
        v2Slots.push(slot);
        return () => undefined;
      },
      toast: { show: () => undefined },
    },
    keymap: {
      layer: (layer: unknown) => {
        v2Layers.push(layer);
        return () => undefined;
      },
    },
  };
  await setup(v2Context);
  assert(v2Slots.length === 1, "v2 slot was not registered");
  const v2State = { profile: "balanced" as const };
  const v2Layer = buildGreedLayer(v2Context, v2State)();
  assert(v2Layer.commands[0].slash.arguments, "v2 arguments flag missing");
  v2Layer.commands[0].run("quality");
  assert(readPersistedProfile() === "quality", "v2 switch did not persist");
  const pinnedState = { profile: "quality" as const, pinned: "quality" as const };
  buildGreedLayer(v2Context, pinnedState)().commands[0].run("economy");
  assert(readPersistedProfile() === "quality", "pinned v2 switch persisted");

  const hooks = await GreedPlugin({} as never, {
    profile: "balanced",
    profiles: {
      balanced: {
        explorer: { variant: "canonical" },
        explore: { model: "alias-model" },
      },
    },
  });
  const config = {
    plugin: ["oh-my-opencode-slim"],
    agent: {
      orchestrator: { model: "host-model", variant: "host-variant" },
      explore: { variant: "host-variant" },
    },
  } as Record<string, any>;
  await hooks.config?.(config);
  assert(config.agent.orchestrator.model === "host-model", "host model lost");
  assert(
    config.agent.orchestrator.variant === "host-variant",
    "host variant lost",
  );
  assert(config.agent.explore.model === "alias-model", "alias override lost");
  assert(config.agent.explorer.variant === "canonical", "canonical seed failed");
  assert(config.agent.librarian, "librarian was not seeded");
  assert(config.agent.oracle, "oracle was not seeded");
  assert(config.agent.designer, "designer was not seeded");
  assert(config.agent.fixer, "fixer was not seeded");

  const exploreOnlyHooks = await GreedPlugin({} as never, {
    profile: "balanced",
  });
  const exploreOnly = { agent: { explore: { model: "keep" } } } as Record<
    string,
    any
  >;
  await exploreOnlyHooks.config?.(exploreOnly);
  assert(!exploreOnly.agent.explorer, "explore alias falsely detected OMO");

  const disabledHooks = await GreedPlugin({} as never, {
    omo: { enabled: false },
  });
  const disabled = {
    agent: {
      orchestrator: { model: "keep" },
      explorer: { model: "keep" },
      explore: { model: "keep" },
    },
  } as Record<string, any>;
  await disabledHooks.config?.(disabled);
  assert(disabled.agent.orchestrator.model === "keep", "OMO false changed orchestrator");
  assert(disabled.agent.explorer.model === "keep", "OMO false changed explorer");
  assert(disabled.agent.explore.model === "keep", "OMO false changed alias");

  console.log("opencode-greed smoke passed");
} finally {
  rmSync(configHome, { recursive: true, force: true });
}

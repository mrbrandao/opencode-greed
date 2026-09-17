import { parseColor } from "@opentui/core";
import { createElement, insert, setProp } from "@opentui/solid";
import { createSignal } from "solid-js";
import type { TuiPlugin } from "@opencode-ai/plugin/tui";
import {
  PROFILE_COLORS,
  PROFILE_REASONING,
  type ProfileName,
} from "./constants.js";
import {
  persistProfile,
  profileName,
  type GreedPluginOptions,
} from "./index.js";

type TuiElement = ReturnType<typeof createElement>;
type Child = TuiElement | string | null | undefined | false;

/** Minimal v2 context surface, kept capability-based for mixed hosts. */
export interface GreedV2Context {
  keymap?: {
    layer?: (factory: () => GreedV2Layer) => unknown;
  };
  ui?: {
    slot?: (input: {
      append: string;
      render: () => unknown;
    }) => unknown;
    toast?: {
      show?: (input: { message: string; variant?: string }) => void;
    };
    dialog?: {
      select?: (input: {
        title: string;
        options: Array<{ title: string; value: ProfileName }>;
        current?: ProfileName;
      }) => Promise<unknown>;
    };
  };
  config?: { plugin?: unknown };
  options?: GreedPluginOptions;
  renderer?: { requestRender?: () => void };
}

export interface GreedV2Layer {
  mode: "global";
  commands: Array<{
    id: string;
    title: string;
    group: string;
    palette: boolean;
    slash: { name: string; arguments: true };
    run: (input: unknown) => void;
  }>;
}

export interface GreedTuiState {
  profile: ProfileName;
  pinned?: ProfileName;
}

function element(
  tag: string,
  props: Record<string, unknown>,
  children: Child[] = [],
): TuiElement {
  const node = createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) setProp(node, key, value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    insert(node, child);
  }
  return node;
}

function text(props: Record<string, unknown>, children: string[]): TuiElement {
  return element("text", props, children);
}

function sidebarContent(profile: ProfileName): TuiElement {
  const color = parseColor(PROFILE_COLORS[profile]);
  return element("box", { width: "100%", flexDirection: "column" }, [
    text({ fg: color }, [`Preset: ${profile.toUpperCase()}`]),
    text({ fg: color }, [`Reasoning: ${PROFILE_REASONING[profile]}`]),
  ]);
}

function validProfile(value: unknown): value is ProfileName {
  return value === "economy" || value === "balanced" || value === "quality";
}

function selectedArgument(argumentsText: string): ProfileName | undefined {
  const value = argumentsText.trim().split(/\s+/)[0];
  return validProfile(value) ? value : undefined;
}

function pinnedFromEntries(entries: unknown): ProfileName | undefined {
  if (!Array.isArray(entries)) return undefined;
  for (const entry of entries) {
    if (!Array.isArray(entry) || typeof entry[0] !== "string") continue;
    if (!entry[0].includes("opencode-greed")) continue;
    const options = entry[1];
    if (typeof options !== "object" || options === null) continue;
    const profile = (options as { profile?: unknown }).profile;
    if (validProfile(profile)) return profile;
  }
  return undefined;
}

function configuredPinnedProfile(
  api: Parameters<TuiPlugin>[0],
  options: GreedPluginOptions | undefined,
): ProfileName | undefined {
  if (validProfile(options?.profile)) return options.profile;
  return pinnedFromEntries(
    (api.state?.config as { plugin?: unknown } | undefined)?.plugin,
  );
}

function v2PinnedProfile(
  context: GreedV2Context,
  options: GreedPluginOptions | undefined,
): ProfileName | undefined {
  if (validProfile(options?.profile)) return options.profile;
  return (
    validProfile(context.options?.profile)
      ? context.options.profile
      : pinnedFromEntries(context.config?.plugin)
  );
}

function pinnedMessage(profile: ProfileName): string {
  return `${profile} is pinned by the TUI plugin profile option; restart and remove the pin to switch.`;
}

function v2Toast(
  context: GreedV2Context,
  message: string,
  variant?: string,
): void {
  context.ui?.toast?.show?.({ message, variant });
}

async function runGreedFlow(
  context: GreedV2Context,
  argument: unknown,
  state: GreedTuiState,
): Promise<void> {
  const argumentText = typeof argument === "string" ? argument.trim() : "";
  let selected = selectedArgument(argumentText);

  if (!argumentText) {
    const dialog = context.ui?.dialog;
    if (typeof dialog?.select !== "function") {
      v2Toast(context, "Use /greed economy, /greed balanced, or /greed quality.", "warning");
      return;
    }
    const value = await dialog.select({
      title: "Greed profile",
      current: state.profile,
      options: (["economy", "balanced", "quality"] as ProfileName[]).map(
        (profile) => ({ title: profile, value: profile }),
      ),
    });
    selected = validProfile(value) ? value : undefined;
  }

  if (!selected) {
    v2Toast(context, "Use /greed economy, /greed balanced, or /greed quality.", "warning");
    return;
  }
  if (state.pinned) {
    v2Toast(context, pinnedMessage(state.pinned), "warning");
    return;
  }
  if (!persistProfile(selected)) {
    v2Toast(context, "Could not persist the selected profile.", "error");
    return;
  }
  state.profile = selected;
  context.renderer?.requestRender?.();
  v2Toast(
    context,
    `${selected} selected. Restart OpenCode to apply model routing.`,
    "success",
  );
}

/** Build the OpenCode 2-compatible argument-capable command layer. */
export function buildGreedLayer(
  context: GreedV2Context,
  state: GreedTuiState,
): () => GreedV2Layer {
  return () => ({
    mode: "global",
    commands: [
      {
        id: "opencode-greed.greed",
        title: "Greed profile",
        group: "System",
        palette: true,
        slash: { name: "greed", arguments: true },
        run: (input) => void runGreedFlow(context, input, state),
      },
    ],
  });
}

/** OpenCode 2-compatible setup with capability-checked slot/keymap hooks. */
export async function setup(
  rawContext: unknown,
  options?: GreedPluginOptions,
): Promise<(() => void) | undefined> {
  const context = rawContext as GreedV2Context;
  const state: GreedTuiState = {
    profile: v2PinnedProfile(context, options) ?? profileName(options),
    pinned: v2PinnedProfile(context, options),
  };
  const disposers: Array<() => void> = [];
  const slot = context.ui?.slot;
  if (typeof slot !== "function") return undefined;

  try {
    const disposeSlot = slot({
      append: "sidebar.content",
      render: () => {
        const layer = context.keymap?.layer;
        if (typeof layer === "function") {
          try {
            const disposeLayer = layer(buildGreedLayer(context, state));
            if (typeof disposeLayer === "function") {
              disposers.push(disposeLayer as () => void);
            }
          } catch (error) {
            console.warn("[opencode-greed] v2 keymap unavailable:", error);
          }
        }
        return sidebarContent(state.profile);
      },
    });
    if (typeof disposeSlot === "function") {
      disposers.push(disposeSlot as () => void);
    }
  } catch (error) {
    console.warn("[opencode-greed] v2 TUI slot unavailable:", error);
  }

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}

/** Legacy-compatible TUI entrypoint for the Greed profile indicator. */
export const tui: TuiPlugin = async (api, options) => {
  const greedOptions = options as GreedPluginOptions | undefined;
  const pinnedProfile = configuredPinnedProfile(api, greedOptions);
  const [activeProfile, setActiveProfile] = createSignal(
    pinnedProfile ?? profileName(greedOptions),
  );

  api.slots.register({
    order: 900,
    slots: {
      sidebar_content() {
        return sidebarContent(activeProfile());
      },
    },
  } as unknown as Parameters<typeof api.slots.register>[0]);

  const chooseProfile = (profile: ProfileName): void => {
    if (pinnedProfile) {
      api.ui.toast({
        variant: "warning",
        title: "Greed profile is pinned",
        message: pinnedMessage(pinnedProfile),
      });
      return;
    }
    if (!persistProfile(profile)) {
      api.ui.toast({
        variant: "error",
        title: "Greed profile",
        message: "Could not persist the selected profile.",
      });
      return;
    }
    setActiveProfile(profile);
    api.ui.toast({
      variant: "success",
      title: "Greed profile",
      message: `${profile} selected. Restart OpenCode to apply model routing.`,
    });
  };

  const commandDispose = api.command?.register(() => [
    {
      title: "Greed profile",
      value: "greed",
      description: "Select economy, balanced, or quality routing",
      slash: { name: "greed", aliases: ["g"] },
      onSelect: () => {
        if (pinnedProfile) {
          api.ui.toast({
            variant: "warning",
            title: "Greed profile is pinned",
            message: pinnedMessage(pinnedProfile),
          });
          return;
        }
        api.ui.dialog.replace(() =>
          api.ui.DialogSelect<ProfileName>({
            title: "Greed profile",
            current: activeProfile(),
            options: (["economy", "balanced", "quality"] as ProfileName[]).map(
              (profile) => ({
                title: profile,
                value: profile,
                description: PROFILE_REASONING[profile],
              }),
            ),
            onSelect: (option) => {
              chooseProfile(option.value);
              api.ui.dialog.clear();
            },
          }),
        );
      },
    },
  ]);

  api.lifecycle.onDispose(() => {
    commandDispose?.();
  });
};

export default { id: "opencode-greed:tui", tui, setup };

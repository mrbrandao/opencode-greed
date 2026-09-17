# opencode-greed

`opencode-greed` provides three model-routing profiles, agent colors, and a
small OpenCode TUI indicator. It does not add token, usage, pricing, or cost
information and it does not change OMO private settings.

## Installation

The server and TUI entrypoints are configured separately. Adding the server
plugin to `opencode.json` does **not** automatically enable the TUI plugin:

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-greed@git+https://github.com/mrbrandao/opencode-greed.git",
    "oh-my-opencode-slim"
  ]
}
```

Keep Greed **before** `oh-my-opencode-slim` in this list. This lets Greed seed
and configure OMO agents before OMO's own hook runs. The default, switchable
configuration omits `profile` entirely.

To enable the TUI entry, add its package subpath to the TUI configuration:

```jsonc
// ~/.config/opencode/tui.json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-greed/tui"]
}
```

The package exports the server as `.` and the TUI as `./tui`. A local checkout
can use `"./path/to/opencode-greed"` in `opencode.jsonc` and
`"./path/to/opencode-greed/tui"` in `tui.json`.

The TUI entry uses the installed legacy-compatible `api.command` and
`api.slots.register` APIs. If the host does not expose the legacy command API,
the sidebar slot still loads but `/greed` is not registered.

The profile sidebar uses the optional runtime packages `@opentui/core`,
`@opentui/solid`, and `solid-js`, which are installed by default with this
package. If a package manager deliberately omits optional dependencies, the
server entry remains usable and the TUI declaration can be omitted; install
the optional dependencies to enable the sidebar.

Greed's profile colors and indicator are additive. OMO's private config,
branding, prompts, skills, MCPs, presets, and sidebar settings remain under
OMO's control.

## Theme

The server plugin installs `theme.json` as `greed`. It honors
`XDG_CONFIG_HOME` and otherwise uses `~/.config`; it writes to
`<config-home>/opencode/themes/greed.json`. An existing theme file is never
overwritten during plugin load. `themeName` changes the destination filename,
not the bundled colors. Select the theme with `/theme` or in `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "greed"
}
```

## Profiles

The profiles are `economy`, `balanced`, and `quality`. The bundled model IDs
are `openai/gpt-5.6-luna`, `openai/gpt-5.6-terra`, and
`openai/gpt-5.6-sol`.

| Profile | Plan / Build | OMO orchestrator / explorer | Other OMO agents |
| --- | --- | --- | --- |
| economy | Luna medium / low | Luna medium / low | Mostly Luna low; Terra high Oracle |
| balanced | Luna medium / medium | Luna medium / low | Luna low/medium; Sol high Oracle |
| quality | Terra high / high | Terra high / medium | Luna medium/high; Sol high Oracle |

Select a profile in the server plugin options:

```jsonc
{
  "plugin": [
    ["opencode-greed", { "profile": "economy" }]
  ]
}
```

Specifying `profile` in either the server Greed entry or the TUI Greed entry
pins that profile and disables switching until the option is removed. Omit it
for a switchable installation.

Overrides are a flat profile-to-agent map. Each override may set `model`,
`variant`, and `color`:

```jsonc
{
  "profiles": {
    "balanced": {
      "orchestrator": { "variant": "high" },
      "explore": { "model": "openai/gpt-5.6-terra" }
    }
  }
}
```

For every field, precedence is deterministic:

1. Bundled profile default
2. Canonical-target profile override
3. Live-agent profile override
4. Existing host agent field

Canonical-target and live-agent overrides are merged field-by-field. Thus an
alias override can provide only `model` while its canonical target override
provides `variant`; neither unintentionally replaces the other.

## OMO integration

OMO integration is controlled by `omo.enabled`:

- `"auto"` (default) activates when an `oh-my-opencode` plugin is registered
  or a canonical OMO agent is already present in the host config.
- `true` forces integration and seeds missing canonical OMO agents.
- `false` leaves all canonical and alias OMO agents untouched.

The installed `oh-my-opencode-slim` source identifies these canonical agents:

`orchestrator`, `explorer`, `librarian`, `oracle`, `designer`, and `fixer`.

It also documents only these aliases:

| Alias | Canonical target |
| --- | --- |
| `explore` | `explorer` |
| `frontend-ui-ux-engineer` | `designer` |

When integration is active, missing canonical OMO agents are seeded from the
selected Greed profile before later plugin hooks need them. Existing host
fields always win. `omo.agentColors: false` preserves existing OMO colors and
does not add colors while still applying missing model and variant defaults.

Greed does not write OMO files or alter `compactSidebar`, prompts, skills,
MCPs, presets, branding, or background/private settings. It only changes the
host config's agent model, variant, and optional color fields described above.
It never changes `default_agent`.

## TUI and `/greed`

The TUI plugin registers the supported slot shape:

```ts
api.slots.register({
  order: 900,
  slots: { sidebar_content() { /* Greed indicator */ } }
})
```

The indicator contains exactly two lines, using profile colors from
`constants.ts`:

```text
Preset: BALANCED
Reasoning: General-purpose routing for everyday work.
```

No cost or token data is rendered.

The legacy command registration provides `/greed` as an interactive picker.
Legacy OpenCode hosts do not support direct profile arguments through this
registration. On an OpenCode 2-compatible host, the additional `setup(ctx)`
path registers a keymap layer using the supported argument-capable command
shape `slash: { name: "greed", arguments: true }`; that path supports:

- `/greed economy`
- `/greed balanced`
- `/greed quality`
- `/greed` opens a picker in the legacy path.

The OpenCode 2 direct-argument path and the legacy picker both persist the
selection, update the indicator, and show a notification. Model routing is
applied by the server config hook only after restarting OpenCode; there is no
live agent reload API. A legacy host must use the picker; it must not be
documented or relied on as a direct-argument interface.

A valid selection is persisted atomically as the Greed-owned file
`<XDG_CONFIG_HOME>/opencode/greed-profile.json` (or the equivalent
`~/.config` path).

If the TUI plugin has an explicit `profile` option, that profile is pinned:
`/greed` rejects switching, shows the pin explanation, and does not persist a
misleading selection. Keep the server and TUI profile options aligned when
pinning a profile.

## Colors

All runtime agent and profile colors are defined in `constants.ts` with
descriptive comments. Logic contains no separate color literals.

## Theme name safety

`themeName` accepts only letters, digits, `_`, and `-`. Invalid or empty names
fall back to `greed` before a path is generated, preventing traversal or
unexpected theme paths. Existing theme files are still never overwritten.

## License

MIT

# opencode-greed

`opencode-greed` is an OpenCode plugin that provides a green-focused TUI
theme and distinct colors for the built-in agents.

The default palette makes common interface elements green, including active
selections, todo-list selections, markdown list numbers, links, and active
borders. The Plan agent is green and the Build agent is purple.

## Installation

Add the official repository to your OpenCode configuration file:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "opencode-greed@git+https://github.com/mrbrandao/opencode-greed.git",
  ],
}
```

The plugin can also be referenced by a local path while developing it:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["./path/to/opencode-greed"],
}
```

Restart OpenCode after adding or changing a plugin. The plugin is loaded at
startup; theme files are not hot-reloaded into an existing session.

## Configuration

Agent colors are plugin options, so they can be changed without editing the
plugin source:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "opencode-greed@git+https://github.com/mrbrandao/opencode-greed.git",
      {
        "planColor": "#22c55e",
        "buildColor": "#a855f7",
        "agents": {
          "explore": "#38bdf8",
          "general": "#f59e0b",
        },
      },
    ],
  ],
}
```

Supported options are:

- `planColor`: color for the Plan agent. Defaults to `#22c55e`.
- `buildColor`: color for the Build agent. Defaults to `#a855f7`.
- `agents`: optional map of additional agent names to colors.
- `themeName`: theme name to activate. Defaults to `greed`.

Colors may be hex values or OpenCode theme color names supported by the agent
configuration schema.

## How It Works

The package exposes both OpenCode plugin entry points:

1. The server plugin uses the `config` hook to add the Plan, Build, and
   optional custom-agent colors to the live configuration.
2. The TUI plugin installs `theme.json` through OpenCode's theme API and
   activates the `greed` theme.
3. The theme defines semantic green colors for selections, status colors,
   active borders, markdown lists, headings, and links.

The theme file is intentionally separate from agent configuration. This lets
the interface remain green while Build keeps its distinct purple identity.

## License

MIT

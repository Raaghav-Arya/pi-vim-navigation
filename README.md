# pi-vim-navigation

Vim-style **transcript navigation** for [Pi](https://github.com/earendil-works/pi). Browse fullscreen conversation history without modifying or submitting your prompt draft. This is not a Vim prompt editor: normal prompt editing stays with Pi's stock editor.

## Install

From npm:

```sh
pi install npm:pi-vim-navigation
```

Or install directly from GitHub:

```sh
pi install git:github.com/Raaghav-Arya/pi-vim-navigation
```

Restart Pi or run `/reload` after installation. Use fullscreen mode (`pi --tui-mode fullscreen`, the default in Pi 1.4.0).

For local development:

```sh
pi install /absolute/path/to/pi-vim-navigation
# Or load once:
pi -e ./src/index.ts
```

Remove any previous `transcript-navigation.ts` installation before enabling this package. It replaces the main editor component, so another extension that replaces that component may override it (or be overridden).

## Update

Ctrl+U/Ctrl+D half-page navigation requires **pi-vim-navigation 0.1.1 or newer**.
Update an existing npm installation with:

```sh
pi update npm:pi-vim-navigation
```

Then run `/reload` in Pi or restart it. Publishing a release to npm does **not**
automatically update an installed copy.

## Keys

| Key | Action |
| --- | --- |
| Ctrl+Q | Toggle INPUT / NAV mode |
| j / Down | Scroll down one line in NAV |
| k / Up | Scroll up one line in NAV |
| Ctrl+U | Scroll half a page up in NAV |
| Ctrl+D | Scroll half a page down in NAV |
| gg | Scroll to the top in NAV |
| G | Scroll to the bottom in NAV |
| i | Return to INPUT and follow live output |
| Escape / Ctrl+C | Leave NAV without jumping to the bottom; forward the key to Pi for normal interruption/clear handling |

Leaving NAV with Ctrl+Q also follows live output. The editor border displays the current mode. Other keys, including Enter and pasted text, are consumed in NAV to protect the draft. Registered extension shortcuts remain available.

Ctrl+U/Ctrl+D scroll by half the current terminal height (rounded down, at least one line), adapting immediately to terminal resizing. They retain Pi's stock editing/exit behavior in INPUT mode. No global keybinding overrides are needed; remove any `tui.altScreen.halfPageUp` / `halfPageDown` overrides for these keys, since Pi processes global fullscreen bindings before the plugin.

Pi itself handles PageUp/PageDown, search, and mouse scrolling before input reaches this editor; those controls remain Pi's responsibility. Regular terminal mode passes input through without navigation labels or mode switching. Non-TUI sessions do not install an editor.

Ctrl+Y accepts a visible autocomplete suggestion through Pi's Tab action without submitting the prompt. If Tab is rebound or disabled, this acceptance is inert. Bracketed paste is forwarded unchanged in INPUT mode.

If Ctrl+Q is intercepted by terminal flow control, disable flow control in your shell with `stty -ixon`.

## Troubleshooting

### Ctrl+U / Ctrl+D do not scroll

1. Update the installed package with `pi update npm:pi-vim-navigation`, then run
   `/reload`. Version 0.1.0 does not implement these shortcuts.
2. Use fullscreen mode and press **Ctrl+Q** first. The editor border must show
   **NAV**; Ctrl+U/Ctrl+D deliberately do not scroll in INPUT mode.
3. Remove any global `tui.altScreen.halfPageUp` / `tui.altScreen.halfPageDown`
   bindings for Ctrl+U/Ctrl+D from `~/.pi/agent/keybindings.json`, then `/reload`.
   Those bindings run before the plugin and would scroll even in INPUT mode.
4. Remove any old local navigation extension so only one editor replacement is
   active.

In INPUT mode, Ctrl+U deletes to line start, and Ctrl+D deletes forward or exits
when the editor is empty. In NAV mode, both preserve your prompt draft.

## Uninstall

```sh
pi remove npm:pi-vim-navigation
```

Run `/reload` or restart Pi afterward. Stock INPUT editing remains unchanged.

## Compatibility

Developed and type-checked against `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` **1.4.0**. Requires a Pi version exposing the fullscreen scrolling API. Host packages are peer dependencies supplied by Pi, not bundled copies.

## Development

Requires Node.js 22 or newer.

```sh
npm ci
npm run typecheck
npm test
npm pack --dry-run
```

Tests cover navigation, draft protection, mode transitions, extension shortcuts, rendering at narrow widths, session registration, and completion acceptance. Unit tests use a mocked stock-editor boundary with real Pi key parsing and width utilities. A separate integration suite uses the real Pi editor, fullscreen renderer, and stable TUI proxy, including half-page scrolling and draft preservation. Interactive terminal behavior should also be smoke-tested in Pi.

To release (requires npm authentication and publish permission):

```sh
npm login
npm publish --access public
```

`prepublishOnly` runs type-checking and tests before publishing. The npm tarball contains TypeScript sources, this README, the license, and package metadata; Pi loads the sources directly.

## License

MIT

/** Fullscreen transcript navigation. Ctrl+Q toggles; i returns to live input. */
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { PickerAcceptanceInput } from "./completion-input.ts";
import {
  isKeyRelease,
  matchesKey,
  type TUI,
  type TuiAltScreen,
  truncateToWidth,
  visibleWidth,
} from "@earendil-works/pi-tui";

// Check capabilities rather than class identity: bundled Pi installations can
// expose extension imports through a different module instance.
function isFullscreen(tui: TUI): tui is TuiAltScreen {
  return tui.mode === "fullscreen" &&
    "scrollBy" in tui && typeof tui.scrollBy === "function" &&
    "scrollToTop" in tui && typeof tui.scrollToTop === "function" &&
    "scrollToBottom" in tui && typeof tui.scrollToBottom === "function";
}

// Use the stock editor so prompt editing, application shortcuts, and autocomplete
// are unchanged outside navigation mode. Fullscreen's own key handler still owns
// PageUp/Down, Ctrl+U/D, search, and mouse scrolling before input reaches us.
export class VimNavigationEditor extends CustomEditor {
  private navigation = false;
  private pendingG = false;
  private readonly pickerAcceptance = new PickerAcceptanceInput();
  private readonly navigationTui: ConstructorParameters<typeof CustomEditor>[0];

  constructor(...args: ConstructorParameters<typeof CustomEditor>) {
    super(...args);
    this.navigationTui = args[0];
  }

  private setNavigation(enabled: boolean, followOutput = false): void {
    this.navigation = enabled;
    this.pendingG = false;
    if (followOutput && isFullscreen(this.navigationTui)) {
      this.navigationTui.scrollToBottom();
    }
    this.invalidate();
    this.navigationTui.requestRender();
  }

  private handleEditorInput(data: string): void {
    const mapped = this.pickerAcceptance.transform(data, this);
    if (mapped !== undefined) super.handleInput(mapped);
  }

  handleInput(data: string): void {
    const tui = this.navigationTui;
    // Compose completion acceptance with the stock regular-mode editor.
    if (!isFullscreen(tui)) {
      this.handleEditorInput(data);
      return;
    }
    if (isKeyRelease(data)) return;
    // Registered extension shortcuts (e.g. Alt+A Agents Hub) must remain usable
    // in NAV mode. Unclaimed input is still consumed to protect the draft.
    if (this.navigation && this.onExtensionShortcut?.(data)) return;

    if (matchesKey(data, "ctrl+q")) {
      this.setNavigation(!this.navigation, this.navigation);
      return;
    }
    if (!this.navigation) {
      this.handleEditorInput(data);
      return;
    }

    if (data === "i") {
      this.setNavigation(false, true);
      return;
    }
    if (data === "g") {
      if (this.pendingG) {
        tui.scrollToTop();
        this.pendingG = false;
      } else {
        this.pendingG = true;
      }
      return;
    }
    this.pendingG = false;

    if (data === "j" || matchesKey(data, "down")) {
      tui.scrollBy(1);
    } else if (data === "k" || matchesKey(data, "up")) {
      tui.scrollBy(-1);
    } else if (data === "G") {
      tui.scrollToBottom();
    } else if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      // Preserve the application's interruption/clear semantics; Escape is not
      // repurposed as a mode-entry key. Do not jump away from the current view.
      this.setNavigation(false);
      super.handleInput(data);
    }
    // Other keys (including Enter and pasted text) are deliberately consumed:
    // navigating must neither edit a saved draft nor accidentally submit it.
  }

  render(width: number): string[] {
    const lines = super.render(width);
    if (!isFullscreen(this.navigationTui) || lines.length === 0) return lines;
    const label = this.navigation
      ? " NAV | j/k gg/G | i: input "
      : " INPUT | Ctrl+Q: navigate ";
    const last = lines.length - 1;
    if (width >= label.length && visibleWidth(lines[last]!) >= label.length) {
      lines[last] = truncateToWidth(lines[last]!, width - label.length, "") + this.borderColor(label);
    } else if (width >= 5) {
      const short = this.navigation ? " NAV " : " INP ";
      lines[last] = truncateToWidth(lines[last]!, width - short.length, "") + this.borderColor(short);
    }
    return lines;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;
    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      new VimNavigationEditor(tui, theme, keybindings),
    );
  });
}

/** Compose completion acceptance into the existing editor. */
import { getKeybindings, isKeyRelease, matchesKey } from "@earendil-works/pi-tui";

export interface CompletionVisibility {
  isShowingAutocomplete(): boolean;
}

/** One instance per editor; tracks bracketed-paste chunks without reading text. */
export class PickerAcceptanceInput {
  private pasting = false;

  /** Undefined consumes the key; otherwise forward exactly once to the base editor. */
  transform(data: string, editor: CompletionVisibility): string | undefined {
    // Do not reinterpret a Ctrl+Y inside a bracketed paste, including split chunks.
    const starts = data.includes("\x1b[200~");
    if (this.pasting || starts) {
      this.pasting = !data.includes("\x1b[201~");
      return data;
    }
    if (!matchesKey(data, "ctrl+y") || !editor.isShowingAutocomplete()) return data;
    if (isKeyRelease(data)) return undefined;
    // Tab applies completion without the slash-command Enter path's submission.
    // If Tab is disabled/rebound, fail inert rather than accidentally submit or yank.
    if (!getKeybindings().matches("\t", "tui.input.tab")) return undefined;
    return "\t";
  }
}

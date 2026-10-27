import { afterEach, describe, expect, it } from "vitest";
import { getKeybindings } from "@earendil-works/pi-tui";
import { PickerAcceptanceInput } from "../src/completion-input.ts";

const editor = (visible: boolean) => ({ isShowingAutocomplete: () => visible });

describe("completion acceptance", () => {
  afterEach(() => getKeybindings().setUserBindings({}));

  it("maps Ctrl+Y to Tab only while autocomplete is visible", () => {
    const input = new PickerAcceptanceInput();
    expect(input.transform("\x19", editor(true))).toBe("\t");
    expect(input.transform("\x19", editor(false))).toBe("\x19");
    expect(input.transform("hello", editor(true))).toBe("hello");
  });

  it("consumes Ctrl+Y release without accepting", () => {
    expect(new PickerAcceptanceInput().transform("\x1b[121;5:3u", editor(true))).toBeUndefined();
  });

  it("fails inert if Tab has been rebound", () => {
    getKeybindings().setUserBindings({ "tui.input.tab": "ctrl+t" });
    expect(new PickerAcceptanceInput().transform("\x19", editor(true))).toBeUndefined();
  });

  it("preserves whole and split bracketed pastes, then resumes mapping", () => {
    const input = new PickerAcceptanceInput();
    const whole = "\x1b[200~\x19\x1b[201~";
    expect(input.transform(whole, editor(true))).toBe(whole);
    expect(input.transform("\x1b[200~", editor(true))).toBe("\x1b[200~");
    expect(input.transform("\x19", editor(true))).toBe("\x19");
    expect(input.transform("\x1b[201~", editor(true))).toBe("\x1b[201~");
    expect(input.transform("\x19", editor(true))).toBe("\t");
  });

  it("tracks paste state separately for each editor", () => {
    const first = new PickerAcceptanceInput();
    const second = new PickerAcceptanceInput();
    first.transform("\x1b[200~", editor(true));
    expect(second.transform("\x19", editor(true))).toBe("\t");
  });
});

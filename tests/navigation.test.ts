import { beforeEach, describe, expect, it, vi } from "vitest";
import { visibleWidth } from "@earendil-works/pi-tui";

// Isolate the host editor boundary, but use Pi's real key parsing and width code.
vi.mock("@earendil-works/pi-coding-agent", () => ({
  CustomEditor: class {
    inputs: string[] = [];
    autocomplete = false;
    onExtensionShortcut?: (data: string) => boolean;
    borderColor = (s: string) => s;
    handleInput(data: string) { this.inputs.push(data); }
    isShowingAutocomplete() { return this.autocomplete; }
    invalidate() {}
    render(width: number) { return ["─".repeat(width)]; }
  },
}));

import extension, { VimNavigationEditor } from "../src/index.ts";

type TestEditor = VimNavigationEditor & { inputs: string[]; autocomplete: boolean };
function setup(mode = "fullscreen") {
  const tui = {
    mode, scrollBy: vi.fn(), scrollToTop: vi.fn(),
    scrollToBottom: vi.fn(), requestRender: vi.fn(),
  };
  const editor = new VimNavigationEditor(tui as never, {} as never, {} as never) as TestEditor;
  return { tui, editor };
}
const toggle = "\x11";

describe("transcript navigation", () => {
  it("forwards input unchanged outside NAV", () => {
    const { editor } = setup();
    for (const key of ["draft", "j", "g", "\r"]) editor.handleInput(key);
    expect(editor.inputs).toEqual(["draft", "j", "g", "\r"]);
  });

  it("scrolls with j/k, arrows, gg, and G", () => {
    const { tui, editor } = setup();
    editor.handleInput(toggle);
    for (const key of ["j", "k", "\x1b[B", "\x1b[A", "g", "g", "G"]) editor.handleInput(key);
    expect(tui.scrollBy.mock.calls).toEqual([[1], [-1], [1], [-1]]);
    expect(tui.scrollToTop).toHaveBeenCalledOnce();
    expect(tui.scrollToBottom).toHaveBeenCalledOnce();
    expect(editor.inputs).toEqual([]);
  });

  it("requires consecutive g keys and clears the prefix after a mode change", () => {
    const { tui, editor } = setup();
    editor.handleInput(toggle);
    for (const key of ["g", "x", "g", "i", toggle, "g"]) editor.handleInput(key);
    expect(tui.scrollToTop).not.toHaveBeenCalled();
    editor.handleInput("g");
    expect(tui.scrollToTop).toHaveBeenCalledOnce();
  });

  it("consumes text, enter, and pasted input in NAV", () => {
    const { editor } = setup();
    editor.handleInput("saved draft");
    editor.handleInput(toggle);
    for (const key of ["oops", "\r", "\x1b[200~pasted\x1b[201~"]) editor.handleInput(key);
    expect(editor.inputs).toEqual(["saved draft"]);
  });

  it.each(["i", toggle])("returns to input and follows output with %j", (key) => {
    const { tui, editor } = setup();
    editor.handleInput(toggle);
    expect(tui.scrollToBottom).not.toHaveBeenCalled();
    editor.handleInput(key);
    editor.handleInput("text");
    expect(tui.scrollToBottom).toHaveBeenCalledOnce();
    expect(editor.inputs).toEqual(["text"]);
    expect(tui.requestRender).toHaveBeenCalledTimes(2);
  });

  it.each(["\x1b", "\x03"])("forwards %j and exits NAV without jumping", (key) => {
    const { tui, editor } = setup();
    editor.handleInput(toggle);
    editor.handleInput(key);
    editor.handleInput("text");
    expect(editor.inputs).toEqual([key, "text"]);
    expect(tui.scrollToBottom).not.toHaveBeenCalled();
  });

  it("allows registered extension shortcuts in NAV", () => {
    const { editor, tui } = setup();
    editor.handleInput(toggle);
    editor.onExtensionShortcut = vi.fn(() => true);
    editor.handleInput("j");
    expect(editor.onExtensionShortcut).toHaveBeenCalledWith("j");
    expect(tui.scrollBy).not.toHaveBeenCalled();
    expect(editor.inputs).toEqual([]);
  });

  it("ignores Kitty key-release events", () => {
    const { editor, tui } = setup();
    editor.handleInput(toggle);
    editor.handleInput("\x1b[106;1:3u");
    expect(tui.scrollBy).not.toHaveBeenCalled();
    expect(editor.inputs).toEqual([]);
  });

  it("does not activate in regular mode or without scrolling capabilities", () => {
    const { editor, tui } = setup("regular");
    editor.handleInput(toggle);
    editor.handleInput("j");
    expect(editor.inputs).toEqual([toggle, "j"]);
    expect(editor.render(40)).toEqual(["─".repeat(40)]);
    tui.mode = "fullscreen";
    (tui as any).scrollBy = undefined;
    editor.handleInput(toggle);
    expect(editor.inputs).toEqual([toggle, "j", toggle]);
  });

  it("renders mode labels within the available width", () => {
    const { editor } = setup();
    expect(editor.render(60).at(-1)).toContain("INPUT");
    editor.handleInput(toggle);
    expect(editor.render(60).at(-1)).toContain("NAV");
    for (let width = 0; width <= 80; width++) {
      for (const line of editor.render(width)) expect(visibleWidth(line)).toBeLessThanOrEqual(width);
    }
  });
});

describe("extension registration", () => {
  it("installs an editor only for TUI sessions", () => {
    const on = vi.fn();
    extension({ on } as never);
    expect(on).toHaveBeenCalledWith("session_start", expect.any(Function));
    const handler = on.mock.calls[0][1];
    const setEditorComponent = vi.fn();
    for (const mode of ["rpc", "json", "print"]) handler({}, { mode, ui: { setEditorComponent } });
    expect(setEditorComponent).not.toHaveBeenCalled();
    handler({}, { mode: "tui", ui: { setEditorComponent } });
    expect(setEditorComponent).toHaveBeenCalledOnce();
    expect(setEditorComponent.mock.calls[0][0]({}, {}, {})).toBeInstanceOf(VimNavigationEditor);
  });
});

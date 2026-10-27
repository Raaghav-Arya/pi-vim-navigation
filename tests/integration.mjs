// Real Pi editor/fullscreen integration; no terminal I/O or model calls.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../node_modules/@earendil-works/pi-coding-agent/", import.meta.url));
const require = createRequire(join(root, "package.json"));
const { createJiti } = require("jiti");
const tuiEntry = require.resolve("@earendil-works/pi-tui");
const agentEntry = join(root, "dist/index.js");
const jiti = createJiti(import.meta.url, { alias: {
  "@earendil-works/pi-coding-agent": agentEntry,
  "@earendil-works/pi-tui": tuiEntry,
} });
const { TuiAltScreen, setKeybindings, visibleWidth } = await jiti.import(tuiEntry);
const { KeybindingsManager } = await jiti.import(join(root, "dist/core/keybindings.js"));
const { createInteractiveTuiReference } = await jiti.import(join(root, "dist/modes/interactive/tui-renderer.js"));
const { VimNavigationEditor: TranscriptNavigationEditor, default: extension } = await jiti.import(
  fileURLToPath(new URL("../src/index.ts", import.meta.url)),
);

const calls = [];
const terminal = { columns: 80, rows: 24, write() {}, hideCursor() {}, showCursor() {} };
const renderer = new TuiAltScreen(terminal);
// Pi passes a stable proxy to editor factories, not the renderer directly.
const tui = createInteractiveTuiReference(() => renderer);
tui.requestRender = () => {};
tui.scrollBy = (n) => calls.push(n);
tui.scrollToTop = () => calls.push("top");
tui.scrollToBottom = () => calls.push("bottom");
const kb = new KeybindingsManager({ "tui.altScreen.halfPageUp": "ctrl+u", "tui.altScreen.halfPageDown": "ctrl+d" });
setKeybindings(kb);
const editor = new TranscriptNavigationEditor(tui, { borderColor: (s) => s }, kb);
tui.addChild(editor);
tui.setFocus(editor);
const input = (s) => tui.handleTerminalInput(s);

editor.setText("saved draft");
input("\x11"); // Ctrl+Q
assert.match(editor.render(80).join("\n"), / NAV /);
input("j"); input("k"); input("g"); input("g"); input("G");
assert.deepEqual(calls.splice(0), [1, -1, "top", "bottom"]);
input("\x15"); input("\x04"); // Existing half-page bindings still reach fullscreen.
assert.equal(calls[0] < 0, true);
assert.equal(calls[1] > 0, true);
calls.length = 0;
let hubOpens = 0;
editor.onExtensionShortcut = (data) => {
  if (data === "\x1ba") { hubOpens++; return true; }
  return false;
};
input("\x1ba");
assert.equal(hubOpens, 1); // Alt+A remains usable in NAV mode.
input("x"); input("\r"); input("\x1b[200~accidental paste\x1b[201~");
assert.equal(editor.getText(), "saved draft");
input("i");
assert.deepEqual(calls.splice(0), ["bottom"]);
input("!");
assert.equal(editor.getText().includes("!"), true);
assert.match(editor.render(80).join("\n"), / INPUT /);
input("\x11"); input("\x11"); // Toggle back to input, following output.
assert.deepEqual(calls.splice(0), ["bottom"]);

let interrupts = 0;
editor.onEscape = () => interrupts++;
input("\x11"); input("\x1b");
assert.equal(interrupts, 1);
assert.match(editor.render(80).join("\n"), / INPUT /);
assert.equal(calls.length, 0); // Escape must not jump the viewport.
for (const width of [1, 5, 12, 40, 80]) {
  // Only the bottom border is changed; stock editor lines contain cursor markers.
  assert.ok(visibleWidth(editor.render(width).at(-1)) <= width);
}

// A new editor (e.g. after /reload or a mode switch) always starts in input mode.
const fresh = new TranscriptNavigationEditor(tui, { borderColor: (s) => s }, kb);
assert.match(fresh.render(80).join("\n"), / INPUT /);
// Regular mode never activates navigation or changes Ctrl+Q handling.
const regular = { mode: "regular", requestRender() {} };
const regularEditor = new TranscriptNavigationEditor(regular, { borderColor: (s) => s }, kb);
regularEditor.handleInput("\x11");
regularEditor.handleInput("j");
assert.equal(regularEditor.getText(), "j");

let start;
extension({ on(event, handler) { assert.equal(event, "session_start"); start = handler; } });
start({}, { mode: "rpc", ui: { setEditorComponent() { throw new Error("RPC must not install editor"); } } });
let installed = false;
start({}, { mode: "tui", ui: { setEditorComponent(factory) { installed = !!factory; } } });
assert.equal(installed, true);
console.log("Transcript navigation tests passed");

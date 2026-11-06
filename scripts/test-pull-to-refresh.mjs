import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../app/components/pull-to-refresh.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const handlers = new Map(), options = new Map();
let standalone = true, reloads = 0, cleanup;
class Element {
  parentElement = null; scrollHeight = 0; clientHeight = 0; overflowY = "visible";
  interactive = false;
  closest() { return this.interactive ? this : null; }
}
const target = new Element();
const document = {
  body: new Element(), activeElement: null, modal: false,
  querySelector() { return this.modal ? {} : null; },
  addEventListener(name, handler, opts) { handlers.set(name, handler); options.set(name, opts); },
  removeEventListener(name) { handlers.delete(name); }
};
const window = { scrollY: 0, matchMedia: () => ({ matches: standalone }), location: { reload() { reloads++; } } };
const navigator = { standalone: false };
const context = { exports: {}, document, window, navigator, Element, getComputedStyle: e => ({ overflowY: e.overflowY }), require(name) {
  if (name === "react") return { useState: v => [v, () => {}], useEffect: fn => { cleanup = fn(); } };
  if (name === "lucide-react") return {};
  if (name === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
  throw Error(name);
} };
vm.runInNewContext(compiled, context);
context.exports.PullToRefresh();
assert.equal(options.get("touchmove").passive, false);
const point = (x, y, identifier = 1) => ({ clientX: x, clientY: y, identifier });
const touch = (points, overrides = {}) => ({ touches: points, target, cancelable: true, preventDefault() { this.prevented = true; }, ...overrides });
const start = (overrides) => handlers.get("touchstart")(touch([point(0, 0)], overrides));
const move = (x, y, overrides) => { const event = touch([point(x, y)], overrides); handlers.get("touchmove")(event); return event; };
const end = () => handlers.get("touchend")(touch([]));
standalone = false; start(); move(0, 200); end(); assert.equal(reloads, 0, "normal browser keeps native gestures");
standalone = true; start(); assert.equal(move(0, 80).prevented, true); end(); assert.equal(reloads, 0, "short pulls cancel");
start(); move(200, 40); end(); assert.equal(reloads, 0, "horizontal swipe cancels");
window.scrollY = 100; start(); move(0, 200); end(); assert.equal(reloads, 0, "must start at page top"); window.scrollY = 0;
target.interactive = true; start(); move(0, 200); end(); assert.equal(reloads, 0, "controls remain interactive"); target.interactive = false;
target.scrollHeight = 200; target.clientHeight = 100; target.overflowY = "auto"; start(); move(0, 200); end(); assert.equal(reloads, 0, "nested scroll panel is ignored"); target.scrollHeight = 0;
start(); move(0, 200); handlers.get("touchcancel")(); end(); assert.equal(reloads, 0, "touch cancellation never reloads");
start(); move(0, 200); handlers.get("touchstart")(touch([point(0, 200), point(10, 200, 2)])); end(); assert.equal(reloads, 0, "multitouch cancels an armed pull");
start(); move(0, 200); assert.equal(reloads, 0, "wait for release"); end(); assert.equal(reloads, 1);
end(); start(); move(0, 200); end(); assert.equal(reloads, 1, "reload is guarded against duplicate gestures");
cleanup(); assert.equal(handlers.size, 0);
console.log("Standalone pull-to-refresh threshold, release, cancellation, scroll/control isolation and listener cleanup passed.");

import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let ts;

try {
  ts = require("typescript");
} catch {
  ts = require("./node_modules/.pnpm/typescript@5.6.2/node_modules/typescript");
}

const rootDir = process.cwd();
const srcPath = path.join(rootDir, "src", "index.tsx");
const distDir = path.join(rootDir, "dist");
const outPath = path.join(distDir, "index.js");

const prelude = [
  'const manifest = {"name":"DeckyScripts"};',
  "const API_VERSION = 2;",
  "const internalAPIConnection = window.__DECKY_SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED_deckyLoaderAPIInit;",
  "if (!internalAPIConnection) {",
  "    throw new Error('[@decky/api]: Failed to connect to the loader as as the loader API was not initialized. This is likely a bug in Decky Loader.');",
  "}",
  "let api;",
  "try {",
  "    api = internalAPIConnection.connect(API_VERSION, manifest.name);",
  "}",
  "catch {",
  "    api = internalAPIConnection.connect(1, manifest.name);",
  "    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version 1. Some features may not work.`);",
  "}",
  "if (api._version != API_VERSION) {",
  "    console.warn(`[@decky/api] Requested API version ${API_VERSION} but the running loader only supports version ${api._version}. Some features may not work.`);",
  "}",
  "const callable = api.callable;",
  "const toaster = api.toaster;",
  "const definePlugin = (fn) => {",
  "    return (...args) => {",
  "        return fn(...args);",
  "    };",
  "};",
  "const React = SP_REACT;",
  "const { useEffect, useState } = SP_REACT;",
  "const { ButtonItem, PanelSection, PanelSectionRow, SliderField, TextField, ToggleField } = DFL;",
].join("\n");

function transpileSource() {
  const source = fs
    .readFileSync(srcPath, "utf8")
    .replace(/^import\s[\s\S]*?;\r?\n/gm, "");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
    fileName: "index.tsx",
  });

  return `${prelude}\n${output.outputText}\n`;
}

function build() {
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(outPath, transpileSource(), "utf8");
  console.log(`Wrote ${path.relative(rootDir, outPath)}`);
}

function watch() {
  build();

  let timer = null;
  fs.watch(srcPath, { persistent: true }, () => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      try {
        build();
      } catch (error) {
        console.error(error);
      }
    }, 50);
  });

  console.log(`Watching ${path.relative(rootDir, srcPath)}`);
}

if (process.argv.includes("--watch")) {
  watch();
} else {
  build();
}

// wasm-smoke.mjs — mixamo retargeter の wasm が native と同じ remap を出すか検証。
import { readFileSync } from "node:fs";
const mod = await WebAssembly.compile(readFileSync(new URL("../build/mixamo.wasm", import.meta.url)));
const imports = {};
for (const i of WebAssembly.Module.imports(mod)) (imports[i.module] ??= {})[i.name] = () => 0;
const { exports: ex } = await WebAssembly.instantiate(mod, imports);
try { ex._start(); } catch {}

const near = (a, b) => Math.abs(a - b) < 1e-3;
let ok = true;
const check = (n, got, want) => { if (!near(got, want)) { console.error(`FAIL ${n}: ${got} != ${want}`); ok = false; } };

// identity rest pose: parent = identity, rest_inv = identity
ex.mx_set_bone(0,0,0,1, 0,0,0,1);
// keyframe ~60° about X = (0.5,0,0,0.866). vrm1 → 恒等, vrm0 → x 反転。
check("vrm1 x", ex.mx_remap(0, 0, 0.5,0,0,0.866), 0.5);
check("vrm1 w", ex.mx_remap(3, 0, 0.5,0,0,0.866), 0.866);
check("vrm0 x", ex.mx_remap(0, 1, 0.5,0,0,0.866), -0.5);
// 180°X · 180°Y = 180°Z : parent=180°X, rest_inv=identity, q=180°Y → z=1
ex.mx_set_bone(1,0,0,0, 0,0,0,1);
check("remap composes (z)", ex.mx_remap(2, 0, 0,1,0,0), 1.0);
// hips: y*scale, x flipped for vrm0
check("hips y", ex.mx_hips(1, 0, 1,2,3, 10), 20);
check("hips x vrm0", ex.mx_hips(0, 1, 1,2,3, 10), -10);

if (ok) console.log("wasm OK — quaternion remap + hips match native");
else process.exit(1);

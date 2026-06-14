// mixamo-driver.js — mixamo retargeter の wasm で FBX clip を VRM ボーンに
// リターゲットするグルー例。回転計算は Almide(wasm)、Three.js の clip 構築は JS。
//
//   import { retargetClip } from "./mixamo-driver.js";
//   const vrmClip = await retargetClip("/mixamo.wasm", sourceClip, vrm, { isVRM0, hipsScale });

import * as THREE from "three";

export async function retargetClip(wasmUrl, sourceClip, vrm, opts = {}) {
  const { isVRM0 = false, hipsScale = 1, boneMap = (n) => n } = opts;
  const bytes = await (await fetch(wasmUrl)).arrayBuffer();
  const mod = await WebAssembly.compile(bytes);
  const imports = {};
  for (const i of WebAssembly.Module.imports(mod)) (imports[i.module] ??= {})[i.name] = () => 0;
  const { exports: ex } = await WebAssembly.instantiate(mod, imports);
  try { ex._start(); } catch {}

  const vrm0 = isVRM0 ? 1 : 0;
  const tracks = [];
  const _restInv = new THREE.Quaternion();
  const _parent = new THREE.Quaternion();

  for (const track of sourceClip.tracks) {
    const boneName = track.name.slice(0, track.name.lastIndexOf("."));
    const sourceBone = sourceClip.__root?.getObjectByName(boneName) ?? null;
    const targetName = boneMap(boneName);
    if (!sourceBone || !targetName) continue;

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // rest pose を一度セット (per-bone 定数)。
      sourceBone.getWorldQuaternion(_restInv).invert();
      sourceBone.parent?.getWorldQuaternion(_parent);
      ex.mx_set_bone(_parent.x, _parent.y, _parent.z, _parent.w,
                     _restInv.x, _restInv.y, _restInv.z, _restInv.w);
      const out = new Float32Array(track.values.length);
      for (let k = 0; k < track.times.length; k++) {
        const i = k * 4;
        const qx = track.values[i], qy = track.values[i+1], qz = track.values[i+2], qw = track.values[i+3];
        out[i]   = ex.mx_remap(0, vrm0, qx, qy, qz, qw);
        out[i+1] = ex.mx_remap(1, vrm0, qx, qy, qz, qw);
        out[i+2] = ex.mx_remap(2, vrm0, qx, qy, qz, qw);
        out[i+3] = ex.mx_remap(3, vrm0, qx, qy, qz, qw);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${targetName}.quaternion`, track.times.slice(), out));
    } else if (track instanceof THREE.VectorKeyframeTrack && boneName.includes("Hips")) {
      const out = new Float32Array(track.values.length);
      for (let k = 0; k < track.times.length; k++) {
        const i = k * 3;
        out[i]   = ex.mx_hips(0, vrm0, track.values[i], track.values[i+1], track.values[i+2], hipsScale);
        out[i+1] = ex.mx_hips(1, vrm0, track.values[i], track.values[i+1], track.values[i+2], hipsScale);
        out[i+2] = ex.mx_hips(2, vrm0, track.values[i], track.values[i+1], track.values[i+2], hipsScale);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${targetName}.position`, track.times.slice(), out));
    }
  }
  return new THREE.AnimationClip(sourceClip.name, sourceClip.duration, tracks);
}

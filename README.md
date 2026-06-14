# fizz-mixamo-retargeter

Fizz の **Mixamo リターゲット回転計算コア**。Mixamo アニメを VRM ボーンに
リターゲットする際の四元数計算を担う。各ボーンの rotation track のキーフレームを:

```
q' = parentRestWorld · q · restWorld⁻¹
```

で変換し(親の rest world 回転で前から、自身の rest world 回転の逆で後ろから挟む)、
VRM 0.x なら軸フリップ(x,z 反転)。Hips の position はリグ身長比でスケール + 同じ
フリップ。**計算は純 Almide、FBX clip の読み出し / rest world 回転取得 / AnimationClip
構築(Three.js の I/O)は JS グルー**。移植元: openaituber `src/vrm/mixamo.ts`。

## API(計算コア)

| 関数 | 説明 |
|---|---|
| `mul(a, b)` / `inverse(q)` | 四元数の Hamilton 積 / 逆 |
| `remap(parent, q, rest_inv)` | `parent · q · rest_inv` |
| `vrm0_flip(q)` | VRM0 軸フリップ(x,z 反転) |
| `retarget(parent, q, rest_inv, vrm0)` | remap + (VRM0 なら) フリップ |
| `hips_component(idx, x,y,z, scale, vrm0)` | Hips position 成分(スケール + フリップ) |

## ① native — 確認 / オフライン検証

```sh
almide build src/main.almd -o build/fizz-mixamo-retargeter
./build/fizz-mixamo-retargeter
# {"vrm1":{"x":0.5,...},"vrm0":{"x":-0.5,...}}  ← identity rest pose なら恒等、VRM0 は x 反転
```

## ② wasm — ブラウザのリターゲット(FBX ロード時)

```sh
almide build src/bridge.almd --target wasm -o build/mixamo.wasm
```

ボーンごとに `mx_set_bone(parent[4], rest_inv[4])` で rest pose をセットし、各キー
フレームで `mx_remap(comp, vrm0, q[4]) -> Float`。Hips は `mx_hips(comp, vrm0, x,y,z, scale)`。
全エクスポート Float 入出力。グルー例は [`browser/mixamo-driver.js`](./browser/mixamo-driver.js):

```js
const vrmClip = await retargetClip("/mixamo.wasm", sourceClip, vrm, { isVRM0, hipsScale });
```

wasm が native と一致することを CI(`test/wasm-smoke.mjs`)で検証。

## 開発

```sh
almide check src/main.almd
almide test spec/mixamo_test.almd
almide build src/main.almd -o build/fizz-mixamo-retargeter
almide build src/bridge.almd --target wasm -o build/mixamo.wasm
```

ツールチェーン: [almide](https://github.com/almide/almide) v0.27.6+。依存なし。

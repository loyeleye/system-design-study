# The Offline Model's runtime

`js/checker.js` (the Offline Model answer checker) runs an NLI model in the browser with these files, through
`js/nli-worker.mjs`. They come from npm, unchanged:

| File | From | License |
| --- | --- | --- |
| `ort.wasm.min.mjs`, `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm` | `onnxruntime-web@1.30.0`, `dist/` (the WebAssembly-only build, 14 MB) | MIT, `LICENSE-onnxruntime-web` |
| `tokenizers.min.mjs` | `@huggingface/tokenizers@0.2.0`, `dist/` | Apache 2.0, `LICENSE-tokenizers` |

The game doesn't fetch the `.wasm` file itself: `js/checker.js` downloads it with the model into Cache Storage when
the player picks the Offline Model, so Delete downloaded models frees it too.

## The model

[Xenova/nli-deberta-v3-xsmall](https://huggingface.co/Xenova/nli-deberta-v3-xsmall) (Apache 2.0): the ONNX export
of `cross-encoder/nli-deberta-v3-xsmall`, trained on SNLI and MultiNLI. It isn't in this repo: players' browsers
download it from Hugging Face. The files and their sha256, as checked on Oct 25, 2026:

| File | Bytes | sha256 |
| --- | --- | --- |
| `onnx/model_quantized.onnx` | 87,246,587 | `3fac2500c45c75af42c7711de0d1b93d59577456100208be0dc1f9e8811946b6` |
| `tokenizer.json` | 8,656,551 | `a86f883318afa11c8c10466f1bf4efaeb6ded28a52cbe57217a8fa0d0a2a87df` |
| `tokenizer_config.json` | 384 | `d8d3bb123b99317634d5ee3d1d2d8b2ddb01510a0654687fc2639a5347a7291f` |
| `config.json` | 1,038 | `ec0bd14cc28640326474399cd61d38ccd52b64900228799d0f81debda8c4bc53` |

`tools/checker_eval.js <folder>` scores it against Basic on hand-labelled answers.

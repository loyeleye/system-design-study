# On-device embedding model for typed answers

`js/embed.js` uses these files to check typed answers in the browser, with no server and no API key.

| File | What |
| --- | --- |
| `potion-base-8m.i8` | MinishLab's [potion-base-8M](https://huggingface.co/minishlab/potion-base-8M) (Model2Vec, MIT), one 256-number vector per WordPiece token, stored as int8 with one float32 scale per row: `uint32 rows`, `uint32 dims`, `float32[rows]` scales, `int8[rows * dims]`. 7.7 MB, down from 30 MB. |
| `vocab.txt` | The model's WordPiece vocabulary (bge-base-en-v1.5, uncased). Line number = row. |
| `LICENSE` | MIT, MinishLab. |

## Where the files came from

Hugging Face isn't reachable from the build environment, so the original `model.safetensors` (F32, shape [29528, 256]) and `vocab.txt` came from two independent npm repackages of the model, `counterparts-model-potion@0.1.0` and `@yarflam/potion-base-8m@1.0.4`. Both carry byte-identical tensors with sha256 `f65d0f325faadc1e121c319e2faa41170d3fa07d8c89abd48ca5358d9a223de2`, which the first package states is Hugging Face's LFS hash for revision `bf8b056651a2c21b8d2565580b8569da283cab23`. `vocab.txt` has sha256 `1394523a67ddd404a825428018c0582a6998bcfa044ecbcbf1f4d71adb94c61c`.

The int8 file was made with numpy: per row, `scale = max(abs(row)) / 127` and `q = round(row / scale)`. The largest error on any weight is 0.21, against row norms of about 100, so cosine similarities move by well under 0.01.

`js/embed.js`'s tokenizer matches the Hugging Face `tokenizers` output for the model's `tokenizer.json` on mixed test text (punctuation, accents, unknown words).

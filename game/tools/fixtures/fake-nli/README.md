A stand-in for the Offline Model (js/checker.js) in tests: a few-hundred-byte ONNX graph and a word-level tokenizer
with the real files' names and shapes. It "entails" every point when the answer contains the word "magic", and none
otherwise, so tools/checker_check.js can test the download, cache, worker and delete without the 90 MB model.

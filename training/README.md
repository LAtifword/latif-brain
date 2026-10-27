# LATIF BRAIN — real LoRA training

This pipeline performs real gradient updates on a compatible open-weight model. It does **not** train Gemini Nano TFLite binaries or claim to increase inference speed.

## Prerequisites
- NVIDIA CUDA GPU (a self-hosted GitHub Actions runner labelled `gpu` or a local GPU environment).
- Dataset you are authorized to use, stored at `training/data/train.jsonl`, with one `{"text":"..."}` per line (minimum 10; substantially more needed for meaningful learning). Do not commit private datasets.
- Review model license and privacy before training.

## Run
```sh
python -m pip install -r training/requirements.txt 'datasets>=3'
python training/train_lora.py --data training/data/train.jsonl --steps 100
```
GitHub Actions workflow `train-lora-gpu.yml` can be dispatched after it exists on the default branch and a GPU-labelled self-hosted runner is available. GitHub-hosted CPU runners cannot perform the intended GPU job.

## Verification
Successful training emits adapter weights (`adapter_model.safetensors`), adapter config, tokenizer and a final step count. Confirm nonzero updates, evaluate held-out data, then convert/export only if compatible. This pipeline is not a substitute for a proper evaluation suite.

Do not place model weights, personal data, access tokens, or training corpora in the public repository.

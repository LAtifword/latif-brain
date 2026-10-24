#!/usr/bin/env python3
"""Real supervised LoRA training; requires CUDA GPU and user-provided JSONL."""
import argparse
import json
from pathlib import Path
import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments, DataCollatorForLanguageModeling

def load_rows(path):
    rows = []
    for n, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        obj = json.loads(line)
        text = obj.get("text")
        if not isinstance(text, str) or not text.strip():
            raise ValueError(f"Line {n}: expected nonempty text field")
        rows.append({"text": text})
    if len(rows) < 10:
        raise ValueError("At least 10 training records required")
    return rows

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="Qwen/Qwen2.5-0.5B-Instruct")
    p.add_argument("--data", required=True)
    p.add_argument("--output", default="artifacts/lora")
    p.add_argument("--steps", type=int, default=100)
    p.add_argument("--max-length", type=int, default=512)
    args = p.parse_args()
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU required; refusing misleading CPU-only training job")
    if args.steps < 1 or args.max_length < 32:
        raise ValueError("Invalid training settings")
    rows = load_rows(args.data)
    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=False)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(
        args.model, torch_dtype=torch.float16, trust_remote_code=False
    )
    model.config.use_cache = False
    model = get_peft_model(model, LoraConfig(
        r=8, lora_alpha=16, lora_dropout=0.05, bias="none",
        task_type="CAUSAL_LM", target_modules=["q_proj", "v_proj"]
    ))
    ds = Dataset.from_list(rows)
    def encode(batch):
        return tokenizer(batch["text"], truncation=True, max_length=args.max_length)
    ds = ds.map(encode, batched=True, remove_columns=["text"])
    train_args = TrainingArguments(
        output_dir=args.output, max_steps=args.steps, per_device_train_batch_size=1,
        gradient_accumulation_steps=8, learning_rate=2e-4, logging_steps=10,
        save_steps=50, save_total_limit=2, report_to="none",
        fp16=True, remove_unused_columns=False, seed=42,
    )
    trainer = Trainer(model=model, args=train_args, train_dataset=ds,
                      data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False))
    trainer.train()
    model.save_pretrained(args.output)
    tokenizer.save_pretrained(args.output)
    print(json.dumps({"status":"trained","adapter":args.output,
                      "global_step":trainer.state.global_step}))
if __name__ == "__main__":
    main()

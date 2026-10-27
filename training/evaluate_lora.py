#!/usr/bin/env python3
"""Evaluate a LoRA adapter against held-out JSONL without training leakage."""
import argparse,json,math
from pathlib import Path
import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

def evaluate(base,adapter,data,max_length=512):
    if max_length<32: raise ValueError("max_length must be >= 32")
    path=Path(data)
    if not path.is_file(): raise FileNotFoundError(path)
    rows=[]
    for n,line in enumerate(path.read_text(encoding="utf-8").splitlines(),1):
        if not line.strip(): continue
        obj=json.loads(line)
        if not isinstance(obj,dict) or not isinstance(obj.get("text"),str): raise ValueError(f"Invalid row {n}")
        if obj["text"].strip(): rows.append(obj["text"].strip())
    if len(rows)<2: raise ValueError("Need at least two held-out examples")
    tok=AutoTokenizer.from_pretrained(base,trust_remote_code=False)
    model=AutoModelForCausalLM.from_pretrained(base,trust_remote_code=False,torch_dtype=torch.float32)
    model=PeftModel.from_pretrained(model,adapter,is_trainable=False)
    model.eval()
    device=next(model.parameters()).device
    total_nll=0.; total_tokens=0
    with torch.no_grad():
        for text in rows:
            tokens=tok(text,return_tensors="pt",truncation=True,max_length=max_length)["input_ids"].to(device)
            if tokens.shape[1]<2: continue
            logits=model(input_ids=tokens).logits[:, :-1, :].float()
            labels=tokens[:, 1:]
            nll=torch.nn.functional.cross_entropy(logits.reshape(-1,logits.size(-1)),labels.reshape(-1),reduction="sum")
            total_nll+=float(nll);total_tokens+=labels.numel()
    if total_tokens==0: raise ValueError("No evaluable tokens")
    avg=total_nll/total_tokens
    return {"examples":len(rows),"tokens":total_tokens,"mean_token_nll":avg,"perplexity":math.exp(min(avg,100)),"base_model":base,"adapter":adapter}

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--model",default="Qwen/Qwen2.5-0.5B-Instruct")
    p.add_argument("--adapter",default="artifacts/lora")
    p.add_argument("--data",default="training/data/validation.jsonl")
    p.add_argument("--output",default="artifacts/evaluation.json")
    a=p.parse_args()
    result=evaluate(a.model,a.adapter,a.data)
    out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result))

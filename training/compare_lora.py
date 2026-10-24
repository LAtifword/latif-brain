#!/usr/bin/env python3
"""Compare base and LoRA adapter on identical held-out text using token-weighted NLL."""
import argparse,json,math
from pathlib import Path
import torch
from transformers import AutoTokenizer,AutoModelForCausalLM
from peft import PeftModel

def load_texts(path):
    texts=[]
    for i,line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(),1):
        if not line.strip():continue
        row=json.loads(line)
        if not isinstance(row,dict) or not isinstance(row.get("text"),str):
            raise ValueError(f"Invalid text row {i}")
        if row["text"].strip():texts.append(row["text"].strip())
    if len(texts)<2:raise ValueError("Need >=2 held-out examples")
    return texts

def score(model,tok,texts,max_length):
    model.eval()
    device=next(model.parameters()).device
    total=0.0;count=0
    with torch.inference_mode():
        for text in texts:
            ids=tok(text,return_tensors="pt",truncation=True,max_length=max_length)["input_ids"].to(device)
            if ids.shape[1]<2:continue
            logits=model(input_ids=ids).logits[:,:-1].float()
            labels=ids[:,1:]
            total+=torch.nn.functional.cross_entropy(logits.reshape(-1,logits.size(-1)),labels.reshape(-1),reduction="sum").item()
            count+=labels.numel()
    if not count:raise ValueError("No evaluable tokens")
    nll=total/count
    return {"tokens":count,"mean_token_nll":nll,"perplexity":math.exp(min(nll,100))}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--model",default="Qwen/Qwen2.5-0.5B-Instruct")
    p.add_argument("--adapter",default="artifacts/lora")
    p.add_argument("--validation",required=True)
    p.add_argument("--train",help="Optional training JSONL to check exact text overlap")
    p.add_argument("--output",default="artifacts/evaluation.json")
    p.add_argument("--max-length",type=int,default=512)
    a=p.parse_args()
    if a.max_length<2:raise ValueError("max-length must be >=2")
    texts=load_texts(a.validation)
    if a.train:
        train=set(load_texts(a.train))
        overlap=train.intersection(texts)
        if overlap:raise ValueError(f"Validation leakage: {len(overlap)} exact overlaps")
    tok=AutoTokenizer.from_pretrained(a.model,trust_remote_code=False)
    base=AutoModelForCausalLM.from_pretrained(a.model,trust_remote_code=False,torch_dtype=torch.float32)
    base.eval()
    baseline=score(base,tok,texts,a.max_length)
    adapted=PeftModel.from_pretrained(base,a.adapter,is_trainable=False)
    trained=score(adapted,tok,texts,a.max_length)
    if baseline["tokens"]!=trained["tokens"]:raise RuntimeError("Token counts differ")
    result={"model":a.model,"adapter":a.adapter,"examples":len(texts),"base":baseline,"adapter_result":trained,"nll_improvement":baseline["mean_token_nll"]-trained["mean_token_nll"],"note":"Lower NLL is better; no improvement is presumed."}
    out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result))
if __name__=="__main__":main()

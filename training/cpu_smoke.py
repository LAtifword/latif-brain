#!/usr/bin/env python3
"""CPU-only, reproducible weight-update smoke test; NOT production LLM training."""
import argparse, json, random
from pathlib import Path
import torch
from torch import nn

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--output',default='artifacts/cpu-smoke.pt')
    ap.add_argument('--steps',type=int,default=30)
    a=ap.parse_args()
    if a.steps<1: raise ValueError('steps must be positive')
    random.seed(42); torch.manual_seed(42); torch.set_num_threads(2)
    corpus=('LATIF BRAIN learns through verified training steps. '+
            'The model checkpoint is saved after optimization. '+
            'Tests must distinguish model training from workflow checks. ')*16
    data=torch.tensor(list(corpus.encode('utf-8')),dtype=torch.long)
    context=16
    x=torch.stack([data[i:i+context] for i in range(0,len(data)-context-1,context)])
    y=torch.stack([data[i+1:i+context+1] for i in range(0,len(data)-context-1,context)])
    class TinyLM(nn.Module):
        def __init__(self):
            super().__init__(); self.emb=nn.Embedding(256,24); self.gru=nn.GRU(24,48,batch_first=True); self.head=nn.Linear(48,256)
        def forward(self,t):
            z,_=self.gru(self.emb(t)); return self.head(z)
    model=TinyLM(); optimizer=torch.optim.AdamW(model.parameters(),lr=0.008)
    with torch.no_grad(): initial=torch.nn.functional.cross_entropy(model(x).reshape(-1,256),y.reshape(-1)).item()
    before=model.emb.weight.detach().clone()
    for step in range(a.steps):
        optimizer.zero_grad(); logits=model(x); loss=torch.nn.functional.cross_entropy(logits.reshape(-1,256),y.reshape(-1)); loss.backward(); optimizer.step()
    with torch.no_grad(): final=torch.nn.functional.cross_entropy(model(x).reshape(-1,256),y.reshape(-1)).item()
    delta=(model.emb.weight.detach()-before).abs().max().item()
    if not (final<initial and delta>0): raise RuntimeError('Weight update or loss reduction not verified')
    path=Path(a.output); path.parent.mkdir(parents=True,exist_ok=True)
    torch.save({'model':model.state_dict(),'steps':a.steps,'initial_loss':initial,'final_loss':final,'max_embedding_change':delta,'purpose':'CPU smoke test, not LATIF BRAIN production model'},path)
    print(json.dumps({'checkpoint':str(path),'steps':a.steps,'initial_loss':round(initial,5),'final_loss':round(final,5),'max_embedding_change':round(delta,7),'verified':True}))
if __name__=='__main__': main()

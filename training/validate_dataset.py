#!/usr/bin/env python3
"""Validate and split licensed JSONL text data without exposing source content."""
import argparse, hashlib, json, random
from pathlib import Path

def process(src, dest, seed=42):
    src=Path(src); dest=Path(dest)
    if not src.is_file(): raise FileNotFoundError(src)
    unique={}
    for n,line in enumerate(src.read_text(encoding='utf-8').splitlines(),1):
        if not line.strip(): continue
        obj=json.loads(line)
        if not isinstance(obj,dict) or not isinstance(obj.get('text'),str): raise ValueError(f'Invalid text at line {n}')
        value=obj['text'].strip()
        if len(value)<30: continue
        unique.setdefault(hashlib.sha256(value.encode()).hexdigest(),value)
    rows=list(unique.values())
    if len(rows)<20: raise ValueError('Need at least 20 unique usable examples')
    random.Random(seed).shuffle(rows)
    nval=max(2,int(len(rows)*0.1)); train=rows[nval:]; val=rows[:nval]
    dest.mkdir(parents=True,exist_ok=True)
    for name,items in [('train',train),('validation',val)]:
        with (dest/f'{name}.jsonl').open('w',encoding='utf-8') as f:
            for t in items:f.write(json.dumps({'text':t},ensure_ascii=False)+'\n')
    result={'unique_examples':len(rows),'train':len(train),'validation':len(val),'duplicates_removed':sum(bool(line.strip()) for line in src.read_text(encoding='utf-8').splitlines())-len(rows),'split_seed':seed}
    (dest/'manifest.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',default='training/data');a=p.parse_args();process(a.input,a.output)

import json,tempfile,unittest
from pathlib import Path
from validate_dataset import process
class DatasetTests(unittest.TestCase):
 def test_dedup_split_and_reproducibility(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);source=root/'input.jsonl';rows=[{'text':f'Unique training example number {i} with enough words.'} for i in range(30)];rows.append(rows[0]);source.write_text('\n'.join(json.dumps(r) for r in rows))
   a=process(source,root/'a');b=process(source,root/'b')
   self.assertEqual(a,b);self.assertEqual(a['duplicates_removed'],1)
   self.assertEqual(a['train']+a['validation'],30)
   self.assertEqual((root/'a/train.jsonl').read_bytes(),(root/'b/train.jsonl').read_bytes())
   tr={json.loads(x)['text'] for x in (root/'a/train.jsonl').read_text().splitlines()}
   va={json.loads(x)['text'] for x in (root/'a/validation.jsonl').read_text().splitlines()}
   self.assertFalse(tr&va)
 def test_rejects_tiny_dataset(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);source=root/'data.jsonl';source.write_text(json.dumps({'text':'One reasonably long sentence for validation.'})+'\n')
   with self.assertRaises(ValueError):process(source,root/'out')
if __name__=='__main__':unittest.main()

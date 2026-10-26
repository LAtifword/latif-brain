# LATIF NI: preserve completed Colab LoRA training

**Scope:** This procedure backs up an **existing** adapter. It does not restart training or establish that the fine-tune is better than the base model.

In the still-running Colab session, create **one** new code cell and execute:

```python
from google.colab import drive
from pathlib import Path
import subprocess, datetime
drive.mount('/content/drive')
root = Path('/content/latif-brain')
assert (root/'artifacts/lora/adapter_model.safetensors').is_file(), 'Adapter missing in this Colab runtime'
run_id = datetime.datetime.now(datetime.timezone.utc).strftime('lora-%Y%m%dT%H%M%SZ')
destination = f'/content/drive/MyDrive/LATIF-NI/runs/{run_id}'
Path(destination).parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['python', 'training/preserve_lora.py', '--destination', destination], cwd=root, check=True)
print('PERSISTENT_BACKUP:', destination)
```

If the running notebook was cloned before this script was merged, fetch the exact script from the PR branch first, **without pulling or resetting the active project**:

```python
import urllib.request
url = 'https://raw.githubusercontent.com/LAtifword/latif-brain/fix/ni-training-artifact-preservation/training/preserve_lora.py'
target = '/content/latif-brain/training/preserve_lora.py'
urllib.request.urlretrieve(url, target)
```

The backup directory contains adapter weights, adapter config, tokenizer files, available evaluation JSON, available dataset manifest, and SHA-256 manifest. Do not upload private data or large checkpoints to public GitHub.

**Evidence limits:** The previous evaluation used held-out *files* from the same repository. That is not an independent instruction-following or code-execution benchmark, and its perplexity alone does not demonstrate improved agent performance. Compare base and adapter on a new, curated, task-level test set before deploying to Android.

**Never overwrite the existing Colab adapter or click Run all while backing up.** Colab runtime storage is ephemeral.

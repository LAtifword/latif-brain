import hashlib
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / 'tools' / 'verify-apk-model.py'
spec = importlib.util.spec_from_file_location('apk_verifier', SCRIPT)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class ApkModelVerifierTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.apk = Path(self.directory.name) / 'fixture.apk'
        self.entry = 'assets/models/test.litertlm'
        self.content = b'test-only model fixture' * 60000
        self.sha = hashlib.sha256(self.content).hexdigest()

    def write_zip(self, entries):
        with warnings.catch_warnings():
            warnings.simplefilter('ignore', UserWarning)
            with zipfile.ZipFile(self.apk, 'w', zipfile.ZIP_DEFLATED) as archive:
                for name, content in entries:
                    archive.writestr(name, content)

    def test_accepts_exact_model_and_hash_across_multiple_read_chunks(self):
        self.write_zip([(self.entry, self.content)])
        self.assertEqual(verifier.verify_model(self.apk, self.entry, self.sha.upper()), self.sha)

    def test_rejects_missing_model(self):
        self.write_zip([('other', self.content)])
        with self.assertRaisesRegex(ValueError, 'found 0'):
            verifier.verify_model(self.apk, self.entry, self.sha)

    def test_rejects_duplicate_model_entries(self):
        self.write_zip([(self.entry, self.content), (self.entry, self.content)])
        with self.assertRaisesRegex(ValueError, 'found 2'):
            verifier.verify_model(self.apk, self.entry, self.sha)

    def test_rejects_empty_model(self):
        self.write_zip([(self.entry, b'')])
        with self.assertRaisesRegex(ValueError, 'empty'):
            verifier.verify_model(self.apk, self.entry, self.sha)

    def test_rejects_mismatched_hash(self):
        self.write_zip([(self.entry, self.content)])
        with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
            verifier.verify_model(self.apk, self.entry, '0' * 64)

    def test_rejects_malformed_expected_hash(self):
        for value in ['', 'z' * 64, 'a' * 63]:
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, '64 hexadecimal'):
                verifier.verify_model(self.apk, self.entry, value)

    def test_cli_failure_is_nonzero_for_corrupt_archive(self):
        self.apk.write_bytes(b'not a zip')
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.apk), self.entry, self.sha], capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertIn('ERROR:', result.stderr)

    def test_cli_success_is_zero(self):
        self.write_zip([(self.entry, self.content)])
        result = subprocess.run([sys.executable, str(SCRIPT), str(self.apk), self.entry, self.sha], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(self.sha, result.stdout)


if __name__ == '__main__':
    unittest.main()

"""Verify an APK's embedded model without extracting it or loading it into RAM."""
import argparse
import hashlib
import re
import sys
import zipfile


def verify_model(apk, entry, expected_sha256):
    if not re.fullmatch(r'[0-9a-fA-F]{64}', expected_sha256):
        raise ValueError('Expected SHA-256 must contain exactly 64 hexadecimal characters')
    with zipfile.ZipFile(apk) as archive:
        matches = [item for item in archive.infolist() if item.filename == entry]
        if len(matches) != 1:
            raise ValueError(f'Expected exactly one model entry {entry}; found {len(matches)}')
        info = matches[0]
        if info.is_dir() or info.file_size == 0:
            raise ValueError(f'Model entry is empty or a directory: {entry}')
        digest = hashlib.sha256()
        with archive.open(info) as model:
            for chunk in iter(lambda: model.read(1024 * 1024), b''):
                digest.update(chunk)
        actual = digest.hexdigest()
        if actual != expected_sha256.lower():
            raise ValueError(f'Model checksum mismatch for {entry}: expected {expected_sha256}, got {actual}')
        return actual


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk')
    parser.add_argument('entry')
    parser.add_argument('sha256')
    args = parser.parse_args()
    try:
        digest = verify_model(args.apk, args.entry, args.sha256)
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        return 1
    print(f'Verified embedded model: {args.entry} SHA256={digest}')
    return 0


if __name__ == '__main__':
    sys.exit(main())

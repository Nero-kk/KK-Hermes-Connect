from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
destination = root / "dist"
destination.mkdir(exist_ok=True)
version = json.loads((root / "manifest.json").read_text())["version"]
archive_path = destination / f"KK-Hermes-Connect-{version}.zip"
files = ("manifest.json", "main.js", "styles.css", "README.md", "versions.json", "environment.example.json", "docs/verification.md")
with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
    for filename in files:
        archive.write(root / filename, filename)
(destination / "checksums.json").write_text(json.dumps({filename: hashlib.sha256((root / filename).read_bytes()).hexdigest() for filename in files}, indent=2))
print(json.dumps({"archive": str(archive_path), "files": files}))

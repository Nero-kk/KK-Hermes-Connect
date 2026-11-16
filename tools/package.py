from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
destination = root / "dist"
destination.mkdir(exist_ok=True)
files = ("manifest.json", "main.js", "styles.css", "README.md", "versions.json", "docs/verification.md")
with zipfile.ZipFile(destination / "KK-Hermes-Connect-0.1.0.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for filename in files:
        archive.write(root / filename, f"KK-Hermes-Connect/{filename}")
(destination / "checksums.json").write_text(json.dumps({filename: hashlib.sha256((root / filename).read_bytes()).hexdigest() for filename in files}, indent=2))
print(json.dumps({"archive": str(destination / "KK-Hermes-Connect-0.1.0.zip"), "files": files}))

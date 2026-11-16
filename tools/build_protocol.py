import json
from pathlib import Path

from kk_bridge.protocol import schema

root = Path(__file__).resolve().parents[1] / "protocol"
root.mkdir(exist_ok=True)
(root / "bridge-v1.schema.json").write_text(json.dumps(schema(), ensure_ascii=False, indent=2))

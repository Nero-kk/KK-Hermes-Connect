from __future__ import annotations

import json
import sys
from typing import ClassVar

import anyio
from aiohttp import ClientError, ClientSession, ClientTimeout
from pydantic import BaseModel, ConfigDict, Field

from .models import JSON_OBJECT


class Replacement(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(extra="forbid", frozen=True)
    text: str = Field(max_length=262144)


async def replace(port: int, grant: str, replacement: Replacement) -> None:
    async with ClientSession(timeout=ClientTimeout(total=100)) as session:
        async with session.post(f"http://127.0.0.1:{port}/v1/note-edit",
                                json={"grant": grant, "text": replacement.text}) as response:
            result = JSON_OBJECT.validate_json(await response.text())
            print(json.dumps(result, ensure_ascii=False))
            if response.status != 200 or result.get("success") is not True:
                raise SystemExit(1)


def main() -> None:
    try:
        replacement = Replacement.model_validate_json(sys.stdin.read(1048576))
        anyio.run(replace, int(sys.argv[1]), sys.argv[2], replacement)
    except (ValueError, IndexError, ClientError, TimeoutError) as error:
        print(json.dumps({"success": False, "reason": type(error).__name__}))
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()

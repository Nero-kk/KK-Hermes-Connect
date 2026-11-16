from dataclasses import dataclass, field

from aiohttp.web import WebSocketResponse

from .models import Device


@dataclass(slots=True)
class Viewer:
    device: Device
    socket: WebSocketResponse
    sessions: set[str] = field(default_factory=set)

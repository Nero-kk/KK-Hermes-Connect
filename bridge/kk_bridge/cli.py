from __future__ import annotations

import json
import os
from pathlib import Path

import anyio
import typer
from aiohttp import web

from .app import create_app
from .metadata import Metadata
from .models import Config
from .probe import probe

cli = typer.Typer(no_args_is_help=True, pretty_exceptions_enable=False)


def config() -> Config:
    path = Path(
        os.environ.get(
            "KK_HERMES_CONFIG", str(Path.home() / ".local/share/kk-hermes-connect/config.json")
        )
    )
    return Config.model_validate_json(path.read_text()) if path.exists() else Config()


@cli.command()
def serve() -> None:
    settings = config()
    web.run_app(
        create_app(settings), host="127.0.0.1", port=settings.port, access_log=None, print=None
    )


@cli.command()
def pair() -> None:
    metadata = Metadata(config().state_dir)
    try:
        typer.echo(metadata.pair_code())
    finally:
        metadata.close()


@cli.command()
def devices() -> None:
    metadata = Metadata(config().state_dir)
    try:
        typer.echo(json.dumps(metadata.devices(), ensure_ascii=False, indent=2))
    finally:
        metadata.close()


@cli.command()
def revoke(device_id: str) -> None:
    metadata = Metadata(config().state_dir)
    try:
        metadata.revoke(device_id)
        typer.echo("device_revoked")
    finally:
        metadata.close()


@cli.command()
def doctor() -> None:
    anyio.run(probe)


@cli.command()
def expire() -> None:
    metadata = Metadata(config().state_dir)
    try:
        typer.echo(f"expired_details={metadata.expire()}")
    finally:
        metadata.close()


def main() -> None:
    cli()


if __name__ == "__main__":
    main()

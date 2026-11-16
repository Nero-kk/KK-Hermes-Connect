from __future__ import annotations

import json
import subprocess

from kk_bridge.metadata import Metadata
from kk_bridge.models import Config


def main() -> None:
    metadata = Metadata(Config().state_dir)
    try:
        code = metadata.pair_code()
        expression = """(async()=>{
            const plugin=app.plugins.plugins['KK-Hermes-Connect'];
            if(!plugin) return {state:'plugin_not_loaded'};
            if(!plugin.credentials.deviceId){
                const paired=await plugin.store.transport.pair(
                    plugin.settings.endpoint, CODE, 'Windows Obsidian - Zero');
                if(paired.profileId!==plugin.settings.profileId)
                    return {state:'profile_mismatch'};
                plugin.credentials.store(paired.deviceId,paired.token);
                plugin.settings.serverId=paired.serverId;
                await plugin.saveSettings();
            }
            await plugin.store.connect();
            return {state:plugin.store.state,status:plugin.store.status,
                deviceId:plugin.credentials.deviceId,serverId:plugin.settings.serverId,
                profileId:plugin.settings.profileId};
        })()""".replace("CODE", json.dumps(code))
        result = subprocess.run(
            ["/mnt/d/Program Files/Obsidian/Obsidian.com", "vault=Zero", "eval",
             f"code={expression}"], capture_output=True, text=True, timeout=75, check=True)
        print(result.stdout.strip())
    finally:
        metadata.close()


if __name__ == "__main__":
    main()

# KK Hermes Connect

회사 WSL의 기존 `orchestrator_yeon` Gateway에 연결하는 Obsidian 플러그인과 Python 브리지입니다.
개인용 개발 빌드 `0.1.0`이며, PRD v0.4의 전체 출시 검수가 완료된 버전은 아닙니다.

## 설치 상태와 첫 연결

- 플러그인: `D:\Jin\Obsidian\Obsidian_Remote\Zero\.obsidian\plugins\KK-Hermes-Connect`
- 회사 환경: Ubuntu WSL, 사용자 `nero`, Tailscale IP `100.121.112.81`
- 기본 주소: `https://jin.tail8208fa.ts.net`
- 프로필: `/home/nero/.hermes/profiles/orchestrator_yeon`
- 브리지: `127.0.0.1:17867`, systemd 사용자 서비스 `kk-hermes-bridge`
- 브리지 환경과 metadata: `/home/nero/.local/share/kk-hermes-connect/`

2026-11-16 현재 Tailscale Serve의 HTTPS/WSS 노출과 Windows Zero 볼트의 기기 등록을 완료했습니다.
Windows에서는 명령 팔레트의 **KK Hermes Connect: 연이 채팅 열기**로 사용할 수 있습니다.
다른 기기는 같은 주소를 사용하고 각자 등록합니다. 아래 1~2단계는 회사 서버를 새로 구성할 때의 절차입니다.

1. Tailscale의 tailnet 설정에서 Serve를 활성화합니다. 활성화 링크는 CLI가 제공하며 README에 인증 링크를 저장하지 않습니다.
2. 회사 WSL에서 아래 명령을 실행해 HTTPS 역방향 프록시를 설정합니다.

   ```bash
   sudo tailscale serve --bg --https=443 http://127.0.0.1:17867
   ```

3. 같은 WSL에서 5분 유효·1회용 등록 코드를 발급합니다.

   ```bash
   /home/nero/.local/share/kk-hermes-connect/venv/bin/kk-hermes-bridge pair
   ```

4. Obsidian 명령 팔레트에서 `KK Hermes Connect: 연이 채팅 열기`를 실행합니다.
5. 채팅의 **설정**에서 회사 주소·기기 이름·등록 코드를 입력하고 **등록**합니다.
6. **대화 선택**으로 기존 세션을 열거나 **새 대화**를 만듭니다. Android·iPhone·iPad는 각 기기를 따로 등록합니다.

Windows 터미널에서 다른 기기의 등록 코드를 발급하려면 다음을 실행할 수도 있습니다.

```powershell
wsl -d Ubuntu -u nero -- /home/nero/.local/share/kk-hermes-connect/venv/bin/kk-hermes-bridge pair
```

SecretStorage가 있는 앱에서는 인증값을 해당 API에 저장합니다. 없는 앱에서는 메모리만 사용하므로 앱 종료 뒤 재등록해야 합니다.
SecretStorage는 볼트 범위의 공통 저장소이며, OS 키체인이나 다른 플러그인과의 보안 격리를 보장하지 않습니다.
token은 `data.json`에 기록하지 않습니다. 대화 원문·입력 초안은 영구 저장하지 않습니다.

## 대화와 제어

- 데스크톱: Enter 전송, Shift+Enter 줄바꿈. 한글 조합 중 Enter는 전송하지 않습니다.
- 모바일: Enter 줄바꿈, 전송 버튼으로 전송합니다.
- **대화 선택**은 Gateway가 제공한 최신 최대 200개를 대상으로 합니다. 검색 범위를 화면에 표시합니다.
- Slack 세션을 재개하면 기존 전달 정책에 따라 Slack에도 응답이 보일 수 있습니다. 플러그인이 Slack에 다시 게시하지 않습니다.
- **분기**는 native branch로 새 세션을 생성합니다. 원본은 보존되며 승계 범위는 Hermes의 저장된 현재 문맥을 따릅니다.
- **이 요청 중지**는 해당 operation의 admission만 제어합니다. 다른 본인 기기에서도 가능합니다.
- **상태 확인**은 이력·열린 질문·영수증을 다시 조회합니다. 결과 불명 요청을 새 ID로 자동 전송하지 않습니다.
- `unknown`은 이미 작업이 실행됐을 수 있는 상태입니다. 기존 Hermes 화면에서 이력과 native 상태를 확인해야 합니다.
- 응답 종료는 업무 성공과 다릅니다. 중지는 이미 실행된 파일 변경이나 외부 작업을 되돌리지 않습니다.
- 미지원 secret·sudo·기기 조작은 기존 Hermes TUI에서 처리합니다. 브리지는 해당 공유 요청에 자동 오류·빈 성공을 보내지 않습니다.

## 서비스 관리

```bash
systemctl --user status kk-hermes-bridge
systemctl --user restart kk-hermes-bridge
journalctl --user -u kk-hermes-bridge --since today
tailscale serve status
/home/nero/.local/share/kk-hermes-connect/venv/bin/kk-hermes-bridge doctor
/home/nero/.local/share/kk-hermes-connect/venv/bin/kk-hermes-bridge devices
/home/nero/.local/share/kk-hermes-connect/venv/bin/kk-hermes-bridge revoke DEVICE_ID
```

`doctor`는 버전·기능·세션 수와 필드명만 출력합니다. ticket과 대화 본문을 출력하지 않습니다.
기기를 폐기하면 새 연결·미소비 ticket과 열린 연결이 차단됩니다. 작업 취소는 별도입니다.
`expire`는 완료 상세 30일 이후 정리용이며, ID·scope·입력 hash tombstone은 보존합니다.

기본 CORS Origin은 `app://obsidian.md`, `capacitor://localhost`, `http://localhost`입니다.
실제 모바일 Origin이 다르면 설정 파일에 관찰한 정확한 Origin을 추가한 뒤 다시 검증해야 합니다.
설정은 `/home/nero/.local/share/kk-hermes-connect/config.json`에 Config 모델의 JSON 형식으로 둘 수 있습니다.
인증 HTTP는 표준 fetch의 redirect error, CORS, credentials omit과 타임아웃을 사용합니다.
인증 실패를 requestUrl·TLS 완화로 우회하지 않습니다.

WSL 자체가 종료되거나 회사 PC가 절전·종료 상태이면 연결할 수 없습니다.
서비스의 사용자 linger는 현재 활성화되어 있으나 Windows 부팅 후 WSL 시작은 별도의 운영 조건입니다.

## 빌드와 검증

Obsidian의 실행 번들은 `manifest.json`, `main.js`, `styles.css`입니다. 모바일에도 이 세 파일을 같은 플러그인 폴더로 설치합니다.
`node_modules`와 Python 가상환경을 모바일에 설치할 필요는 없습니다.

```bash
bun install --frozen-lockfile
bun run check
bun run lint
bun run test
bun run build
UV_PROJECT_ENVIRONMENT=/home/nero/.local/share/kk-hermes-connect/venv uv sync --project bridge --frozen
/home/nero/.local/share/kk-hermes-connect/venv/bin/pytest bridge/tests -q
```

실제 Gateway 통합 시험은 새 검수용 세션을 만들며 `live_check`는 기존 모델을 호출합니다.
`security_check`는 새 검수용 빈 세션·임시 기기를 만들고 종료 시 해당 기기를 폐기합니다.
기존 검수 세션은 삭제하지 않아 서버에서 결과를 확인할 수 있습니다.

```bash
/home/nero/.local/share/kk-hermes-connect/venv/bin/python -m kk_bridge.live_check
/home/nero/.local/share/kk-hermes-connect/venv/bin/python -m kk_bridge.security_check
```

실행 근거와 남은 검수는 [docs/verification.md](docs/verification.md)에 기록합니다.
화면 배치 검수용 예시 데이터는 실제 모델 응답이나 모바일 실기기 증거가 아닙니다.

## 제거와 복구

1. 필요한 기기 token을 `revoke`로 폐기합니다.
2. `systemctl --user disable --now kk-hermes-bridge`로 브리지를 중지합니다.
3. 이 브리지를 위해 설정한 HTTPS Serve만 `tailscale serve --https=443 off`로 해제합니다. 다른 서비스의 설정을 reset하지 않습니다.
4. Obsidian에서 플러그인을 비활성화합니다. metadata와 소스의 보존·삭제는 사용자가 선택합니다.

기존 Hermes·Slack·Tailscale·SSH·세션 DB를 삭제하거나 변환하지 않습니다.
metadata 복원 전 서비스를 중지하고 자기 DB를 백업합니다. 복원 후 미완료 operation과 native 영수증을 대조한 뒤 사용합니다.
server identity와 중복 방지 기록이 함께 유실된 경우 새 설치로 등록하고 이전 요청을 미접수로 판단하지 않습니다.

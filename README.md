# KK Hermes Connect

### 0.6.0 작은 입력창과 @ 노트 참조

- 상단 대화 제목과 연결 버튼을 제거했습니다. 등록된 기기는 플러그인 로드 후 자동으로 연결합니다.
- 대화·입력창·참조·모델·사용량 글자는 기본 2단계(4px) 축소합니다. 설정에서 PC/모바일을 따로 -4~+4단계로 조절하며, 최소 크기는 10px입니다.
- 입력창에서 `@` 뒤에 노트명이나 경로를 입력하면 Markdown 노트 후보가 표시됩니다. 방향키로 이동하고 Enter/Tab 또는 클릭으로 선택합니다. 한 번에 노트 하나를 참조하며 새 선택은 기존 참조를 바꿉니다. 선택한 노트는 다른 노트를 클릭해도 유지되고 ×로 해제합니다. 본문은 전송 시에만 질문과 함께 전달됩니다.
- 선택한 노트가 편집기로 열려 있으면 최신 편집 버퍼를 참조합니다. 닫힌 노트가 선택 이후 수정된 경우 다시 선택하도록 안내하며 오래된 내용을 보내지 않습니다.
- 입력창 위의 작은 아이콘으로 현재 대화를 새 Obsidian 탭에서 열기, 새 대화, 대화 이력, 대화 분기, 설정을 실행합니다. 새 탭은 현재 대화의 다른 보기이며 대화별 독립 탭 관리 기능은 아닙니다.
- 모바일 사용량은 아이콘만 표시하고 탭하면 잔여량·초기화 시간을 펼칩니다. PC는 계속 한 줄로 표시합니다.

### 0.5.0 입력창

Claudian 형태의 입력창: 상단 노트 참조, 선택 줄 칩(클릭해 미리 보기, ×로 선택만 해제), 하단 모델·추론 선택창과 권한 표시를 제공합니다. 모델 버튼을 누르면 제공자별 모델과 추론 강도를 선택합니다.

설정의 **모델 선택창**에서 표시할 모델을 체크하고 위·아래 버튼으로 순서를 정합니다. 기본값은 첫 8개이며 현재 모델은 항상 표시합니다. 설정은 기기에 저장됩니다.

입력창 아래에는 선택한 제공자의 실제 잔여율과 초기화까지 남은 시간을 표시합니다. **브리지도 이 버전의 소스로 업데이트하고 재시작해야 합니다.** Hermes `model.options`의 `usage.windows`가 있는 계정만 수치를 표시하며, 제공되지 않는 경우 “잔여량 정보 없음”으로 표시합니다. 여러 계정의 사용량을 임의로 합산하지 않습니다. 사용량은 1분마다 갱신합니다.

회사 WSL의 기존 `orchestrator_yeon` Gateway에 연결하는 Obsidian 플러그인과 Python 브리지입니다.
개인용 개발 빌드 `0.4.0`이며, PRD v0.4의 전체 출시 검수가 완료된 버전은 아닙니다.

기기 이름은 설정을 다시 열거나 플러그인을 재시작해도 유지되며, 다음 기기 등록에 사용됩니다. 0.2.1에서는 등록·환경 적용·JSON 내보내기를 마친 뒤 앱이 멈추던 공통 버튼 처리 오류를 수정했습니다.

0.3.1은 채팅창을 간결하게 정리했습니다. 내부 세션 ID, 본문 없는 메시지 행, 완료 후 상시 문구와 입력창의 보이는 제목을 숨깁니다. 입력창은 기본 한 줄이며 데스크톱 버튼·선택 상자·글자·하단 여백을 줄였습니다. Slack 전달 안내와 오류·미완료 작업 상태는 표시합니다.

## 활성 노트와 선택 문장 참조

노트를 클릭한 뒤 Yeon Chat에 질문하면 마지막 활성 Markdown 노트의 내용을 함께 보냅니다. 편집 화면에서 문장을 드래그하거나 키보드로 선택했다면 선택 부분만 보냅니다. 읽기 화면의 드래그 선택도 지원하며, 채팅으로 포커스를 옮겨도 참조가 유지됩니다. 편집 중인 노트는 아직 저장되지 않은 수정 내용까지 반영합니다.

입력창 위 **노트 참조**에서 대상 노트·선택 행을 확인하고 **보기**로 실제 전송 내용을 미리 볼 수 있습니다. **노트 참조**를 눌러 끄면 질문만 전송합니다. 편집기 우클릭 메뉴 또는 명령 팔레트의 **활성 노트·선택 문장을 Yeon Chat에 첨부**도 사용할 수 있습니다. 노트 전환 시 참조도 바뀌며, 선택한 문장이 편집된 경우 다시 선택하라는 안내를 표시합니다.

예: 문장을 선택하고 “이 문장을 자연스럽게 교정해줘”, 노트 전체를 참조하고 “핵심 내용을 요약해줘”라고 입력합니다. 답변은 채팅으로 받으며 노트를 자동으로 수정하지 않습니다. 전송한 질문 아래 **참조**를 펼치면 당시 첨부한 원문을 확인할 수 있습니다.

전송 버튼을 누를 때에만 참조 내용을 회사 Hermes로 보내며 서버 대화 이력에 보존됩니다. 원격 서버가 Windows 볼트를 직접 읽는 방식이 아닙니다. 다른 노트·링크·첨부파일은 자동 수집하지 않고, 참조 내용은 접속 환경 JSON에 포함하지 않습니다. 질문과 참조를 합쳐 UTF-8 64 KiB 제한을 초과하면 일부를 잘라 보내지 않고 전송을 막습니다. 필요한 문장만 선택하거나 참조를 꺼 주세요.

[Claudian의 선택 영역 유지 구조](https://github.com/YishenTu/claudian/blob/201922d08ae2ad1465e3aed9df7eda3cdc0cf968/src/features/chat/input/SelectionController.ts)를 참고했으며, 기존 Hermes 전송과 안전한 메시지 렌더링에 맞춰 구현했습니다.

## 모델과 추론 강도

메시지 입력창 아래 **모델**과 **추론 강도** 드롭다운에서 선택합니다. 모델 목록은 회사 Hermes의 인증된 공급자 목록에서 읽습니다. 선택 즉시 현재 대화의 실행 설정을 변경하고 서버에서 확인한 적용값을 표시합니다. `/model`이나 `/reasoning` 문자열을 채팅 메시지로 보내지 않습니다.

변경 범위는 현재 선택한 대화이며 Hermes가 서버에 보존합니다. 응답 생성 중과 설정 적용 중에는 선택을 잠그고, 설정 적용 중에는 전송도 잠시 막습니다. 서버가 모델 변경 확인을 요구하면 해당 내용을 표시하고 명시적으로 확인받습니다. 거절·실패하면 서버의 실제 값으로 되돌립니다. 모델이 추론 강도를 지원하지 않으면 해당 드롭다운은 비활성화됩니다. Hermes가 요청 강도를 조정하면 실제 요청 강도를 함께 표시합니다.

드롭다운은 좁은 창에서 두 줄로 배치됩니다. 회사 브리지도 같은 소스 버전으로 업데이트해야 새 설정 RPC를 사용할 수 있습니다.

## 접속 환경 가져오기 / 내보내기

1. 플러그인 설정 또는 채팅의 **설정 → 환경 정보 열기**를 엽니다.
2. JSON 파일을 선택하면 내용과 입력 항목이 함께 채워집니다. 내용을 직접 붙여넣는 경우 **JSON 미리보기**를 누릅니다. 배포용 예시는 `environment.example.json`입니다. Windows UTF-8 BOM이 붙은 JSON도 지원합니다.
3. 회사 HTTPS 주소, 서버 프로필 ID/경로, Tailscale IP, Ubuntu 계정명, Windows 볼트 경로, Ubuntu 홈·플러그인·Hermes·브리지 경로, 프로필 이름과 Slack 채널·검수 세션·작업 ID를 확인합니다. 여러 ID는 줄마다 하나씩 입력합니다.
4. **전체 적용**을 누르면 모든 항목이 함께 저장됩니다. 파일 선택이나 미리보기만으로는 설정이 바뀌지 않습니다.
5. **파일로 내보내기**는 화면의 값을 볼트 안의 `*.private.json` 파일로 저장합니다. 하위 폴더는 미리 있어야 하며, 기존 파일은 덮어쓰지 않습니다.

같은 주소·프로필의 환경 정보만 갱신하면 현재 연결과 기기 등록이 유지됩니다. 연결 대상이 바뀌면 기기 인증과 이전 서버·세션 참조를 해제하고 다시 등록해야 합니다. 미완료 작업이 있으면 대상 변경을 막습니다.
Slack·검수 세션·작업 ID는 환경에 보관하는 참조 목록입니다. 가져오기로 메시지를 전송하거나 작업을 재실행·중지하지 않습니다. 서버의 계정·경로를 변경하는 기능은 아니므로 회사 브리지의 설정도 별도로 맞춰야 합니다.

내보내기에는 인증 토큰·등록 코드·SecretStorage 참조·미완료 작업 상태가 포함되지 않습니다. 환경 파일 자체에는 접속 주소와 개인 경로가 있으므로 공개 저장소에 올리지 마세요. 이 플러그인 저장소는 `private/`와 `*.private.json`을 Git에서 제외합니다. 볼트의 다른 위치에 내보낸 파일은 해당 저장소의 제외 설정을 별도로 확인하세요.

## 설치 상태와 첫 연결

- 플러그인: `D:\Jin\Obsidian\Obsidian_Remote\Zero\.obsidian\plugins\KK-Hermes-Connect`
- 회사 환경: Ubuntu WSL, 사용자 `nero`, Tailscale IP `100.121.112.81`
- 기본 주소: `https://jin.tail8208fa.ts.net`
- 프로필: `/home/nero/.hermes/profiles/orchestrator_yeon`
- 브리지: `127.0.0.1:17867`, systemd 사용자 서비스 `kk-hermes-bridge`
- 브리지 환경과 metadata: `/home/nero/.local/share/kk-hermes-connect/`

2026-11-16 현재 Tailscale Serve의 HTTPS/WSS 노출과 Windows Zero 볼트의 기기 등록을 완료했습니다.
Windows에서는 명령 팔레트의 **KK Hermes Connect: Hermes Chat Open**으로 사용할 수 있습니다.
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

4. Obsidian 명령 팔레트에서 `KK Hermes Connect: Hermes Chat Open`을 실행합니다.
5. 채팅의 **설정**에서 회사 주소·기기 이름·등록 코드를 입력하고 **등록**합니다.
6. **대화 선택**으로 기존 세션을 열거나 **새 대화**를 만듭니다. Android·iPhone·iPad는 각 기기를 따로 등록합니다.

이미 등록한 기기는 **연결 테스트**를 사용합니다. **재등록**은 새로 발급한 1회 코드가 있을 때 사용합니다. 비어 있거나 형식이 잘못된 코드는 서버에 보내지 않고 입력 안내를 표시합니다. 환경 JSON에는 등록 코드나 인증 토큰이 포함되지 않습니다. 프로필 항목의 이름은 **Hermes bot Profile**입니다.

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
- **대화 분기**는 현재 대화 문맥을 이어받아 별도의 새 대화를 만듭니다. 원본은 보존되며 승계 범위는 Hermes의 저장된 현재 문맥을 따릅니다. 버튼 설명과 실행 전 확인 창에서 이를 안내합니다.
- **이 요청 중지**는 해당 operation의 admission만 제어합니다. 다른 본인 기기에서도 가능합니다.
- 연결 중에는 이력·열린 질문·작업 영수증을 3초마다 자동 조회합니다. 중복되는 **상태 확인** 버튼은 제거했습니다. 결과 불명 요청을 새 ID로 자동 전송하지 않습니다.
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

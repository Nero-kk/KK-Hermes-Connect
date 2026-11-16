# 검증 기록

2026-11-16, 개인용 개발 빌드 0.1.0. 문서 기준 PRD/TRD/SDD v0.4.

## 0.3.0 모델·추론 강도 드롭다운

- 입력창 아래 모델·추론 강도 선택을 추가했다. 회사 Gateway의 model.options에서 목록을 읽고 session.mutate의 model/reasoning 동작으로 현재 대화 정책을 바꾼다. 일반 채팅 전송 경로는 사용하지 않는다.
- 외부 RPC는 models.get/models.set/reasoning.set만 추가했다. 고정 프로필·소유자 확인과 열린 세션 검사를 유지하고 모델 후보·인증 상태·지원 여부를 검사한다. 변경은 request ID, 예상 revision·generation으로 보호한다. 기본 프로필 설정이나 다른 대화를 덮어쓰지 않는다.
- 실제 Hermes의 별도 빈 검수 대화에서 모델 변경과 High → Medium 변경을 실행했다. native snapshot의 reasoning_effort_wire도 medium이었고 채팅 행 수는 0이었다. 원래 대화의 설정은 유지됐다. 오래된 revision으로 변경하면 거부되는 것을 확인했다. 검수 대화는 제거했다.
- 실제 Windows Obsidian에서 ready 연결, 모델 후보 125개와 두 드롭다운을 확인했다. 화면의 선택은 서버가 반환한 값이며 입력 초안은 변경 경로와 분리했다. 실행 중·적용 중 잠금, 실패 시 재조회, 명시적 확인, 늦게 도착한 다른 대화 결과의 무시를 구현했다.
- Vitest 61개와 Python 21개 통과. 새 검사는 서버 확인값 표시·실패 복원·확인 취소·대화 전환 경합·응답 중 잠금, 비공개 정보 투영 제외·사용 불가 모델/추론 거부·revision 거부·추가 RPC 필드 거부를 다룬다. TypeScript·oxlint·ruff와 신규 Python 모듈의 basedpyright 오류 0개를 확인했다.
- 실제 ModelPanel 모듈과 배포 CSS를 사용한 독립 Chromium 검수에서 320/390/585/1440px × light/dark 8개 조합의 선택 요소 2개·가로 넘침 없음·44px 높이를 확인했다. evidence/model-controls-*.png와 model-visual-checks.json은 일반 예시 데이터를 사용한 컴포넌트 배치 증거이며 Obsidian 전체 화면이나 모바일 실기기 검수로 간주하지 않는다.

## 0.2.2 JSON 재가져오기·등록 입력 안내

2026-11-16에 사용자의 실제 내보내기 파일과 Windows Obsidian에서 재현하고 수정했다.

- 원본 내보내기 파일은 BOM 없는 정상 JSON이었다. 파일을 선택하면 미리보기 화면이 다시 생성되면서 붙여넣기 값이 비었고, 이어서 불러오기를 누르면 빈 문자열을 파싱해 JSON 오류가 났다. 수정 전 실제 앱에서 빈 입력과 오류 Notice를 확인했다.
- 파일 내용을 JSON 입력 칸에 유지하고 버튼을 JSON 미리보기로 구분했다. 같은 사용자 파일을 선택하고 미리보기·전체 적용을 실행해 모든 환경값의 저장을 확인했다. 새로 내보낸 파일도 같은 경로로 재가져오기·적용했고 기존 검수 기기 등록과 ready 상태를 유지했다. 원래 사용자 파일은 수정하지 않았다.
- UTF-8 BOM과 앞뒤 공백을 처리하며, 빈 JSON에는 파일 선택·붙여넣기 안내를 표시한다.
- 등록 코드가 비어 있을 때 서버가 invalid_schema를 반환하는 증상도 실제로 재현했다. 코드와 기기 이름은 이제 HTTP 요청 전 검사한다. 등록 정보가 있으면 재등록으로 표시하고 연결 테스트와 구분한다. 코드가 없을 때의 구체적 안내와 실제 새 코드 등록·ready·재등록 표시를 확인했다.
- 고정 연이 프로필을 Hermes bot Profile로 변경했다. 상태 확인 버튼은 3초 자동 갱신과 중복되어 제거하고 미완료 요청 안내도 자동 조회에 맞췄다. 원본 문맥으로 새 대화를 만드는 분기는 대화 분기로 이름을 바꾸고 설명을 추가했다. 실제 채팅 DOM에서 버튼 제거와 설명을 확인했다.
- 추가 회귀 검사 8개는 수정 전 실패하고 수정 후 통과했다. 전체 Vitest 56개와 TypeScript 타입 검사·oxlint 통과. 검수용 등록은 별도 메모리 인증과 임시 설정을 사용했으며 검수 기기를 폐기하고 임시 파일·플러그인도 제거했다. 모바일 실기기 검수는 수행하지 않았다.

## 0.2.1 기기 이름·버튼 멈춤 수정

2026-11-16, 실제 Windows Obsidian 1.15.1에서 재현하고 수정했다.

- 수정 전 기기 이름은 화면을 다시 그리면 초기화됐고 설정에도 저장되지 않았다. 수정 후 입력값이 실제 설정 JSON에 저장되고 화면을 다시 열어도 유지된다. 등록할 이름은 100자 이내이며 빈 이름은 거부한다.
- 내보내기·등록·환경 적용의 finally 콜백이 ButtonComponent를 반환했다. Obsidian BaseComponent.then이 자기 자신을 콜백에 넘기므로 Promise가 같은 컴포넌트를 계속 해석하며 UI가 멈췄다. 실제 API를 계측해 반복을 13회에서 중단한 재현에서 내보내기와 등록 양쪽 문제가 확인됐다. 0.2.0에서 CLI 응답 중단으로 남겼던 문제도 이 경로에서 재현했다.
- 버튼 동작을 공통 runButtonAction으로 처리하고 finally에서는 반환값 없이 활성화만 한다. 같은 재현은 수정 후 then 호출 0회로 완료됐다.
- 회귀 검사 2개는 기존 finally 패턴에서 모두 실패하고 수정 후 통과했다. 전체 Vitest 48개, Python 10개, TypeScript 타입 검사·oxlint·ruff가 통과했다.
- 실제 UI에서 JSON 파일 생성·인증 필드 제외·기존 파일 덮어쓰기 차단·환경 적용을 확인했다. 잘못된 등록 코드의 오류 표시와 버튼 복구, 실제 1회 코드의 등록 성공·WSS ready·입력 코드 초기화·기기 이름 보존도 확인했다.
- 검수에는 별도 메모리 인증과 임시 설정 경로를 사용했다. 검수 기기는 폐기하고 연결·설정·생성 JSON·임시 플러그인을 정리했다. 원래 기기 인증은 유지했다.
- 명령 Hermes Chat Open, 탭·빈 화면 제목 Yeon Chat, 대화 기본 제목·빈 화면 안내 Chat with Yeon, 입력 라벨과 접근성 이름 Message Yeon을 실제 DOM에서 확인했다. 브리지의 같은 기본 제목 문구도 수정했다.
- 회사 브리지를 재시작한 뒤 기존 기기로 ready에 재연결했으며 제목 Chat with Yeon과 미완료 요청 0개를 확인했다. 모바일 실기기 검수는 이번 범위에서 수행하지 않았다.

## 0.2.0 환경 가져오기 / 내보내기

2026-11-16에 환경 JSON 파일 선택·붙여넣기·일괄 적용·개인 JSON 내보내기를 추가했다.

- TypeScript 타입 검사와 oxlint 통과. Vitest 46개, Python 기존 회귀 검사 10개 통과.
- 환경 전용 24개 검사는 전체 필드 왕복, 인증·실행 상태 제외, 같은 대상의 연결 참조 보존, 미완료 작업 중 대상 변경 차단, 잘못된 JSON·주소·IP·버전·용량과 내보내기 경로 거부를 확인한다.
- 실제 Windows Obsidian에서 0.2.0 재로드와 기존 인증의 ready 연결을 확인했다. 파일 선택 후 설정 16행이 표시되고 적용 전 환경 목록이 바뀌지 않았다.
- 전체 적용 후 실제 data.json의 모든 환경 필드와 접속 대상이 개인 환경 파일과 일치했다. 미완료 작업은 0개이며 data.json에 token·deviceId·secretRef 필드가 없다.
- 이후 Obsidian CLI가 단순 eval·version 요청에도 응답하지 않아 실제 내보내기 버튼의 파일 생성·덮어쓰기 방지와 후속 화면 캡처는 검증을 완료하지 못했다. 이 항목을 실제 앱 통과로 판단하지 않는다. 모바일 실기기 검수도 미완료다.
- 개인 환경 파일은 private/에 두고 Git에서 제외했다. 배포 ZIP에는 일반 예시 JSON만 추가했다. 기존 GitHub 커밋과 0.1.0 릴리스는 변경하지 않았다.

## 관찰한 실제 환경

- Windows Obsidian 실행 화면: 1.15.0, `app://obsidian.md`, SecretStorage 사용 가능.
- Ubuntu WSL의 기존 Hermes profile: `/home/nero/.hermes/profiles/orchestrator_yeon`.
- 실제 Gateway와 CLI code identity 모두 `3b421578588243f920886e6fe79a6faa87ea026e`.
- runtime.describe: durable-admission-v1, event-replay-v1, local-cli-create-v1, clarify-batch-v1, session-client-v1, session-transcript-v1, session-list-picker-v1 등.
- 실제 저장 목록은 200개 반환. 출처 cli, tui, local, slack, cron 확인. cursor/query는 native 목록에 보내지 않음.
- Tailscale DNS `jin.tail8208fa.ts.net`, Ubuntu 내부 Tailscale Running.
- 사용자 systemd 서비스 `kk-hermes-bridge` enabled/active, linger yes.

## 실행한 동작

| 항목 | 결과와 증거 |
| --- | --- |
| 실제 플러그인 설치 | Windows Obsidian이 manifest를 검색하고 enable, command open-chat, reload 성공 |
| 자동 클라이언트 시험 | Vitest 22개 통과. 안전한 Markdown, HTTP/WSS 대상 제한, 명시 승인·clarify·미지원 입력 카드 |
| 자동 브리지 시험 | pytest 10개 통과. token 폐기, 1회 등록 코드, owner 제어, payload/scope 충돌, tombstone, 승인 경쟁·server request 라우팅 |
| 실제 새 대화 | `local-411ed3b2cde48a267bd0d72aa87bd16fe22f80f612093e8b9883e0ef1e20f0b9` |
| 같은 create ID 재시도 | 위와 같은 canonical ID 반환. 새 세션을 중복 생성하지 않음 |
| 같은 send ID 재시도 | operation `3e1ea432-357d-44d0-9b38-b21192907b31`에 동일 admission, terminal completed |
| 저장 이력 | 사용자 행 정확히 1개, 전체 저장 행 2개. 응답 원문은 증거 문서에 복제하지 않음 |
| 실제 분기 | `local-ee475da7da135d65637f2d46131eac061ca9668a6df7fded50cf31cbe6e17e6c`, 원본과 다른 ID, 저장 행 승계 확인 |
| 실제 보안 시험 | 잘못된 Origin, ticket 재사용, 임의 shell RPC, 다른 owner 조회, owner 필드 위장, 폐기 전 발급 ticket 거부. 같은 owner의 다른 기기 조회 성공. 총 7개 통과 |

위 최초 통합 시험은 loopback 브리지 HTTP/WebSocket을 사용했다. 이후 Windows Obsidian의 HTTPS/CORS·WSS 왕복 검증은 아래 별도 항목에 기록한다.

## 출시 차단·미검증 항목

- Tailscale Serve 활성화 대기는 해소했다. HTTPS/WSS 등록·Windows 채팅과 재접속은 아래 결과를 따른다.
- Android·iPhone·iPad 각각의 등록, TLS/CORS/redirect, 백그라운드 복귀, 화면/외장 키보드 실제 검수 필요.
- 지정 Slack 채널 `C0CHQJRCNH1`은 연결된 Slack의 읽기 전용 조회로 `#zero`임을 확인. 실제 게시 시험은 실행하지 않음. native 목록은 채널 ID 필드를 제공하지 않아 해당 채널과 저장 세션의 매핑은 별도 확인 필요.
- 기존 Slack 세션의 원래 전달, Slack 분기 문맥, 기존 TUI 문맥을 묻는 실제 시험은 미완료.
- 실제 도구의 성공·실패·부분 결과, 실제 native 승인과 TUI 다중 뷰어 핸드오프는 별도 검수 필요. 승인 경쟁과 라우팅의 자동 시험은 이 실기기 검수를 대신하지 않음.
- ACK 유실, 브리지/Gateway 재시작 도중 접수, 이벤트 gap·epoch 교체, 두 기기의 실제 중지 경합을 포함한 장애 주입 검수 필요.
- p95 연결·렌더·복구 성능 목표는 아직 측정하지 않음.
- 1.11.0은 선언한 최소 앱 버전이며 해당 버전의 실제 실행 시험은 미완료.

Obsidian의 기존 오류 로그에는 이 작업 이전의 삭제된 QA 노트 ENOENT와 다른 플러그인의 연결 오류가 있었다.
데스크톱의 모바일 에뮬레이션에서는 기존 translate/realclaudian의 Node API 미지원 알림도 관찰했다.
이 플러그인의 번들은 Obsidian 이외의 Node/Electron import를 포함하지 않는다.

## 최종 코드 재검증

- 최신 코드에서도 TypeScript 검사와 oxlint, 브리지 ruff 검사가 통과했다.
- 기반 Python 타입 검사에서 오류는 0개이며 경고 99개가 남아 있다. aiohttp/SQLite의 동적 타입 경계, 클래스 속성 표기, 사용하지 않는 API 반환값 등의 경고를 포함한다. Python 타입 검사가 완전히 깨끗하다고 주장하지 않는다.
- payload hash 검사와 WSS 대상 host 검사에 각각 결함을 주입했을 때 관련 시험이 실패했고 원본 파일의 SHA-256이 복원됨을 확인했다.
- 최신 실제 Gateway 재시험: 원본 `local-75ab3a02e05ca6e6a368d30da311a571bf098378d7795ea94a334cb05b236fc0`, operation `237c18cc-bfd6-4899-93d5-6df397ca5e5d`, 분기 `local-b7ef59751a115e25b6802742a5dedace3104e3b95a2c364553ccc3e884595b4a`. 동일 ID 재시도·사용자 행 1개·완료·분기 승계를 다시 확인했다.
- 모바일 배치의 하단 탐색 막대가 입력창을 덮는 문제를 수정하고 좌표 hit-test로 입력창·전송 버튼의 노출을 확인했다. 승인 버튼은 요청 영역 안에서 고정한다.
- CDP의 영역 지정 캡처가 일부 실행에서 30초·60초 타임아웃을 일으켜, 최종 캡처는 Obsidian의 기본 dev:screenshot 경로로 전환했다.
- 이후 검토에서 Zero 창의 document.hidden이 true인 동안 기본 캡처도 이전 프레임·불완전한 합성 프레임을 저장하는 것을 발견했다. 해당 18개 이미지는 화면 통과 증거로 인정하지 않는다. DOM의 너비·입력창·전송 버튼 hit-test 결과와 픽셀 검증은 구분한다. QA 도구는 이제 대상 창이 숨겨져 있으면 즉시 중단한다.
- Windows 앱을 다시 조회한 시점에는 Obsidian 1.15.1이 실행 중이었다. 초기 1.15.0 관찰과 최종 앱 버전을 구분한다.
- 화면 기준은 키보드 접근, 안전 영역, 줄바꿈과 스크롤 소유권이다. WCAG 2.2 AA 전체 적합성 인증 및 실제 스크린리더·실기기 키보드 검수는 미완료다.

## Serve 활성화 이후 Windows 실제 연결 검증

2026-11-16 사용자의 tailnet Serve 활성화 후 회사 Ubuntu에서 기존 브리지를 HTTPS로 노출했다.
일반 계정의 Serve 설정은 권한 거부가 발생해 `sudo -n tailscale serve --bg --https=443 http://127.0.0.1:17867`로 구성했다.
Tailscale operator 권한을 추가하거나 Funnel을 설정하지 않았다.

| 항목 | 실제 관찰 |
| --- | --- |
| 주소 | `https://jin.tail8208fa.ts.net`, Tailscale Serve의 `/` → `127.0.0.1:17867` |
| Windows 인증 HTTP | Obsidian의 실제 `app://obsidian.md`에서 표준 fetch로 health 200, 1회 코드 교환 성공 |
| CORS | 실제 OPTIONS 응답 204, 정확한 Origin 허용, Authorization·Content-Type 허용 |
| WSS | 실제 플러그인의 Transport와 bridge.hello를 통해 `ready`, 고정 profile 일치 |
| Windows 기기 인증 | SecretStorage에 저장. 새로 생성한 등록 코드·token 원문은 증거에 기록하지 않음 |
| 실제 새 세션 | `local-9f8edea19c496dc3acdd13d8d006edebd47c9f76373bf55d67e12860a2b934e7`, source gui |
| 실제 전송 | operation `974ebcf6-8d40-430c-9fde-149f334dbbc9`, queued → completed, 미완료 전송 0개 |
| 스트리밍 | 실제 ChatStore listener에서 stream 길이 최대 144자 관찰. 본문은 로그에 복제하지 않음 |
| 저장 이력 | 같은 세션의 user 1행과 assistant 2행 확인. native row ID를 그대로 유지 |
| 명시적 재접속 | disconnect → connect 후 ready, 같은 canonical ID·같은 저장 row ID 목록, 미완료 전송 0개 |
| 플러그인 재로드 | 새 Credentials 인스턴스가 같은 기기 인증을 복원. 재등록 없이 ready, 같은 세션·같은 row ID 목록, 미완료 전송 0개 |
| HTTPS 오류 경계 | 허용하지 않은 Origin은 403, token 없는 connect는 401 |

최초 HTTPS health 시도 한 번은 인증서 준비 과정에서 타임아웃이 발생했으며 이후 curl과 실제 앱의 요청은 성공했다.
이는 warm connect p95 측정 결과가 아니다. Android·iPhone·iPad에서의 기기 등록·WSS·복귀 및 redirect/TLS 실패 주입은 아직 미검증이다.

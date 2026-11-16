export class BridgeError extends Error {
  constructor(readonly code: string) { super(code); this.name = "BridgeError"; }
}

const labels: Readonly<Record<string, string>> = {
  environment_too_large: "환경 파일은 UTF-8 기준 128 KiB 이하여야 합니다.",
  environment_empty_json: "불러올 JSON 내용이 없습니다. 환경 JSON 파일을 선택하거나 내용을 붙여넣어 주세요.",
  environment_invalid_json: "JSON 형식이 올바르지 않습니다. 기존 설정은 유지됩니다.",
  environment_invalid_schema: "환경 파일의 형식·버전·필드 값을 확인하세요. 인증 토큰은 포함할 수 없습니다.",
  environment_pending_operations: "미완료 요청이 있어 연결 대상을 바꿀 수 없습니다. 먼저 실행 상태를 확인하세요.",
  environment_invalid_path: "볼트 안의 .private.json 파일명을 입력하세요. 숨김 폴더와 상위 경로는 사용할 수 없습니다.",
  environment_file_exists: "같은 파일이 이미 있습니다. 다른 이름으로 내보내세요.",
  endpoint_unreachable: "회사 연결에 닿지 못했습니다. Tailscale과 회사 PC 상태를 확인하세요.",
  authentication_required: "이 기기를 등록해 주세요.",
  invalid_pair_code: "등록 코드가 잘못되었거나 만료되었습니다.",
  pair_code_required: "등록 코드가 필요합니다. 회사 WSL에서 kk-hermes-bridge pair로 새 1회 코드를 발급해 입력하세요. 이미 등록한 기기는 연결 테스트를 누르세요.",
  invalid_pair_code_format: "등록 코드 형식이 올바르지 않습니다. 회사 WSL에서 발급한 코드만 입력하세요. 명령어·파일명·토큰은 등록 코드가 아닙니다.",
  invalid_schema: "요청 입력값이 올바르지 않습니다. 등록 코드와 기기 이름 등 입력 항목을 확인하세요.",
  invalid_device_label: "기기 이름을 입력하세요. 최대 100자까지 사용할 수 있습니다.",
  device_revoked: "기기 인증이 폐기되었습니다. 다시 등록해 주세요.",
  profile_mismatch: "설정한 Hermes bot Profile과 서버 프로필이 다릅니다.",
  server_mismatch: "등록한 서버와 다른 서버입니다. 연결 설정을 확인하세요.",
  incompatible_gateway: "이 Gateway 버전의 호환성을 확인해야 합니다.",
  gateway_unavailable: "회사 Hermes Gateway가 준비되지 않았습니다.",
  outcome_unknown: "실행 결과 확인 필요. 상태를 조회한 뒤 판단하세요. 새 요청으로 자동 재전송하지 않습니다.",
  operation_conflict: "같은 전송 ID에 다른 입력이 있습니다. 다시 실행하지 않았습니다.",
  operation_forbidden: "이 요청을 제어할 권한이 없습니다.",
  operation_expired: "요청 상세의 보존 기간이 끝났습니다. 같은 ID로 다시 실행할 수 없습니다.",
  already_answered: "이미 처리 중이거나 종료된 질문입니다.",
  request_expired: "질문이 만료되었거나 실행 상태가 바뀌었습니다.",
  payload_too_large: "입력 또는 이력이 크기 제한을 초과했습니다.",
  auth_transport_unsupported: "인증 통신에 실패했습니다. HTTPS 인증서·CORS·리다이렉트 설정을 확인하세요.",
  invalid_endpoint: "경로나 사용자 정보가 없는 HTTPS 서버 주소를 입력하세요.",
  invalid_ws_target: "서버가 다른 대상의 WebSocket 주소를 반환해 연결을 중단했습니다.",
  rate_limited: "등록 시도가 많습니다. 잠시 후 다시 시도하세요.",
  session_busy: "이 대화는 실행 중입니다. 완료 후 다시 시도하세요.",
  revision_conflict: "대화가 변경되었습니다. 상태를 새로 확인하세요.",
  stale_generation: "실행 상태가 변경되었습니다. 상태를 새로 확인하세요.",
  model_unavailable: "현재 Hermes에서 사용할 수 없는 모델입니다. 설정 목록을 다시 확인하세요.",
  reasoning_unsupported: "이 모델은 선택한 추론 강도 설정을 지원하지 않습니다.",
  session_changed: "대화가 변경되었습니다. 해당 대화의 설정을 다시 불러오세요.",
  generation_conflict: "Hermes 실행 설정이 변경되었습니다. 현재 값을 확인한 뒤 다시 선택하세요.",
};

export function errorText(error: unknown): string {
  if (error instanceof BridgeError) return labels[error.code] ?? `요청 실패 (${error.code})`;
  if (error instanceof Error) return "처리에 실패했습니다. 연결과 버전 호환성을 확인하세요.";
  return "확인할 수 없는 오류가 발생했습니다.";
}

export function terminal(value: string): boolean {
  return ["completed", "failed", "cancelled", "expired"].includes(value);
}

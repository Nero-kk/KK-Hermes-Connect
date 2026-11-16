export class BridgeError extends Error {
  constructor(readonly code: string) { super(code); this.name = "BridgeError"; }
}

const labels: Readonly<Record<string, string>> = {
  endpoint_unreachable: "회사 연결에 닿지 못했습니다. Tailscale과 회사 PC 상태를 확인하세요.",
  authentication_required: "이 기기를 등록해 주세요.",
  invalid_pair_code: "등록 코드가 잘못되었거나 만료되었습니다.",
  device_revoked: "기기 인증이 폐기되었습니다. 다시 등록해 주세요.",
  profile_mismatch: "설정한 연이 프로필과 서버 프로필이 다릅니다.",
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
};

export function errorText(error: unknown): string {
  if (error instanceof BridgeError) return labels[error.code] ?? `요청 실패 (${error.code})`;
  if (error instanceof Error) return "처리에 실패했습니다. 연결과 버전 호환성을 확인하세요.";
  return "확인할 수 없는 오류가 발생했습니다.";
}

export function terminal(value: string): boolean {
  return ["completed", "failed", "cancelled", "expired"].includes(value);
}

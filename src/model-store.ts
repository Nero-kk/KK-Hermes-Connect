import { BridgeError, errorText } from "./errors";
import { modelChange, modelState, modelKey } from "./model-schema";
import type { ModelPick, ModelState } from "./model-schema";
import type { Snapshot } from "./schema";
import type { Transport } from "./transport";

export class ModelStore {
  data: ModelState | null = null;
  loading = false;
  changing = false;
  status = "대화를 선택하면 모델과 추론 강도를 변경할 수 있습니다.";
  private snapshot: Snapshot | null = null;
  private epoch = 0;
  private loads = 0;
  constructor(private readonly transport: Pick<Transport, "rpc">, private readonly emit: () => void) {}
  reset(): void {
    this.epoch++; this.snapshot = null; this.data = null; this.loading = this.changing = false;
    this.status = "연결 후 대화를 선택해 주세요.";
  }
  sync(snapshot: Snapshot): void {
    if (this.snapshot?.logicalSessionId !== snapshot.logicalSessionId) {
      this.epoch++; this.data = null; this.changing = false; this.snapshot = snapshot;
      void this.load(); return;
    }
    this.snapshot = snapshot;
    if (!this.data && !this.loading && !this.changing) { void this.load(); return; }
    if (this.data && !this.loading && !this.changing && snapshot.modelSettings?.model
      && snapshot.revision >= this.data.revision) {
      this.data = { ...this.data, selection: snapshot.modelSettings, revision: snapshot.revision,
        generation: snapshot.generation, running: snapshot.running };
    }
  }
  async load(): Promise<void> {
    const current = this.snapshot;
    if (!current) return;
    const epoch = this.epoch;
    const load = ++this.loads;
    this.loading = true; this.status = "Hermes 모델 목록을 불러오는 중…"; this.emit();
    try {
      const data = modelState.parse(await this.transport.rpc("models.get", { logicalSessionId: current.logicalSessionId }));
      if (epoch !== this.epoch || load !== this.loads) return;
      if (data.logicalSessionId !== current.logicalSessionId) throw new BridgeError("session_changed");
      this.data = data; this.status = "선택하면 이 대화의 Hermes 설정에 바로 적용됩니다.";
    } catch (error) { if (epoch === this.epoch && load === this.loads) this.status = errorText(error); }
    finally { if (epoch === this.epoch && load === this.loads) { this.loading = false; this.emit(); } }
  }
  async change(pick: ModelPick, confirm: (message: string) => boolean): Promise<void> {
    const data = this.data;
    if (!data || this.changing || this.loading) return;
    if (data.running || this.snapshot?.running) { this.status = errorText(new BridgeError("session_busy")); this.emit(); return; }
    const epoch = this.epoch;
    this.changing = true; this.status = "Hermes 설정 적용 중…"; this.emit();
    const common = { logicalSessionId: data.logicalSessionId, requestId: crypto.randomUUID(),
      expectedRevision: data.revision, expectedGeneration: data.generation };
    const method = pick.kind === "model" ? "models.set" : "reasoning.set";
    const params = pick.kind === "model" ? { ...common, model: pick.model, provider: pick.provider }
      : { ...common, effort: pick.effort };
    try {
      let result = modelChange.parse(await this.transport.rpc(method, params));
      if (epoch !== this.epoch) return;
      if (result.status === "confirmation_required") {
        if (!confirm(result.message)) { this.status = "모델 변경을 취소했습니다."; return; }
        result = modelChange.parse(await this.transport.rpc(method, { ...params, confirm: result.confirm }));
      }
      if (epoch !== this.epoch) return;
      switch (result.status) {
        case "confirmation_required": this.status = "서버의 확인 조건이 바뀌었습니다. 다시 선택해 주세요."; break;
        case "applied":
        case "deferred": {
          if (result.settings.logicalSessionId !== data.logicalSessionId) throw new BridgeError("session_changed");
          this.data = result.settings;
          const value = result.settings.selection;
          const matched = pick.kind === "model" ? modelKey(pick) === modelKey(value) : pick.effort === value.reasoning;
          this.status = result.status === "deferred" ? "현재 응답 종료 후 선택한 설정이 적용됩니다."
            : matched ? "Hermes 설정에 적용했습니다." : "서버에서 확인한 실제 설정을 표시합니다.";
          break;
        }
      }
    } catch (error) {
      if (epoch === this.epoch) {
        const message = errorText(error);
        await this.load();
        if (epoch === this.epoch) this.status = message;
      }
    } finally { if (epoch === this.epoch) { this.changing = false; this.emit(); } }
  }
}

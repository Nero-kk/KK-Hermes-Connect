import { errorText } from "./errors";
import { notify } from "./notices";

type ActionButton = { setDisabled(disabled: boolean): unknown };

export async function runButtonAction(control: ActionButton, action: () => Promise<void>): Promise<void> {
  control.setDisabled(true);
  try { await action(); }
  catch (error) { notify(errorText(error)); }
  finally { control.setDisabled(false); }
}

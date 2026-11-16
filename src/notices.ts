import { Notice } from "obsidian";
export function notify(message: string): Notice { return new Notice(message); }

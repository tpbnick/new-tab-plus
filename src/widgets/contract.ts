export interface WidgetSettingsField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'color';
  options?: { value: string; label: string }[];
  default: unknown;
}

export interface WidgetContext {
  instanceId: string;
  getSetting<T>(key: string): T;
  saveSettings(partial: Record<string, unknown>): Promise<void>;
}

export interface WidgetInstance {
  render(): void | Promise<void>;
  refresh?(): void | Promise<void>;
  destroy(): void;
}

export interface WidgetDefinition<TSettings extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  displayName: string;
  description?: string;
  settingsSchema: WidgetSettingsField[];
  defaultSettings: TSettings;
  create(container: HTMLElement, settings: TSettings, ctx: WidgetContext): WidgetInstance;
}

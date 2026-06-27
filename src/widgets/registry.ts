import type { WidgetDefinition } from './contract';

class WidgetRegistry {
  private definitions = new Map<string, WidgetDefinition>();

  register(def: WidgetDefinition): void {
    if (this.definitions.has(def.id)) {
      throw new Error(`Widget "${def.id}" is already registered`);
    }
    this.definitions.set(def.id, def);
  }

  get(id: string): WidgetDefinition | undefined {
    return this.definitions.get(id);
  }

  list(): WidgetDefinition[] {
    return [...this.definitions.values()];
  }
}

export const widgetRegistry = new WidgetRegistry();

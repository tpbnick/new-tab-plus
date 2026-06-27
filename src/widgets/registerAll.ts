import { widgetRegistry } from './registry';
import { weatherWidgetDefinition } from './weather/WeatherWidget';
import { clockWidgetDefinition } from './clock/ClockWidget';

let registered = false;

export function registerBuiltinWidgets(): void {
  if (registered) return;
  registered = true;
  widgetRegistry.register(weatherWidgetDefinition);
  widgetRegistry.register(clockWidgetDefinition);
}

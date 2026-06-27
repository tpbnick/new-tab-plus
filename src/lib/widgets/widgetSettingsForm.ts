import type { WidgetSettingsField } from '../../widgets/contract';
import {
  createCheckboxInput,
  createColorInput,
  createNumberInput,
  createOptionsRow,
  createSelectInput,
  createTextInput,
} from '../ui/formControls';

export function appendWidgetSettingsForm(
  container: HTMLElement,
  fields: WidgetSettingsField[],
  settings: Record<string, unknown>,
  onSave: (partial: Record<string, unknown>) => void
): void {
  const form = document.createElement('div');
  form.className = 'widget-settings-form';

  for (const field of fields) {
    const currentValue = settings[field.key] ?? field.default;
    let input: HTMLElement;

    if (field.type === 'boolean') {
      input = createCheckboxInput(Boolean(currentValue), (value) => onSave({ [field.key]: value }));
    } else if (field.type === 'select') {
      input = createSelectInput(
        String(currentValue ?? ''),
        field.options ?? [],
        (value) => onSave({ [field.key]: value })
      );
    } else if (field.type === 'number') {
      input = createNumberInput(Number(currentValue ?? 0), (value) => onSave({ [field.key]: value }), {
        event: 'change',
      });
    } else if (field.type === 'color') {
      input = createColorInput(
        typeof currentValue === 'string' ? currentValue : '#000000',
        (value) => onSave({ [field.key]: value })
      );
    } else {
      input = createTextInput(
        typeof currentValue === 'string' ? currentValue : '',
        (value) => onSave({ [field.key]: value }),
        'change'
      );
    }

    form.appendChild(createOptionsRow(field.label, input));
  }

  container.appendChild(form);
}

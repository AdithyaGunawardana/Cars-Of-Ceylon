import {
  ATTRIBUTE_LABELS,
  BODY_TYPES,
  FUEL_TYPES,
  TRANSMISSIONS,
  labelForOption,
  type VehicleAttributes,
} from "@/lib/vehicle-attributes";
import { inputClass } from "@/lib/client-utils";

// Plain inputs (no hooks) so this renders inside both the server-action create page and client edit form.
// Field names are prefixed with `attr_` and parsed by attributesFromFormData.
function SelectField({ name, label, options, value }: { name: string; label: string; options: readonly string[]; value?: string }) {
  return (
    <label className="grid gap-1 text-sm text-[#504442]">
      {label}
      <select name={`attr_${name}`} defaultValue={value ?? ""} className={inputClass}>
        <option value="">Not specified</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labelForOption(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function VehicleAttributeFields({ values = {} }: { values?: VehicleAttributes }) {
  return (
    <fieldset className="grid gap-3 rounded-2xl bg-[#f5f4e8] p-4 ring-1 ring-[#d3c3c0]/70 md:grid-cols-2">
      <legend className="px-2 text-xs uppercase tracking-[0.2em] text-[#725a39]">Specifications (optional)</legend>
      <label className="grid gap-1 text-sm text-[#504442]">
        {ATTRIBUTE_LABELS.color}
        <input name="attr_color" maxLength={40} defaultValue={values.color ?? ""} placeholder="e.g. Pearl white" className={inputClass} />
      </label>
      <SelectField name="fuelType" label={ATTRIBUTE_LABELS.fuelType} options={FUEL_TYPES} value={values.fuelType} />
      <SelectField name="transmission" label={ATTRIBUTE_LABELS.transmission} options={TRANSMISSIONS} value={values.transmission} />
      <SelectField name="bodyType" label={ATTRIBUTE_LABELS.bodyType} options={BODY_TYPES} value={values.bodyType} />
      <label className="grid gap-1 text-sm text-[#504442]">
        {ATTRIBUTE_LABELS.engineCc}
        <input name="attr_engineCc" type="number" min={1} max={20000} defaultValue={values.engineCc ?? ""} className={inputClass} />
      </label>
      <label className="grid gap-1 text-sm text-[#504442]">
        {ATTRIBUTE_LABELS.odometerKm}
        <input name="attr_odometerKm" type="number" min={0} max={5000000} defaultValue={values.odometerKm ?? ""} className={inputClass} />
      </label>
    </fieldset>
  );
}

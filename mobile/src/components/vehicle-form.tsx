import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { VehicleInput } from "@/lib/api";
import { buildVehicleInput, type VehicleFormFields } from "@/lib/vehicle-form";
import { palette, styles } from "@/lib/theme";
import { BODY_TYPES, FUEL_TYPES, TRANSMISSIONS } from "@/lib/types";
import { ChoiceRow, Notice, PrimaryButton } from "@/components/ui";

type Props = {
  initial: VehicleFormFields;
  submitLabel: string;
  onSubmit: (input: VehicleInput) => Promise<void>;
};

// Shared by "Add vehicle" and "Edit vehicle": identity fields plus the structured attributes the web form has.
export function VehicleForm({ initial, submitLabel, onSubmit }: Props) {
  const [fields, setFields] = useState<VehicleFormFields>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof VehicleFormFields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));

  async function submit() {
    const built = buildVehicleInput(fields);
    if (!built.ok) {
      setError(built.error);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await onSubmit(built.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  const input = (key: keyof VehicleFormFields, placeholder: string, extra: object = {}) => (
    <TextInput
      value={fields[key]}
      onChangeText={set(key)}
      placeholder={placeholder}
      placeholderTextColor={palette.muted}
      style={styles.input}
      accessibilityLabel={placeholder}
      {...extra}
    />
  );

  return (
    <View style={{ gap: 12 }}>
      {input("uniqueIdentifier", "Unique ID (e.g. chassis or registry number)", { autoCapitalize: "characters" })}
      {input("licensePlate", "License plate (optional)", { autoCapitalize: "characters" })}
      {input("manufacturer", "Manufacturer")}
      {input("model", "Model")}
      {input("year", "Year", { keyboardType: "number-pad" })}
      <TextInput
        value={fields.description}
        onChangeText={set("description")}
        placeholder="Description (optional)"
        placeholderTextColor={palette.muted}
        style={[styles.input, styles.textArea]}
        multiline
      />

      <Text style={styles.sectionTitle}>Details</Text>
      {input("color", "Colour")}
      <Text style={styles.sectionMeta}>Fuel</Text>
      <ChoiceRow options={FUEL_TYPES} value={fields.fuelType} onChange={set("fuelType")} clearable />
      <Text style={styles.sectionMeta}>Transmission</Text>
      <ChoiceRow options={TRANSMISSIONS} value={fields.transmission} onChange={set("transmission")} clearable />
      <Text style={styles.sectionMeta}>Body type</Text>
      <ChoiceRow options={BODY_TYPES} value={fields.bodyType} onChange={set("bodyType")} clearable />
      {input("engineCc", "Engine size (cc)", { keyboardType: "number-pad" })}
      {input("odometerKm", "Odometer (km)", { keyboardType: "number-pad" })}

      <Notice text={error} tone="error" />
      <PrimaryButton label={saving ? "Saving..." : submitLabel} onPress={submit} disabled={saving} />
    </View>
  );
}

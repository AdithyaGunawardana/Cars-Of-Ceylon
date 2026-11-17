import { Pressable, Text, View } from "react-native";
import { labelForOption } from "@/lib/format";
import { palette, styles } from "@/lib/theme";

// Pill toggle used for segmented choices (sign in/register, visibility, status filters).
export function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active ? styles.tabButtonActive : null]} accessibilityState={{ selected: active }}>
      <Text style={[styles.tabButtonText, active ? styles.tabButtonTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

// Single choice from a list of enum values; tapping the selected value clears it when `clearable`.
export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  clearable = false,
}: {
  options: readonly T[];
  value: string;
  onChange: (next: T | "") => void;
  clearable?: boolean;
}) {
  return (
    <View style={styles.modeRow}>
      {options.map((option) => (
        <TabButton
          key={option}
          active={value === option}
          label={labelForOption(option)}
          onPress={() => onChange(clearable && value === option ? "" : option)}
        />
      ))}
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled ? styles.buttonDisabled : null]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.secondaryButton, disabled ? styles.buttonDisabled : null]}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function DangerButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.dangerButton, disabled ? styles.buttonDisabled : null]}>
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ text, tone = "info" }: { text: string | null; tone?: "info" | "error" }) {
  if (!text) return null;
  return <Text style={tone === "error" ? styles.errorText : { color: palette.success, fontWeight: "700" }}>{text}</Text>;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

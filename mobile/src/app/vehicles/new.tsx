import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { createVehicle } from "@/lib/api";
import { emptyVehicleFields } from "@/lib/vehicle-form";
import { styles } from "@/lib/theme";
import { VehicleForm } from "@/components/vehicle-form";

export default function NewVehicleScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.screenCard}>
        <Text style={styles.kicker}>New record</Text>
        <Text style={styles.sectionTitle}>Add a vehicle</Text>
        <VehicleForm
          initial={emptyVehicleFields}
          submitLabel="Create vehicle"
          onSubmit={async (input) => {
            const { vehicle } = await createVehicle(input);
            // Replace so Back from the new record returns to the list, not this form.
            router.replace({ pathname: "/vehicles/[id]", params: { id: vehicle.id } });
          }}
        />
      </View>
    </ScrollView>
  );
}

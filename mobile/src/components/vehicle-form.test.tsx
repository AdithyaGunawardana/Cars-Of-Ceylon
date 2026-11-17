import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { emptyVehicleFields } from "@/lib/vehicle-form";
import { VehicleForm } from "./vehicle-form";

async function fill(label: string, value: string) {
  await fireEvent.changeText(screen.getByLabelText(label), value);
}

describe("VehicleForm", () => {
  it("submits a validated payload including attribute choices", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<VehicleForm initial={emptyVehicleFields} submitLabel="Create vehicle" onSubmit={onSubmit} />);

    await fill("Unique ID (e.g. chassis or registry number)", "CHS-1001");
    await fill("Manufacturer", "Austin");
    await fill("Model", "A40");
    await fill("Year", "1960");
    await fireEvent.press(screen.getByText("Petrol"));
    await fireEvent.press(screen.getByText("Manual"));
    await fireEvent.press(screen.getByText("Create vehicle"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      uniqueIdentifier: "CHS-1001",
      licensePlate: null,
      manufacturer: "Austin",
      model: "A40",
      year: 1960,
      description: null,
      attributes: { fuelType: "PETROL", transmission: "MANUAL" },
    });
  });

  it("lets a selected choice be cleared by tapping it again", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(
      <VehicleForm initial={{ ...emptyVehicleFields, uniqueIdentifier: "CHS-1", manufacturer: "Austin", model: "A40", year: "1960", fuelType: "DIESEL" }} submitLabel="Save" onSubmit={onSubmit} />,
    );
    await fireEvent.press(screen.getByText("Diesel"));
    await fireEvent.press(screen.getByText("Save"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]![0].attributes).toBeNull();
  });

  it("shows validation problems instead of calling the API", async () => {
    const onSubmit = jest.fn();
    await render(<VehicleForm initial={emptyVehicleFields} submitLabel="Create vehicle" onSubmit={onSubmit} />);
    await fireEvent.press(screen.getByText("Create vehicle"));
    expect(await screen.findByText(/Unique ID must be at least 2/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the server's error when saving fails", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("Unique identifier already exists"));
    await render(
      <VehicleForm initial={{ ...emptyVehicleFields, uniqueIdentifier: "CHS-1", manufacturer: "Austin", model: "A40", year: "1960" }} submitLabel="Save" onSubmit={onSubmit} />,
    );
    await fireEvent.press(screen.getByText("Save"));
    expect(await screen.findByText("Unique identifier already exists")).toBeTruthy();
  });
});

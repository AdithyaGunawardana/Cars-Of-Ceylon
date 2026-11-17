import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import SignInScreen from "@/app/sign-in";

const mockSignIn = jest.fn();
const mockRegister = jest.fn();
jest.mock("@/lib/session-context", () => ({
  useSession: () => ({ signIn: mockSignIn, register: mockRegister, signOut: jest.fn(), session: null, loading: false }),
}));
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  return { Link: ({ children }: { children: string }) => <Text>{children}</Text> };
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View };
});

beforeEach(() => {
  mockSignIn.mockReset();
  mockRegister.mockReset();
});

describe("SignInScreen", () => {
  it("signs in with trimmed email and the typed password", async () => {
    mockSignIn.mockResolvedValue(undefined);
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "  nimal@example.com ");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (8+ characters)"), "secret-pass");
    await fireEvent.press(screen.getAllByText("Sign In").at(-1)!);
    await waitFor(() => expect(mockSignIn).toHaveBeenCalledWith("nimal@example.com", "secret-pass"));
  });

  it("shows the server's message when sign-in fails", async () => {
    mockSignIn.mockRejectedValue(new Error("Invalid email or password"));
    await render(<SignInScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "a@b.co");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (8+ characters)"), "wrong-pass");
    await fireEvent.press(screen.getAllByText("Sign In").at(-1)!);
    expect(await screen.findByText("Invalid email or password")).toBeTruthy();
  });

  it("does not call the server with empty fields", async () => {
    await render(<SignInScreen />);
    await fireEvent.press(screen.getAllByText("Sign In").at(-1)!);
    expect(await screen.findByText("Enter your email and password.")).toBeTruthy();
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("requires a name when registering and then registers", async () => {
    mockRegister.mockResolvedValue(undefined);
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByText("Register"));
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "new@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (8+ characters)"), "secret-pass");
    await fireEvent.press(screen.getByText("Create Account"));
    expect(await screen.findByText(/Enter your name/)).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Name"), "Nimal Perera");
    await fireEvent.press(screen.getByText("Create Account"));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith("Nimal Perera", "new@example.com", "secret-pass"));
  });
});

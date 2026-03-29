// Temporary editor/type shims for scaffold stage until full Expo dependencies are installed everywhere.
declare module "react" {
	export function useState<T>(initialValue: T): [T, (value: T) => void];
	export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
}

declare module "react/jsx-runtime" {
	export const Fragment: unknown;
	export function jsx(type: unknown, props: unknown, key?: unknown): unknown;
	export function jsxs(type: unknown, props: unknown, key?: unknown): unknown;
}

declare module "react-native";
declare module "expo-status-bar";
declare module "expo-secure-store";

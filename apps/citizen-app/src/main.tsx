import { diagnostics } from "../../../packages/diagnostics/src";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../../shared/theme.css";
createRoot(document.getElementById("root")!).render(<App />);

void diagnostics.record("APP_START", "app", "initialize", {
	result: "success",
});
window.addEventListener("error", () => {
	void diagnostics.record("APP_FAILURE", "app", "initialize");
});
window.addEventListener("unhandledrejection", () => {
	void diagnostics.record("APP_FAILURE", "app", "initialize");
});
window.addEventListener("offline", () => {
	void diagnostics.record("NETWORK_OFFLINE", "app", "connect", {
		result: "pending",
		recovery: "queued",
	});
});
window.addEventListener("online", () => {
	void diagnostics.record("NETWORK_ONLINE", "app", "connect", {
		result: "recovered",
	});
});
window.addEventListener("storage-blocked", () => {
	void diagnostics.record("STORAGE_FAILED", "storage", "save");
});

import { diagnostics } from "../../../packages/diagnostics/src";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./Dashboard";
import "../../shared/theme.css";
createRoot(document.getElementById("root")!).render(<Dashboard />);

void diagnostics.record("APP_START", "central", "initialize", {
	result: "success",
});
window.addEventListener("error", () => {
	void diagnostics.record("APP_FAILURE", "central", "initialize");
});
window.addEventListener("unhandledrejection", () => {
	void diagnostics.record("APP_FAILURE", "central", "initialize");
});
window.addEventListener("offline", () => {
	void diagnostics.record("NETWORK_OFFLINE", "central", "connect", {
		result: "pending",
		recovery: "queued",
	});
});
window.addEventListener("online", () => {
	void diagnostics.record("NETWORK_ONLINE", "central", "connect", {
		result: "recovered",
	});
});
window.addEventListener("storage-blocked", () => {
	void diagnostics.record("STORAGE_FAILED", "storage", "save");
});

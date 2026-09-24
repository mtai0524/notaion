// Backend + web URLs. Override at build time with VITE_API_URL / VITE_WEB_URL.
export const API_URL = import.meta.env.VITE_API_URL || "https://notaion.runasp.net";
export const WEB_URL = import.meta.env.VITE_WEB_URL || "https://notaion.onrender.com";

export const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

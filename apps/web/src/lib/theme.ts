export const THEME_KEY = "direconnect-theme";

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme: a saved choice
 * wins, otherwise the OS setting. A string because the root layout inlines it.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}`;

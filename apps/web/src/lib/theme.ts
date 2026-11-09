export const THEME_KEY = "direconnect-theme";
export const SIDEBAR_KEY = "dc.sidebar";

/**
 * Runs in <head> before first paint so nothing flashes: the saved theme (otherwise the OS
 * setting), and whether the sidebar is collapsed, so the loading skeleton matches the real shell.
 * A string because the root layout inlines it.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){document.documentElement.dataset.theme="light"}`;

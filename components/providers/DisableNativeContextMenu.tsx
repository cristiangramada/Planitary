"use client";

import { useEffect } from "react";

/**
 * Suppresses the browser's native right-click menu across the app.
 * Custom app menus (e.g. calendar day menu) still work — they call
 * preventDefault themselves and render their own UI.
 */
export function DisableNativeContextMenu() {
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, []);

  return null;
}

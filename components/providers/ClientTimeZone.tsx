"use client";

import { useEffect } from "react";
import { CLIENT_TIME_ZONE_COOKIE } from "@/lib/time-zone";

/**
 * Makes the browser's IANA time zone available on subsequent server
 * navigations. This is a non-sensitive preference, so a first-party cookie is
 * sufficient and lets the Dashboard fetch the correct local day before it
 * hydrates.
 */
export function ClientTimeZone() {
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone) return;

    const encodedTimeZone = encodeURIComponent(timeZone);
    const current = document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${CLIENT_TIME_ZONE_COOKIE}=`))
      ?.split("=")[1];

    if (current === encodedTimeZone) return;

    document.cookie = `${CLIENT_TIME_ZONE_COOKIE}=${encodedTimeZone}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  return null;
}

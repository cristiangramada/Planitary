/** Canonical public origin, without a trailing slash for safe path concatenation. */
export const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);

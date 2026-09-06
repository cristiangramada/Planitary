import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoadingShell } from "@/components/layout/PageLoadingShell";
import { SearchClient } from "./SearchClient";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    // Suspense required because SearchClient uses useSearchParams (search
    // state — query, filters, sort — is synchronized to the URL).
    <Suspense fallback={<PageLoadingShell variant="search" />}>
      <SearchClient />
    </Suspense>
  );
}

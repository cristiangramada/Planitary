"use client";

export function ScrollDownArrow() {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = document.getElementById("features");
    if (!el) return;
    e.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  return (
    <a
      href="#features"
      onClick={handleClick}
      aria-label="Scroll to features"
      className="scroll-cue relative mx-auto mt-10 sm:mt-12 flex h-10 w-10 items-center justify-center rounded-full text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </a>
  );
}

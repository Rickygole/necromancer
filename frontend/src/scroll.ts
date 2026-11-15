export function scrollBehavior(): ScrollBehavior {
  if (typeof document === "undefined") return "auto";
  return document.documentElement.dataset.motion === "on" ? "smooth" : "auto";
}

export function headerBottom(): number {
  const head = document.querySelector<HTMLElement>(".site-head");
  if (!head) return 0;
  const position = window.getComputedStyle(head).position;
  if (position !== "sticky" && position !== "fixed") return 0;
  return Math.max(0, head.getBoundingClientRect().bottom);
}

export function heroInView(): boolean {
  const hero = document.getElementById("circle");
  if (!hero) return true;
  const top = headerBottom();
  const box = hero.getBoundingClientRect();
  if (box.top < top - 1) return false;
  if (box.bottom <= window.innerHeight + 1) return true;
  return box.top <= top + 64;
}

export function revealHero() {
  if (heroInView()) return;
  document.getElementById("circle")?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
}

export function bringIntoView(target: Element | null) {
  target?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
}

export function trackHeaderHeight(head: HTMLElement): () => void {
  const root = document.documentElement;
  const measure = () => {
    const position = window.getComputedStyle(head).position;
    const sticky = position === "sticky" || position === "fixed";
    root.style.setProperty("--head-h", sticky ? `${Math.ceil(head.getBoundingClientRect().height)}px` : "0px");
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(head);
  window.addEventListener("resize", measure);
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", measure);
  };
}

export function watchUserScroll(onScroll: () => void): () => void {
  const keys = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
  const onKey = (event: KeyboardEvent) => {
    if (!keys.has(event.key)) return;
    const target = event.target as HTMLElement | null;
    if (target && target.closest("input, textarea, select, [contenteditable], button, summary, a")) return;
    onScroll();
  };
  const onPointer = (event: PointerEvent) => {
    if (event.target === document.documentElement) onScroll();
  };
  window.addEventListener("wheel", onScroll, { passive: true });
  window.addEventListener("touchmove", onScroll, { passive: true });
  window.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", onPointer);
  return () => {
    window.removeEventListener("wheel", onScroll);
    window.removeEventListener("touchmove", onScroll);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("pointerdown", onPointer);
  };
}

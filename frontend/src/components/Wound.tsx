import { useLayoutEffect, useRef } from "react";

const DRIPS: Array<[number, number]> = [
  [0, 0.12],
  [3, 0.2],
  [5, 0.86],
  [6, 0.78],
  [10, 0.22],
];

const CRACKS: Array<[number, string, string]> = [
  [5, "M52 0 L44 16 L58 30 L38 46 L54 62 L36 80 L48 100", "M38 46 L18 54 L6 50 M54 62 L76 70 L86 82"],
  [8, "M60 4 L52 22 L66 40 L50 62 L60 84", "M66 40 L84 46"],
];

export function Wound() {
  const probe = useRef<HTMLSpanElement>(null);
  const wound = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const base = probe.current;
    const host = wound.current;
    const word = base?.parentElement;
    const text = word?.firstChild;
    if (!base || !host || !word || !text || text.nodeType !== Node.TEXT_NODE) return;
    const drips = Array.from(host.querySelectorAll<HTMLElement>(".drip"));
    const cracks = Array.from(host.querySelectorAll<SVGSVGElement>(".wound__crack"));
    const length = text.textContent?.length ?? 0;
    const range = document.createRange();
    const charBox = (index: number) => {
      range.setStart(text, index);
      range.setEnd(text, index + 1);
      return range.getBoundingClientRect();
    };
    const place = () => {
      const box = word.getBoundingClientRect();
      const em = parseFloat(window.getComputedStyle(word).fontSize) || 16;
      const baseline = base.getBoundingClientRect().top - box.top;
      DRIPS.forEach(([index, along], i) => {
        const drip = drips[i];
        if (!drip || index >= length) return;
        const r = charBox(index);
        drip.style.left = `${(r.left - box.left + r.width * along).toFixed(1)}px`;
        drip.style.top = `${baseline.toFixed(1)}px`;
      });
      CRACKS.forEach(([index], i) => {
        const crack = cracks[i];
        if (!crack || index >= length) return;
        const r = charBox(index);
        crack.style.left = `${(r.left - box.left).toFixed(1)}px`;
        crack.style.width = `${r.width.toFixed(1)}px`;
        crack.style.top = `${(baseline - em * 0.47).toFixed(1)}px`;
        crack.style.height = `${(em * 0.48).toFixed(1)}px`;
      });
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(word);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <span ref={probe} className="wound__probe" aria-hidden="true" />
      <span ref={wound} className="wound" aria-hidden="true">
        {CRACKS.map(([index, main, branch]) => (
          <svg key={index} className="wound__crack" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
            <path className="wound__split" d={main} />
            <path className="wound__split wound__split--thin" d={branch} />
            <path className="wound__blood" d={main} />
          </svg>
        ))}
        {DRIPS.map(([index]) => (
          <span key={index} className="drip">
            <span className="drip__drop" />
          </span>
        ))}
      </span>
    </>
  );
}

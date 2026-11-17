import { useEffect, useState, type ComponentType } from "react";
import { CARDDEMO_README_URL } from "../content";

type Load = { phase: "loading" } | { phase: "error" } | { phase: "ready"; View: ComponentType };

export function CaseStudySlot() {
  const [load, setLoad] = useState<Load>({ phase: "loading" });

  useEffect(() => {
    let live = true;
    import("./CaseStudy")
      .then((mod) => live && setLoad({ phase: "ready", View: mod.CaseStudy }))
      .catch(() => live && setLoad({ phase: "error" }));
    return () => {
      live = false;
    };
  }, []);

  if (load.phase === "ready") return <load.View />;

  return (
    <section id="carddemo" className="carddemo" aria-labelledby="carddemo-title" aria-busy={load.phase === "loading"}>
      <div className="carddemo__intro">
        <p className="eyebrow mono">second case study, code we did not write</p>
        <h2 id="carddemo-title" className="section-title">
          a program we did not write
        </h2>
        {load.phase === "error" ? (
          <p role="alert">
            This part of the page did not load. Reload to try again, or read the{" "}
            <a href={CARDDEMO_README_URL}>case study README</a> on GitHub.
          </p>
        ) : (
          <p>Loading the CardDemo case study.</p>
        )}
      </div>
    </section>
  );
}

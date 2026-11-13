import { Crack } from "../components/Doodles";

export function NotFound() {
  return (
    <article className="page missing">
      <Crack className="missing__crack" />
      <p className="eyebrow mono">404, plot unmarked</p>
      <h1 tabIndex={-1}>nothing buried here</h1>
      <p className="missing__text">
        We dug. There is no page at this address, just dirt and one confused worm. Try the{" "}
        <a href="#/">front gate</a> or go straight to the <a href="#/console">console</a>.
      </p>
    </article>
  );
}

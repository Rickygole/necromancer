import { useEffect, useState } from "react";

export function useText(url: string) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`The server answered ${response.status}.`);
        const body = await response.text();
        if (body.trimStart().startsWith("<!doctype") || body.trimStart().startsWith("<!DOCTYPE")) {
          throw new Error("The file was not found.");
        }
        if (live) setText(body);
      })
      .catch((err: unknown) => {
        if (live) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      live = false;
    };
  }, [url]);
  return { text, error };
}

import { useEffect, useState } from "react";

export function useSearchParamsWouter() {
  const [search, setSearch] = useState(window.location.search);

  useEffect(() => {
    const update = () => setSearch(window.location.search);

    // Monkey-patch pushState/replaceState to catch SPA navigations
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    (history as any).pushState = function(data: any, unused: string, url?: string | URL | null) {
      origPush.call(this, data, unused, url); update();
    };
    (history as any).replaceState = function(data: any, unused: string, url?: string | URL | null) {
      origReplace.call(this, data, unused, url); update();
    };

    window.addEventListener("popstate", update);
    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", update);
    };
  }, []);

  return new URLSearchParams(search);
}
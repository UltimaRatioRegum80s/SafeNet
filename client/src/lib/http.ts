export class HttpError extends Error { 
  constructor(public status: number, public body?: string) {
    super(`HTTP ${status}`);
  } 
}

export async function postJSON<T>(url: string, data: any): Promise<T> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new HttpError(res.status, await res.text().catch(()=>undefined));
    return (await res.json()) as T;
  } catch (err: any) {
    const offline = !navigator.onLine;
    const network = err instanceof TypeError; // CORS/DNS/TLS/SW fetch fail
    const reason =
      offline ? "offline" :
      network ? "network" :
      err instanceof HttpError ? `http${err.status}` : "unknown";
    console.warn("[NN] POST failed:", reason, err?.body ?? err?.message ?? err);

    // DISABLED: offline queue and banner system per GPT instructions
    // only queue on network/5xx; don't claim "offline" for 4xx validation
    if (false && (reason === "network" || (err instanceof HttpError && err.status >= 500))) {
      (window as any).__nnQueue?.enqueue?.(url, data, "POST");
      (window as any).__nnBanner?.show?.("Queued (network/server)");
    } else if (false && err instanceof HttpError && err.status < 500) {
      (window as any).__nnBanner?.show?.(`Not saved (server ${err.status})`);
    }
    throw err;
  }
}
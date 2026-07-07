import * as React from "react";
import { useIncidentComments, useAddComment } from "@/features/incidents/api";
import { MessageSquare, Send } from "lucide-react";

export function IncidentComments({ incidentId, open }: { incidentId: string; open: boolean }) {
  const { data: comments = [], isLoading } = useIncidentComments(incidentId, open);
  const add = useAddComment(incidentId);
  const [text, setText] = React.useState("");
  const commentsEndRef = React.useRef<HTMLDivElement>(null);
  const commentsContainerRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to latest comment when comments change
  React.useEffect(() => {
    if (comments.length > 0 && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [comments.length]);

  if (!open) return null;

  return (
    <div
      className="mt-3 rounded-xl border border-white/10 bg-zinc-900/50 p-3"
      onClick={(e) => e.stopPropagation()} // prevent closing card while typing
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
        <MessageSquare className="h-4 w-4" />
        <span>Comments</span>
      </div>

      <div ref={commentsContainerRef} className="max-h-56 space-y-3 overflow-y-auto pr-1">
        {isLoading && <div className="text-sm text-zinc-500">Loading…</div>}
        {!isLoading && comments.length === 0 && (
          <div className="text-sm text-zinc-500">Be the first to comment.</div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg bg-zinc-800/60 p-2 text-sm">
            <div className="text-zinc-200">{c.body}</div>
            <div className="mt-1 text-[11px] text-zinc-500">
              {new Date(c.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
        <div ref={commentsEndRef} />
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const val = text.trim();
          if (!val) return;
          add.mutate(val, { onSuccess: () => setText("") });
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="flex-1 rounded-lg border border-white/10 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-white/20"
          onFocus={() => window.dispatchEvent(new Event("nn:comment:focus"))}
          onBlur={() => window.dispatchEvent(new Event("nn:comment:blur"))}
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  );
}
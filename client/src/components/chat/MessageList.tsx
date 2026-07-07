import { useEffect, useRef } from "react";
import MessageItem, { UIMessage } from "./MessageItem";

export default function MessageList({
  messages,
  meId,
}: {
  messages: UIMessage[];
  meId: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {messages.map((m) => (
        <MessageItem key={m.id} m={m} meId={meId} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
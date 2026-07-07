import React from "react";
import clsx from "clsx";

type Props = {
  text: string;
  isUser?: boolean;
  timestamp?: string | Date;
};

export default function ChatBubble({ text, isUser, timestamp }: Props) {
  const time =
    typeof timestamp === "string"
      ? timestamp
      : timestamp
      ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : undefined;

  return (
    <div className={clsx("flex w-full mb-2", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-md",
          "whitespace-pre-wrap break-words transition-colors",
          // Old style: comfy padding + distinct colors
          isUser
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-zinc-800 text-zinc-100 rounded-bl-none"
        )}
      >
        <p>{text}</p>
        {time && (
          <p className="text-[10px] opacity-70 mt-1 text-right">
            {time}
          </p>
        )}
      </div>
    </div>
  );
}
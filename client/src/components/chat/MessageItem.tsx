import ChatBubble from "./ChatBubble";

export type UIMessage = {
  id: string;
  text: string;
  userId: string;
  createdAt?: string | Date;
};

export default function MessageItem({ m, meId }: { m: UIMessage; meId: string | null }) {
  const isUser = !!meId && m.userId === meId;
  return (
    <ChatBubble text={m.text} isUser={isUser} timestamp={m.createdAt} />
  );
}
import { useEffect, useRef } from 'react';
import type { ServerMessage } from '../types';
import MessageItem from './MessageItem';

interface Props {
  messages: ServerMessage[];
  ownCallsign: string;
}

export default function MessageList({ messages, ownCallsign }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="msg-area" role="log" aria-live="polite" aria-label="Chat messages">
      {messages.map((msg, i) => (
        <MessageItem key={i} message={msg} ownCallsign={ownCallsign} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

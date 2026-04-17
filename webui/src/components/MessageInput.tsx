import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface Props {
  onSend: (text: string) => boolean;
  disabled: boolean;
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    const sent = onSend(trimmed);
    if (sent) setText('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="chat-bottom" onSubmit={handleSubmit}>
      <textarea
        className="chat-input"
        placeholder="Type a message…"
        maxLength={1000}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-label="Message input"
      />
      <button
        className="send-btn"
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label="Send message"
      >
        <Send size={20} className="send-btn-icon" aria-hidden="true" />
        <span className="send-btn-text">Send</span>
      </button>
    </form>
  );
}

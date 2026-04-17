import { MessageCircle } from 'lucide-react';
import type { ServerMessage, ConnectionStatus } from '../types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import StatusIndicator from './StatusIndicator';

interface Props {
  callsign: string;
  messages: ServerMessage[];
  connectionStatus: ConnectionStatus;
  maxAttemptsReached: boolean;
  onSend: (text: string) => boolean;
  onManualReconnect: () => void;
}

export default function ChatScreen({
  callsign,
  messages,
  connectionStatus,
  maxAttemptsReached,
  onSend,
  onManualReconnect,
}: Props) {
  const inputDisabled = connectionStatus !== 'connected';

  return (
    <div className="chat-screen">
      <div className="chat-wrap">
        <header className="chat-header">
          <div className="chat-header-left">
            <MessageCircle
              size={22}
              strokeWidth={1.5}
              className="chat-header-icon"
              aria-hidden="true"
            />
            <span className="chat-header-title">Anonymous Chat</span>
          </div>
          <StatusIndicator status={connectionStatus} />
        </header>

        {maxAttemptsReached && (
          <div className="conn-lost-banner" role="alert">
            <span>Connection lost.</span>
            <button className="conn-lost-btn" onClick={onManualReconnect}>
              Reconnect
            </button>
          </div>
        )}

        <MessageList messages={messages} ownCallsign={callsign} />

        <MessageInput onSend={onSend} disabled={inputDisabled} />
      </div>
    </div>
  );
}

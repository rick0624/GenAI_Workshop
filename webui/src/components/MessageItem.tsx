import type { ServerMessage } from '../types';

const AVATAR_COLORS = [
  '#DC2626', '#3B82F6', '#7C3AED', '#0891B2', '#16A34A',
  '#D97706', '#DB2777', '#2563EB', '#059669', '#9333EA',
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function avatarColor(callsign: string): string {
  return AVATAR_COLORS[hashStr(callsign) % AVATAR_COLORS.length]!;
}

function initials(callsign: string): string {
  const parts = callsign.split(/[_\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return callsign.substring(0, 2).toUpperCase();
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

interface Props {
  message: ServerMessage;
  ownCallsign: string;
}

export default function MessageItem({ message, ownCallsign }: Props) {
  if (message.type === 'system') {
    const text =
      message.event === 'user_joined'
        ? `${message.callsign} joined the chat`
        : `${message.callsign} left the chat`;
    return (
      <div className="sys-msg">
        <span className="sys-msg-text">{text}</span>
      </div>
    );
  }

  const isOwn = message.callsign === ownCallsign;
  const time = formatTime(message.timestamp);

  if (isOwn) {
    return (
      <div className="msg-own">
        <div className="msg-own-wrap">
          <div className="msg-header-own">
            <span className="msg-time">{time}</span>
            <span className="msg-name">You</span>
          </div>
          <div className="msg-bubble-own">{message.text}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="msg-other">
      <div
        className="msg-avatar"
        style={{ background: avatarColor(message.callsign) }}
        aria-hidden="true"
      >
        {initials(message.callsign)}
      </div>
      <div className="msg-body">
        <div className="msg-header">
          <span className="msg-name">{message.callsign}</span>
          <span className="msg-time">{time}</span>
        </div>
        <div className="msg-bubble-other">{message.text}</div>
      </div>
    </div>
  );
}

import type { ConnectionStatus } from '../types';

const LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  disconnected: 'Disconnected',
};

interface Props {
  status: ConnectionStatus;
}

export default function StatusIndicator({ status }: Props) {
  return (
    <div
      className="status-indicator"
      aria-live="polite"
      aria-label={`Connection status: ${LABELS[status]}`}
    >
      <span className={`status-dot ${status}`} />
      <span className={`status-text ${status}`}>{LABELS[status]}</span>
    </div>
  );
}

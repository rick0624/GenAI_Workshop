import { useEffect, useRef, useCallback } from 'react';
import { WS_ENDPOINT } from '../config';
import type { ServerMessage, ConnectionStatus } from '../types';

interface Options {
  callsign: string;
  enabled: boolean;
  onMessage: (msg: ServerMessage) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  onMaxAttemptsReached: () => void;
}

export function useWebSocket({
  callsign,
  enabled,
  onMessage,
  onStatusChange,
  onMaxAttemptsReached,
}: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Keep callbacks in a ref so closures always use latest values
  const cbRef = useRef({ onMessage, onStatusChange, onMaxAttemptsReached });
  useEffect(() => {
    cbRef.current = { onMessage, onStatusChange, onMaxAttemptsReached };
  });

  useEffect(() => {
    if (!enabled || !callsign) return;

    let active = true;
    attemptsRef.current = 0;

    const doConnect = () => {
      if (!active) return;

      cbRef.current.onStatusChange('connecting');

      const ws = new WebSocket(
        `${WS_ENDPOINT}?callsign=${encodeURIComponent(callsign)}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        attemptsRef.current = 0;
        cbRef.current.onStatusChange('connected');
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          cbRef.current.onMessage(JSON.parse(event.data) as ServerMessage);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        // onclose fires next; nothing to do here
      };

      ws.onclose = () => {
        if (!active) return;
        cbRef.current.onStatusChange('disconnected');

        if (attemptsRef.current >= 5) {
          cbRef.current.onMaxAttemptsReached();
          return;
        }

        const delay = Math.min(
          Math.pow(2, attemptsRef.current) * 2000,
          30000,
        );
        attemptsRef.current++;

        cbRef.current.onStatusChange('reconnecting');
        timerRef.current = setTimeout(doConnect, delay);
      };
    };

    doConnect();

    return () => {
      active = false;
      clearTimeout(timerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, callsign]);

  const sendMessage = useCallback((text: string): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'sendMessage', text }));
      return true;
    }
    return false;
  }, []);

  const manualReconnect = useCallback(() => {
    clearTimeout(timerRef.current);
    attemptsRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  return { sendMessage, manualReconnect };
}

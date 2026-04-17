import { useState, useRef, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import JoinScreen from './components/JoinScreen';
import ChatScreen from './components/ChatScreen';
import type { ServerMessage, ConnectionStatus } from './types';

export default function App() {
  const [screen, setScreen] = useState<'join' | 'chat'>('join');
  const [callsign, setCallsign] = useState('');
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [wsEnabled, setWsEnabled] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);

  // Track whether we've ever successfully connected in this session
  const hasConnectedRef = useRef(false);

  const handleMessage = useCallback((msg: ServerMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleStatusChange = useCallback(
    (status: ConnectionStatus) => {
      setConnectionStatus(status);

      if (status === 'connected') {
        hasConnectedRef.current = true;
        setMaxAttemptsReached(false);
        setScreen('chat');
        setJoinError('');
      }

      // Initial connection failure — stop retrying, show error on join screen
      if (status === 'disconnected' && !hasConnectedRef.current) {
        setWsEnabled(false);
        setJoinError('Could not connect. Please check your network and try again.');
      }
    },
    [],
  );

  const handleMaxAttemptsReached = useCallback(() => {
    setMaxAttemptsReached(true);
  }, []);

  const { sendMessage, manualReconnect } = useWebSocket({
    callsign,
    enabled: wsEnabled,
    onMessage: handleMessage,
    onStatusChange: handleStatusChange,
    onMaxAttemptsReached: handleMaxAttemptsReached,
  });

  const handleJoin = useCallback((cs: string) => {
    hasConnectedRef.current = false;
    setCallsign(cs);
    setMessages([]);
    setJoinError('');
    setMaxAttemptsReached(false);
    setWsEnabled(true);
  }, []);

  const handleManualReconnect = useCallback(() => {
    setMaxAttemptsReached(false);
    manualReconnect();
  }, [manualReconnect]);

  if (screen === 'join') {
    return (
      <JoinScreen
        onJoin={handleJoin}
        error={joinError}
        isConnecting={connectionStatus === 'connecting'}
      />
    );
  }

  return (
    <ChatScreen
      callsign={callsign}
      messages={messages}
      connectionStatus={connectionStatus}
      maxAttemptsReached={maxAttemptsReached}
      onSend={sendMessage}
      onManualReconnect={handleManualReconnect}
    />
  );
}

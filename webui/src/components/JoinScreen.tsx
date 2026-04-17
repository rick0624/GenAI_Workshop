import { useState, type FormEvent } from 'react';
import { MessageCircle, ArrowRight } from 'lucide-react';

interface Props {
  onJoin: (callsign: string) => void;
  error: string;
  isConnecting: boolean;
}

const CALLSIGN_RE = /^[a-zA-Z0-9_]{1,20}$/;

export default function JoinScreen({ onJoin, error, isConnecting }: Props) {
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setValidationError('Please enter a callsign.');
      return;
    }
    if (!CALLSIGN_RE.test(value)) {
      setValidationError('Only letters, numbers, and underscores allowed (max 20 chars).');
      return;
    }
    setValidationError('');
    onJoin(value.trim());
  };

  const displayError = validationError || error;

  return (
    <div className="join-screen">
      <div className="join-card">
        {/* Desktop: bare icon; Mobile: icon in accent box */}
        <div className="join-icon-desktop">
          <MessageCircle size={48} strokeWidth={1.5} />
        </div>
        <div className="join-icon-mobile">
          <MessageCircle size={32} strokeWidth={1.5} />
        </div>

        <div className="join-title-group">
          <h1 className="join-title">Anonymous Chat</h1>
          <p className="join-subtitle">
            Join a global chat room.{'\u00A0'}No account needed.
          </p>
        </div>

        <form className="join-form" onSubmit={handleSubmit}>
          <div className="join-input-group">
            <label htmlFor="callsign-input" className="join-label">
              Choose your callsign
            </label>
            <input
              id="callsign-input"
              className={`join-input${displayError ? ' error' : ''}`}
              type="text"
              placeholder="e.g. CoolDog_42"
              maxLength={20}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isConnecting}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby={displayError ? 'join-error' : 'join-helper'}
              aria-invalid={!!displayError}
            />
            {displayError ? (
              <p id="join-error" className="join-error" role="alert">
                {displayError}
              </p>
            ) : (
              <p id="join-helper" className="join-helper">
                Alphanumeric and underscores only, max 20 chars
              </p>
            )}
          </div>

          <button className="join-btn" type="submit" disabled={isConnecting}>
            <ArrowRight size={18} className="join-btn-icon" />
            <span>{isConnecting ? 'Connecting…' : 'Join Chat'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

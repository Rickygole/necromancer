import { toggleSound, useSound } from "../sound";

export function SoundToggle() {
  const on = useSound();
  return (
    <button
      type="button"
      className={`motion-toggle sound-toggle${on ? "" : " motion-toggle--paused"}`}
      onClick={toggleSound}
    >
      <svg className="sound-toggle__icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
        {on ? (
          <path d="M11 5.5c1 .8 1.5 1.6 1.5 2.5s-.5 1.7-1.5 2.5M12.5 3.5c1.6 1.2 2.5 2.8 2.5 4.5s-.9 3.3-2.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        ) : (
          <path d="M11 6l4 4M15 6l-4 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        )}
      </svg>
      <span className="motion-toggle__text">{on ? "mute sound" : "unmute sound"}</span>
    </button>
  );
}

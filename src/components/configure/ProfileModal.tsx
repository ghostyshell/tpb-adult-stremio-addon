// Account/profile modal, extracted from ConfigureApp.tsx as a
// structure-preserving refactor (no behaviour change). Rendered through a
// portal to document.body. Receives the profile controller from useProfile.
//
// Visual restyle only: inline styles replaced with the .acct-* / .cfrm-*
// classes in globals.css so the modal uses the app's real design tokens
// (--accent, --surface, --danger) instead of dead fallbacks. All props,
// handlers, states, and the signed-in / signed-out flow are unchanged.

import { createPortal } from 'react-dom';
import type { ProfileController } from './useProfile';

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm-7 16.5c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2.5Z" /></svg>
);
const ChevronIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
);

export function ProfileModal(p: ProfileController) {
  if (!p.profileOpen || typeof document === 'undefined') return null;
  return createPortal(
    <div className="acct-overlay" onClick={p.closeAccount}>
      <div role="dialog" aria-modal="true" aria-labelledby="account-modal-title" className="acct-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={p.closeAccount} className="acct-modal-close" aria-label="Close"><CloseIcon /></button>
        <div className="acct-hdr">
          <div className="acct-hdr-icon"><UserIcon /></div>
          <h2 id="account-modal-title" className="acct-title">Account</h2>
        </div>

        {!p.profileId ? (
          <>
            <div className="acct-field">
              <label className="field-label" htmlFor="acct-email">Email</label>
              <input
                id="acct-email"
                type="email"
                value={p.stremioEmail}
                onChange={(e) => p.setStremioEmail(e.target.value)}
                placeholder="your@email.com"
                autoComplete="email"
                autoFocus
                className="field-input"
              />
            </div>
            <div className="acct-field">
              <label className="field-label" htmlFor="acct-pass">Password</label>
              <input
                id="acct-pass"
                type="password"
                value={p.stremioPassword}
                onChange={(e) => p.setStremioPassword(e.target.value)}
                placeholder="Stremio password"
                autoComplete="current-password"
                onKeyDown={(e) => e.key === 'Enter' && p.handleStremioLogin()}
                className="field-input"
              />
            </div>
            <button type="button" onClick={p.handleStremioLogin} disabled={p.loginLoading || !p.stremioEmail.trim() || !p.stremioPassword} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {p.loginLoading && <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
              {p.loginLoading ? 'Signing in...' : 'Sign in with Stremio'}
            </button>
            <p className="acct-note">
              Login calls go directly to Stremio&apos;s API - your password never touches our servers. Your email is used as your profile identifier; configs are AES-256 encrypted. Your session token verifies your identity on each request.{' '}
              <a href="https://www.stremio.com/acc-settings#sessions-settings" target="_blank" rel="noopener noreferrer">Revoke access anytime</a> from your Stremio session settings.
            </p>
          </>
        ) : (
          <>
            <div className="acct-who">
              <span className="acct-who-email" title={p.profileId}>Signed in as {p.profileId}</span>
              <button type="button" onClick={p.signOut} className="acct-link">Sign out</button>
            </div>

            {p.slotsLoading ? (
              <p className="acct-empty">Loading...</p>
            ) : p.profileSlots.length === 0 ? (
              <p className="acct-empty">No saved configurations yet.</p>
            ) : (
              <ul className="acct-slots">
                {p.profileSlots.map(slot => (
                  <li key={slot} className="acct-slot">
                    <button
                      type="button"
                      onClick={() => p.setExpandedSlot(p.expandedSlot === slot ? null : slot)}
                      className="acct-slot-head"
                      aria-expanded={p.expandedSlot === slot}
                    >
                      <span className="acct-slot-name">{slot}</span>
                      <span className={`acct-slot-chev${p.expandedSlot === slot ? ' open' : ''}`}><ChevronIcon /></span>
                    </button>
                    {p.expandedSlot === slot && (
                      <div className="acct-slot-actions">
                        <button type="button" onClick={() => p.handleSlotLoad(slot)} className="acct-slot-load">Load</button>
                        <button type="button" onClick={() => p.handleSlotDelete(slot)} className="acct-slot-del">Delete</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {p.profileStatus && (
          <p className={`acct-status${p.profileStatus.ok ? ' ok' : ' bad'}`} role="status" aria-live="polite">{p.profileStatus.msg}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

// Confirm-overwrite dialog, rendered independently of the account modal since
// the Save button lives in the main form (the modal may be closed when a
// duplicate name is submitted). Shows when pendingOverwriteSlot is set.
export function OverwriteConfirmModal(p: ProfileController) {
  if (!p.pendingOverwriteSlot || typeof document === 'undefined') return null;
  return createPortal(
    <div className="cfrm-overlay" onClick={p.cancelOverwrite}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="cfrm-title" className="cfrm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cfrm-icon"><AlertIcon /></div>
        <h2 id="cfrm-title" className="cfrm-title">Overwrite config?</h2>
        <p className="cfrm-msg">A config named <b>&ldquo;{p.pendingOverwriteSlot}&rdquo;</b> already exists. Overwrite it with your current settings?</p>
        <div className="cfrm-actions">
          <button type="button" onClick={p.cancelOverwrite} className="cfrm-btn cfrm-cancel">Cancel</button>
          <button type="button" onClick={p.confirmOverwrite} disabled={p.savingConfig} className="cfrm-btn cfrm-overwrite">
            {p.savingConfig ? 'Overwriting...' : 'Overwrite'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
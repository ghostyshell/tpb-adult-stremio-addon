// Profile save/load feature extracted from ConfigureApp.tsx as a
// structure-preserving refactor (no behaviour change). Owns its own state,
// effects, and fetch handlers; the parent supplies buildProfile/loadFromProfile
// (which read/write the rest of the form state + uncontrolled-input refs) and
// the namePostfix ref used to derive a slot name.

import { useEffect, useState } from 'react';

const PROFILE_SESSION_KEY = 'tpb_profile_session';

export interface ProfileStatus {
  ok: boolean;
  msg: string;
}

export interface UseProfileArgs {
  buildProfile: () => Record<string, unknown>;
  loadFromProfile: (d: any) => void;
  namePostfixRef: { current: HTMLInputElement | null };
}

export interface ProfileController {
  profileOpen: boolean;
  setProfileOpen: (v: boolean) => void;
  profileId: string;
  stremioEmail: string;
  setStremioEmail: (v: string) => void;
  stremioPassword: string;
  setStremioPassword: (v: string) => void;
  loginLoading: boolean;
  slotsLoading: boolean;
  profileSlots: string[];
  expandedSlot: string | null;
  setExpandedSlot: (v: string | null) => void;
  profileStatus: ProfileStatus | null;
  setProfileStatus: (v: ProfileStatus | null) => void;
  saveStatus: ProfileStatus | null;
  savingConfig: boolean;
  openAccount: () => void;
  closeAccount: () => void;
  signOut: () => void;
  handleStremioLogin: () => Promise<void>;
  handleSlotSave: (overwrite?: boolean) => Promise<void>;
  handleSlotLoad: (slotName: string) => Promise<void>;
  handleSlotDelete: (slotName: string) => Promise<void>;
  pendingOverwriteSlot: string | null;
  confirmOverwrite: () => void;
  cancelOverwrite: () => void;
}

export function useProfile({ buildProfile, loadFromProfile, namePostfixRef }: UseProfileArgs): ProfileController {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileId, setProfileId] = useState('');       // email, set after Stremio login
  const [profileAuthKey, setProfileAuthKey] = useState(''); // session token for verification
  const [stremioEmail, setStremioEmail] = useState('');
  const [stremioPassword, setStremioPassword] = useState('');
  const [profileSlots, setProfileSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ProfileStatus | null>(null);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [pendingOverwriteSlot, setPendingOverwriteSlot] = useState<string | null>(null);

  async function fetchSlots(email: string, authKey: string) {
    setSlotsLoading(true);
    const res = await fetch('/api/profile/slots/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, authKey }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setProfileSlots([]);
      setProfileStatus({ ok: false, msg: json.error || 'Could not load saved configs.' });
    } else {
      setProfileSlots(json.slots || []);
      setProfileStatus(null);
    }
    setSlotsLoading(false);
  }

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PROFILE_SESSION_KEY);
      if (!raw) return;
      const { email, authKey } = JSON.parse(raw) as { email?: string; authKey?: string };
      if (!email || !authKey) return;
      setProfileId(email);
      setProfileAuthKey(authKey);
      void fetchSlots(email, authKey);
    } catch { /* ignore corrupt session */ }
  // ponytail: mount-only session restore
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [profileOpen]);

  async function handleStremioLogin() {
    setProfileStatus(null);
    setLoginLoading(true);
    try {
      const res = await fetch('/api/profile/stremio-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: stremioEmail, password: stremioPassword }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setProfileStatus({ ok: false, msg: json.error || 'Login failed.' }); return; }
      const email = json.email || stremioEmail;
      setProfileId(email);
      setProfileAuthKey(json.authKey);
      sessionStorage.setItem(PROFILE_SESSION_KEY, JSON.stringify({ email, authKey: json.authKey }));
      setStremioPassword('');
      setProfileStatus(null);
      await fetchSlots(email, json.authKey);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleSlotSave(overwrite = false) {
    const slotName = namePostfixRef.current?.value?.trim() ?? '';
    if (!slotName) { setSaveStatus({ ok: false, msg: 'Set a name postfix to identify this config.' }); return; }
    setSaveStatus(null);
    setSavingConfig(true);
    setPendingOverwriteSlot(null);
    try {
      const res = await fetch('/api/profile/slots/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: profileId, authKey: profileAuthKey, slotName, config: buildProfile(), overwrite }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409 && !overwrite) { setPendingOverwriteSlot(slotName); return; }
      if (!res.ok) { setSaveStatus({ ok: false, msg: json.error || 'Save failed.' }); return; }
      setSaveStatus({ ok: true, msg: `Saved as "${slotName}".` });
      setProfileSlots((prev) => (prev.includes(slotName) ? prev : [...prev, slotName]));
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setSavingConfig(false);
    }
  }

  const confirmOverwrite = () => { void handleSlotSave(true); };
  const cancelOverwrite = () => setPendingOverwriteSlot(null);

  async function handleSlotLoad(slotName: string) {
    setProfileStatus(null);
    const res = await fetch('/api/profile/slots/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: profileId, authKey: profileAuthKey, slotName }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setProfileStatus({ ok: false, msg: json.error || 'Load failed.' }); return; }
    loadFromProfile(json.config);
    setProfileStatus({ ok: true, msg: `Loaded "${slotName}".` });
    setTimeout(() => { setProfileStatus(null); setProfileOpen(false); }, 1200);
  }

  async function handleSlotDelete(slotName: string) {
    const res = await fetch('/api/profile/slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: profileId, authKey: profileAuthKey, slotName }),
    });
    if (res.ok) setProfileSlots(prev => prev.filter(s => s !== slotName));
  }

  const openAccount = () => {
    setProfileOpen(true);
    setProfileStatus(null);
    if (profileId && profileAuthKey) void fetchSlots(profileId, profileAuthKey);
  };

  const closeAccount = () => setProfileOpen(false);

  const signOut = () => {
    setProfileId('');
    setProfileAuthKey('');
    setProfileSlots([]);
    setProfileStatus(null);
    sessionStorage.removeItem(PROFILE_SESSION_KEY);
  };

  return {
    profileOpen,
    setProfileOpen,
    profileId,
    stremioEmail,
    setStremioEmail,
    stremioPassword,
    setStremioPassword,
    loginLoading,
    slotsLoading,
    profileSlots,
    expandedSlot,
    setExpandedSlot,
    profileStatus,
    setProfileStatus,
    saveStatus,
    savingConfig,
    openAccount,
    closeAccount,
    signOut,
    handleStremioLogin,
    handleSlotSave,
    handleSlotLoad,
    handleSlotDelete,
    pendingOverwriteSlot,
    confirmOverwrite,
    cancelOverwrite,
  };
}
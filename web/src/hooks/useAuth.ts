import { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile } from '../types';

const STORAGE_KEY = 'parsage_user_profile';
const DEFAULT_PROFILE: UserProfile = {
  id: `user-${Date.now().toString(36)}`,
  name: 'Sage', tag: '1337',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sage&backgroundColor=1b1a17',
  isGoogleAuth: false, status: 'online', currentGame: 'Omarchy Desktop'
};

function localProfile(): UserProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...JSON.parse(saved), email: undefined, isGoogleAuth: false };
  } catch (error) {}
  return DEFAULT_PROFILE;
}

export function useAuth() {
  const [profile, setProfile] = useState<UserProfile>(localProfile);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const initializedClientId = useRef<string | null>(null);

  const applyServerProfile = useCallback((serverProfile: any) => {
    setProfile({
      id: serverProfile.id,
      name: serverProfile.name || 'Google User',
      tag: String(serverProfile.id).slice(-4),
      email: serverProfile.email,
      avatarUrl: serverProfile.avatarUrl || DEFAULT_PROFILE.avatarUrl,
      isGoogleAuth: true,
      status: 'online'
    });
    setAuthError(null);
    setIsAuthModalOpen(false);
  }, []);

  const handleGoogleCredentialResponse = useCallback(async (response: any) => {
    if (!response?.credential) {
      setAuthError('Google did not return an identity credential.');
      return;
    }
    try {
      const result = await fetch('/api/auth/google', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await result.json();
      if (!result.ok || !data.profile) throw new Error(data.error || 'Authentication failed.');
      applyServerProfile(data.profile);
      const pairingId = new URLSearchParams(window.location.search).get('authPair');
      if (pairingId) {
        const paired = await fetch('/api/auth/pair/complete', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pairingId })
        });
        if (!paired.ok) throw new Error('Desktop pairing failed or expired.');
      }
    } catch (error: any) {
      setAuthError(error.message || 'Google authentication failed.');
    }
  }, [applyServerProfile]);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/config', { credentials: 'same-origin' }).then(response => response.json()),
      fetch('/api/auth/me', { credentials: 'same-origin' }).then(response => response.json())
    ]).then(([config, session]) => {
      setAuthConfigured(Boolean(config.configured));
      setGoogleClientId(config.clientId || null);
      if (session.profile) applyServerProfile(session.profile);
    }).catch(() => setAuthError('Unable to check authentication service.'));
  }, [applyServerProfile]);

  useEffect(() => {
    if (!authConfigured) return;
    const existing = document.getElementById('google-gis-script') as HTMLScriptElement | null;
    if (existing) {
      if ((window as any).google?.accounts?.id) setSdkReady(true);
      else existing.addEventListener('load', () => setSdkReady(true), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => setAuthError('Google Identity Services could not be loaded.');
    document.body.appendChild(script);
  }, [authConfigured]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('authPair')) setIsAuthModalOpen(true);
  }, []);

  const startDesktopLogin = useCallback(async () => {
    setAuthError(null);
    try {
      const response = await fetch('/api/auth/pair/start', {
        method: 'POST', credentials: 'same-origin'
      });
      const pairing = await response.json();
      if (!response.ok) throw new Error(pairing.error || 'Unable to start browser sign-in.');
      const opened = await window.parsage?.openExternal?.(pairing.url);
      if (!opened) throw new Error('Unable to open the system browser.');

      for (let attempt = 0; attempt < 300; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const claim = await fetch('/api/auth/pair/claim', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: pairing.id, secret: pairing.secret })
        });
        if (claim.status === 202) continue;
        const data = await claim.json();
        if (!claim.ok || !data.profile) throw new Error(data.error || 'Desktop pairing failed.');
        applyServerProfile(data.profile);
        return;
      }
      throw new Error('Google sign-in timed out.');
    } catch (error: any) {
      setAuthError(error.message || 'Unable to start Google sign-in.');
    }
  }, [applyServerProfile]);

  const renderGoogleButton = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    element.replaceChildren();
    if (!authConfigured || !googleClientId) return;
    if (window.parsage?.openExternal) {
      const button = document.createElement('button');
      button.className = 'btn btn-primary';
      button.textContent = 'Continue securely in your browser';
      button.style.width = '360px';
      button.style.justifyContent = 'center';
      button.onclick = startDesktopLogin;
      element.appendChild(button);
      return;
    }
    const google = (window as any).google;
    if (!sdkReady || !google?.accounts?.id) return;
    if (initializedClientId.current !== googleClientId) {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      initializedClientId.current = googleClientId;
    }
    google.accounts.id.renderButton(element, {
      type: 'standard', theme: 'filled_black', size: 'large',
      text: 'continue_with', shape: 'rectangular', width: 360
    });
  }, [authConfigured, googleClientId, sdkReady, handleGoogleCredentialResponse, startDesktopLogin]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch (error) {}
  }, [profile]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(previous => ({ ...previous, ...updates }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      (window as any).google?.accounts?.id?.disableAutoSelect();
    } finally {
      setProfile({
        ...DEFAULT_PROFILE,
        id: `user-${Date.now().toString(36)}`,
        name: 'Guest Gamer',
        tag: Math.floor(1000 + Math.random() * 9000).toString()
      });
    }
  }, []);

  return {
    profile, updateProfile, authConfigured, renderGoogleButton, logout,
    isAuthModalOpen, setIsAuthModalOpen, authError
  };
}

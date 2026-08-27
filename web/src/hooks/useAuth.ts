import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';

const STORAGE_KEY = 'parsage_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  id: `user-${Date.now().toString(36)}`,
  name: 'Sage',
  tag: '1337',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Sage&backgroundColor=1b1a17',
  isGoogleAuth: false,
  status: 'online',
  currentGame: 'Omarchy Desktop'
};

export function useAuth() {
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_PROFILE;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {}
  }, [profile]);

  // Load Google Identity Services SDK (GIS - Free Google Sign-In)
  useEffect(() => {
    if (document.getElementById('google-gis-script')) return;

    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('[Auth] Google Identity Services loaded.');
    };
    document.body.appendChild(script);
  }, []);

  const loginWithGoogleMockOrGIS = useCallback((credentialResponse?: any) => {
    // If real GIS credential token is supplied, decode payload (base64 JWT)
    if (credentialResponse?.credential) {
      try {
        const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
        const updated: UserProfile = {
          id: payload.sub,
          name: payload.name || 'Google Gamer',
          tag: payload.sub.substring(0, 4),
          email: payload.email,
          avatarUrl: payload.picture || profile.avatarUrl,
          isGoogleAuth: true,
          status: 'online'
        };
        setProfile(updated);
        setIsAuthModalOpen(false);
        return;
      } catch (e) {
        console.error('[Auth] Error decoding Google token:', e);
      }
    }

    // Direct Instant Google Sign-In helper
    const dummyGoogleUser: UserProfile = {
      id: `google-${Date.now().toString(36)}`,
      name: profile.name === 'Sage' ? 'Sage (Google)' : profile.name,
      tag: '0420',
      email: 'sage@parsage.local',
      avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${profile.name}&backgroundColor=1b1a17`,
      isGoogleAuth: true,
      status: 'online'
    };
    setProfile(dummyGoogleUser);
    setIsAuthModalOpen(false);
  }, [profile]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  }, []);

  const logout = useCallback(() => {
    const fresh: UserProfile = {
      id: `user-${Date.now().toString(36)}`,
      name: 'Guest Gamer',
      tag: Math.floor(1000 + Math.random() * 9000).toString(),
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=Guest${Date.now()}&backgroundColor=1b1a17`,
      isGoogleAuth: false,
      status: 'online'
    };
    setProfile(fresh);
  }, []);

  return {
    profile,
    updateProfile,
    loginWithGoogleMockOrGIS,
    logout,
    isAuthModalOpen,
    setIsAuthModalOpen
  };
}

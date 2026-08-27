import { useState, useEffect, useCallback } from 'react';
import { ParsageSettings } from '../types';

const SETTINGS_KEY = 'parsage_app_settings';

const DEFAULT_SETTINGS: ParsageSettings = {
  client: {
    renderer: 'auto',
    codec: 'h264',
    windowMode: 'borderless',
    vsync: false,
    overlayHotkey: 'Ctrl+Alt+P',
    fullscreenHotkey: 'F11',
    hudHotkey: 'F8',
    chromaFormat: '4:2:0'
  },
  host: {
    enabled: true,
    resolution: '1080p',
    fps: 60,
    maxBitrateMbps: 25,
    adaptiveBitrate: true,
    requireApproval: false,
    allowMouseKeyboard: true,
    audioSink: 'default',
    virtualGamepadType: 'xbox360'
  },
  gamepad: {
    deadzone: 0.08,
    rumble: true,
    swapButtons: false,
    invertY: false
  },
  network: {
    lanDiscovery: true,
    congestionControl: 'gcc',
    customStunServer: ''
  }
};

export function useSettings() {
  const [settings, setSettings] = useState<ParsageSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
  }, [settings]);

  const updateClientSetting = useCallback(<K extends keyof ParsageSettings['client']>(
    key: K,
    val: ParsageSettings['client'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      client: { ...prev.client, [key]: val }
    }));
  }, []);

  const updateHostSetting = useCallback(<K extends keyof ParsageSettings['host']>(
    key: K,
    val: ParsageSettings['host'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      host: { ...prev.host, [key]: val }
    }));
  }, []);

  const updateGamepadSetting = useCallback(<K extends keyof ParsageSettings['gamepad']>(
    key: K,
    val: ParsageSettings['gamepad'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      gamepad: { ...prev.gamepad, [key]: val }
    }));
  }, []);

  const updateNetworkSetting = useCallback(<K extends keyof ParsageSettings['network']>(
    key: K,
    val: ParsageSettings['network'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      network: { ...prev.network, [key]: val }
    }));
  }, []);

  const resetDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    updateClientSetting,
    updateHostSetting,
    updateGamepadSetting,
    updateNetworkSetting,
    resetDefaults
  };
}

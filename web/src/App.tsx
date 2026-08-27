import React, { useState, useEffect } from 'react';
import { MainView } from './types';
import { useAuth } from './hooks/useAuth';
import { useSettings } from './hooks/useSettings';
import { useWebRTC } from './hooks/useWebRTC';
import { Sidebar } from './components/Sidebar';
import { ComputersView } from './components/ComputersView';
import { ArcadeView } from './components/ArcadeView';
import { FriendsView } from './components/FriendsView';
import { SettingsView } from './components/SettingsView';
import { DiagnosticsView } from './components/DiagnosticsView';
import { HostView } from './components/HostView';
import { ClientView } from './components/ClientView';
import { AuthModal } from './components/AuthModal';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<MainView>('computers');

  const {
    profile,
    updateProfile,
    googleClientId,
    setGoogleClientId,
    triggerGoogleLogin,
    logout,
    isAuthModalOpen,
    setIsAuthModalOpen,
    authError
  } = useAuth();

  const {
    settings,
    updateClientSetting,
    updateHostSetting,
    updateGamepadSetting,
    updateNetworkSetting,
    resetDefaults
  } = useSettings();

  const {
    wsConnected,
    currentPeerId,
    roomState,
    isHost,
    assignedSlot,
    remoteStream,
    localStream,
    latencyMs,
    errorMsg,
    chatMessages,
    reactions,
    lanIps,
    startScreenCapture,
    createRoom,
    joinRoom,
    approvePeer,
    claimSlot,
    updatePermissions,
    kickPeer,
    sendChat,
    sendReaction,
    sendInputPacket
  } = useWebRTC();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinParam = params.get('join');
    if (joinParam) {
      setCurrentView('computers');
    }
  }, []);

  const handleStartHostingSession = () => {
    createRoom(profile.name, {
      maxBitrateMbps: settings.host.maxBitrateMbps,
      targetFps: settings.host.fps,
      resolution: settings.host.resolution,
      requireApproval: settings.host.requireApproval,
      allowMouseKeyboard: settings.host.allowMouseKeyboard
    });
  };

  const handleJoinSpecificRoom = (code: string) => {
    joinRoom(code, profile.name);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-deep)' }}>
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        profile={profile}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        wsConnected={wsConnected}
        isHost={isHost && Boolean(roomState)}
        latencyMs={latencyMs}
      />

      {/* Main App Workspace */}
      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto', maxHeight: '100vh', position: 'relative' }}>
        {/* If Host is broadcasting in computers view, show Host Control Center */}
        {roomState && isHost && currentView === 'computers' ? (
          <HostView
            roomState={roomState}
            isHost={isHost}
            localStream={localStream}
            lanIps={lanIps}
            chatMessages={chatMessages}
            onCreateRoom={handleStartHostingSession}
            onStartCapture={startScreenCapture}
            onApprovePeer={approvePeer}
            onUpdatePermissions={updatePermissions}
            onKickPeer={kickPeer}
            onSendChat={sendChat}
            wsConnected={wsConnected}
            errorMsg={errorMsg}
          />
        ) : roomState && !isHost ? (
          /* If joined as Client, show Streaming Viewport */
          <ClientView
            roomState={roomState}
            remoteStream={remoteStream}
            assignedSlot={assignedSlot}
            chatMessages={chatMessages}
            reactions={reactions}
            onJoinRoom={handleJoinSpecificRoom}
            onClaimSlot={claimSlot}
            onSendInput={sendInputPacket}
            onSendChat={sendChat}
            onSendReaction={sendReaction}
            wsConnected={wsConnected}
            errorMsg={errorMsg}
          />
        ) : (
          /* Navigation Tabs */
          <>
            {currentView === 'computers' && (
              <ComputersView
                roomState={roomState}
                isHost={isHost}
                onStartHosting={handleStartHostingSession}
                onJoinRoom={handleJoinSpecificRoom}
                onOpenSettings={() => setCurrentView('settings')}
              />
            )}

            {currentView === 'arcade' && (
              <ArcadeView
                onJoinRoom={handleJoinSpecificRoom}
                onHostArcade={handleStartHostingSession}
              />
            )}

            {currentView === 'friends' && (
              <FriendsView
                onJoinRoom={handleJoinSpecificRoom}
                onInviteFriend={(name) => sendChat(`Hey ${name}, join my Parsage session!`)}
              />
            )}

            {currentView === 'settings' && (
              <SettingsView
                settings={settings}
                profile={profile}
                googleClientId={googleClientId}
                onUpdateGoogleClientId={setGoogleClientId}
                onUpdateClient={updateClientSetting}
                onUpdateHost={updateHostSetting}
                onUpdateGamepad={updateGamepadSetting}
                onUpdateNetwork={updateNetworkSetting}
                onResetDefaults={resetDefaults}
                onUpdateProfile={updateProfile}
                onOpenGoogleAuth={triggerGoogleLogin}
                onLogout={logout}
              />
            )}

            {currentView === 'diagnostics' && <DiagnosticsView />}
          </>
        )}
      </main>

      {/* Profile & Google Sign-In Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        profile={profile}
        onGoogleLogin={triggerGoogleLogin}
        onUpdateProfile={updateProfile}
        authError={authError}
      />
    </div>
  );
};

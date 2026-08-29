import { useState, useEffect, useRef, useCallback } from 'react';
import { RoomState, PeerInfo, ChatMessage, EmojiReaction } from '../types';

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com:3478' }
];

export function useWebRTC() {
  const [wsConnected, setWsConnected] = useState(false);
  const [currentPeerId, setCurrentPeerId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [assignedSlot, setAssignedSlot] = useState<number | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<EmojiReaction[]>([]);
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [nativeMediaStatus, setNativeMediaStatus] = useState<'idle' | 'starting' | 'ready' | 'streaming' | 'error'>('idle');

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_STUN_SERVERS);
  const maxBitrateBpsRef = useRef(25_000_000);
  const isHostRef = useRef(false);
  const roomStateRef = useRef<RoomState | null>(null);
  const currentPeerIdRef = useRef<string | null>(null);
  const negotiationLocks = useRef<Set<string>>(new Set());
  const iceRestartTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const iceRestartAttempts = useRef<Map<string, number>>(new Map());
  const pendingReconnectToken = useRef<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shuttingDown = useRef(false);
  const nativeTargetPeerId = useRef<string | null>(null);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);
  useEffect(() => { currentPeerIdRef.current = currentPeerId; }, [currentPeerId]);

  useEffect(() => {
    if (!window.parsage?.onNativePeerMessage) return;
    return window.parsage.onNativePeerMessage(({ targetPeerId, message }) => {
      if (targetPeerId !== nativeTargetPeerId.current || !message) return;
      if (message.type === 'ready') {
        setNativeMediaStatus('ready');
      } else if (message.type === 'offer' && typeof message.sdp === 'string') {
        wsRef.current?.send(JSON.stringify({
          type: 'offer', targetPeerId, sdp: { type: 'offer', sdp: message.sdp }
        }));
        setNativeMediaStatus('streaming');
      } else if (message.type === 'ice-candidate') {
        wsRef.current?.send(JSON.stringify({
          type: 'ice-candidate',
          targetPeerId,
          candidate: { candidate: message.candidate, sdpMLineIndex: message.sdpMLineIndex }
        }));
      } else if (message.type === 'input') {
        const peer = roomStateRef.current?.peers.find((candidate) => candidate.id === targetPeerId);
        const packet = message.packet;
        const allowed = packet?.type === 'gamepad'
          ? peer?.permissions.gamepad
          : packet?.type === 'mouse'
            ? peer?.permissions.mouse
            : packet?.type === 'keyboard'
              ? peer?.permissions.keyboard
              : false;
        if (peer?.approved && allowed) window.parsage?.sendInputPacket(packet);
      } else if (message.type === 'error') {
        setNativeMediaStatus('error');
        setErrorMsg(`Native media failed: ${message.message || 'unknown error'}`);
      } else if (message.type === 'stopped') {
        setNativeMediaStatus('idle');
        nativeTargetPeerId.current = null;
      }
    });
  }, []);

  // Fetch LAN IPs for Local Direct Connect
  useEffect(() => {
    fetch('/api/lan-info')
      .then(res => res.json())
      .then(data => {
        if (data.lanIps) setLanIps(data.lanIps);
      })
      .catch(() => {});

    fetch('/api/ice-servers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          iceServersRef.current = data.iceServers;
        }
      })
      .catch(() => {});
  }, []);

  const connectSignaling = useCallback(() => {
    if (shuttingDown.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? `${window.location.hostname}:7777` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      setErrorMsg(null);
      if (roomStateRef.current) {
        peerConnections.current.forEach((_pc, peerId) => restartPeerIce(peerId, 'signaling reconnected'));
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (!shuttingDown.current) reconnectTimer.current = setTimeout(connectSignaling, 2000);
    };

    ws.onerror = (err) => {
      console.error('[Parsage] Signaling error:', err);
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSignalingMessage(msg);
      } catch (e) {
        console.error('[Parsage] Error parsing message:', e);
      }
    };

    wsRef.current = ws;
  }, []);

  const createPeerConnection = useCallback((targetPeerId: string, isInitiator: boolean) => {
    if (peerConnections.current.has(targetPeerId)) {
      return peerConnections.current.get(targetPeerId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      bundlePolicy: 'max-bundle'
    });

    const clearRestartTimer = () => {
      const timer = iceRestartTimers.current.get(targetPeerId);
      if (timer) clearTimeout(timer);
      iceRestartTimers.current.delete(targetPeerId);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        clearRestartTimer();
        iceRestartAttempts.current.delete(targetPeerId);
      } else if (pc.connectionState === 'failed') {
        clearRestartTimer();
        restartPeerIce(targetPeerId, 'connection failed');
      } else if (pc.connectionState === 'disconnected' && !iceRestartTimers.current.has(targetPeerId)) {
        const timer = setTimeout(() => {
          iceRestartTimers.current.delete(targetPeerId);
          if (pc.connectionState === 'disconnected') restartPeerIce(targetPeerId, 'connection stalled');
        }, 3000);
        iceRestartTimers.current.set(targetPeerId, timer);
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          targetPeerId,
          candidate: e.candidate
        }));
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStreamRef.current!);
        if (track.kind === 'video') configureVideoSender(sender, maxBitrateBpsRef.current);
      });
    }

    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        setRemoteStream(e.streams[0]);
      }
    };

    if (isInitiator) {
      const dc = pc.createDataChannel('parsage-input', {
        ordered: false,
        maxRetransmits: 0
      });
      setupDataChannel(dc, targetPeerId);
    } else {
      pc.ondatachannel = (e) => {
        setupDataChannel(e.channel, targetPeerId);
      };
    }

    peerConnections.current.set(targetPeerId, pc);
    return pc;
  }, []);

  const configureVideoSender = async (sender: RTCRtpSender, maxBitrateBps: number) => {
    const parameters = sender.getParameters();
    parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
    parameters.encodings[0].maxBitrate = maxBitrateBps;
    await sender.setParameters(parameters);
  };

  const negotiatePeer = async (pc: RTCPeerConnection, targetPeerId: string, iceRestart = false) => {
    if (negotiationLocks.current.has(targetPeerId) || pc.signalingState !== 'stable') return false;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return false;
    negotiationLocks.current.add(targetPeerId);
    try {
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
        iceRestart
      });
      await pc.setLocalDescription(offer);
      wsRef.current.send(JSON.stringify({ type: 'offer', targetPeerId, sdp: pc.localDescription }));
      return true;
    } finally {
      negotiationLocks.current.delete(targetPeerId);
    }
  };

  const restartPeerIce = async (targetPeerId: string, reason: string) => {
    const pc = peerConnections.current.get(targetPeerId);
    if (!pc || pc.connectionState === 'closed') return;
    const attempts = (iceRestartAttempts.current.get(targetPeerId) || 0) + 1;
    iceRestartAttempts.current.set(targetPeerId, attempts);
    try {
      pc.restartIce();
      const started = await negotiatePeer(pc, targetPeerId, true);
      if (!started) {
        if (attempts < 4) {
          const timer = setTimeout(() => restartPeerIce(targetPeerId, reason), 1500);
          iceRestartTimers.current.set(targetPeerId, timer);
        } else {
          setErrorMsg('The peer connection could not recover after a network change.');
        }
      }
    } catch (error) {
      console.warn(`[Parsage] ICE restart failed (${reason}, attempt ${attempts})`, error);
      if (attempts < 4) {
        const timer = setTimeout(() => restartPeerIce(targetPeerId, reason), 1500);
        iceRestartTimers.current.set(targetPeerId, timer);
      } else {
        setErrorMsg('The peer connection could not recover after a network change.');
      }
    }
  };

  const beginGuestConnection = async (hostId: string) => {
    const pc = createPeerConnection(hostId, true);
    await negotiatePeer(pc, hostId);
  };

  const setupDataChannel = (dc: RTCDataChannel, targetPeerId: string) => {
    dc.onopen = () => {
      dataChannels.current.set(targetPeerId, dc);
    };
    dc.onclose = () => {
      dataChannels.current.delete(targetPeerId);
    };
    dc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'ping') {
          dc.send(JSON.stringify({ type: 'pong', timestamp: data.timestamp }));
        } else if (data.type === 'pong') {
          const rtt = Date.now() - data.timestamp;
          setLatencyMs(rtt);
        } else if (isHostRef.current) {
          const peer = roomStateRef.current?.peers.find((candidate) => candidate.id === targetPeerId);
          const permission = data.type === 'gamepad'
            ? peer?.permissions.gamepad
            : data.type === 'mouse'
              ? peer?.permissions.mouse
              : data.type === 'keyboard'
                ? peer?.permissions.keyboard
                : false;
          if (peer?.approved && permission) window.parsage?.sendInputPacket(data);
        }
      } catch (err) {}
    };
  };

  const handleSignalingMessage = async (msg: any) => {
    switch (msg.type) {
      case 'room-created':
        setRoomState(msg.state);
        setIsHost(true);
        setCurrentPeerId(msg.hostId);
        break;

      case 'session-ready': {
        if (typeof msg.token !== 'string') break;
        pendingReconnectToken.current = msg.token;
        const savedToken = sessionStorage.getItem('parsage-reconnect-token');
        if (savedToken && savedToken !== msg.token && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'resume-session', token: savedToken }));
        } else {
          sessionStorage.setItem('parsage-reconnect-token', msg.token);
        }
        break;
      }

      case 'session-resumed': {
        if (pendingReconnectToken.current) {
          sessionStorage.setItem('parsage-reconnect-token', pendingReconnectToken.current);
          pendingReconnectToken.current = null;
        }
        setCurrentPeerId(msg.peerId);
        setRoomState(msg.state);
        setIsHost(msg.isHost);
        if (msg.state) {
          const self = msg.state.peers.find((peer: PeerInfo) => peer.id === msg.peerId);
          setAssignedSlot(self?.slot ?? null);
          peerConnections.current.forEach((_pc, peerId) => restartPeerIce(peerId, 'session resumed'));
        }
        break;
      }

      case 'session-resume-failed':
        if (pendingReconnectToken.current) {
          sessionStorage.setItem('parsage-reconnect-token', pendingReconnectToken.current);
          pendingReconnectToken.current = null;
        }
        setRoomState(null);
        setCurrentPeerId(null);
        setIsHost(false);
        break;

      case 'room-joined':
        setRoomState(msg.state);
        setIsHost(false);
        setCurrentPeerId(msg.peerId);
        if (msg.state.hostId) {
          const self = msg.state.peers.find((peer: PeerInfo) => peer.id === msg.peerId);
          if (self?.approved) await beginGuestConnection(msg.state.hostId);
        }
        break;

      case 'peer-approved':
        setRoomState(msg.state);
        await beginGuestConnection(msg.hostId);
        break;

      case 'room-state':
        setRoomState(msg.state);
        if (nativeTargetPeerId.current) {
          const nativePeer = msg.state.peers.find((peer: PeerInfo) => peer.id === nativeTargetPeerId.current);
          if (!nativePeer?.approved) {
            window.parsage?.stopNativePeer?.();
            nativeTargetPeerId.current = null;
            setNativeMediaStatus('idle');
          }
        }
        if (currentPeerIdRef.current) {
          const self = msg.state.peers.find((p: PeerInfo) => p.id === currentPeerIdRef.current);
          if (self) setAssignedSlot(self.slot);
        }
        break;

      case 'new-chat':
        setChatMessages(prev => [...prev.slice(-49), msg.chat]);
        break;

      case 'new-reaction':
        setReactions(prev => [...prev.slice(-15), msg.reaction]);
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== msg.reaction.id));
        }, 3000);
        break;

      case 'offer': {
        const pc = createPeerConnection(msg.fromPeerId, false);
        if (pc.signalingState === 'have-local-offer') {
          await pc.setLocalDescription({ type: 'rollback' });
        }
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify({
          type: 'answer',
          targetPeerId: msg.fromPeerId,
          sdp: answer
        }));
        break;
      }

      case 'answer': {
        if (isHostRef.current && msg.fromPeerId === nativeTargetPeerId.current && window.parsage?.signalNativePeer) {
          window.parsage.signalNativePeer({
            targetPeerId: msg.fromPeerId,
            message: { type: 'answer', sdp: msg.sdp?.sdp || '' }
          });
          break;
        }
        const pc = peerConnections.current.get(msg.fromPeerId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
        break;
      }

      case 'ice-candidate': {
        if (isHostRef.current && msg.fromPeerId === nativeTargetPeerId.current && window.parsage?.signalNativePeer) {
          window.parsage.signalNativePeer({
            targetPeerId: msg.fromPeerId,
            message: {
              type: 'ice-candidate',
              candidate: msg.candidate?.candidate || '',
              sdpMLineIndex: msg.candidate?.sdpMLineIndex || 0
            }
          });
          break;
        }
        const pc = peerConnections.current.get(msg.fromPeerId);
        if (pc && msg.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (e) {}
        }
        break;
      }

      case 'error':
        setErrorMsg(msg.message);
        break;
    }
  };

  useEffect(() => {
    shuttingDown.current = false;
    connectSignaling();
    const restartAfterNetworkChange = () => {
      peerConnections.current.forEach((_pc, peerId) => restartPeerIce(peerId, 'network changed'));
    };
    window.addEventListener('online', restartAfterNetworkChange);
    return () => {
      shuttingDown.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      window.removeEventListener('online', restartAfterNetworkChange);
      wsRef.current?.close();
      iceRestartTimers.current.forEach(clearTimeout);
      iceRestartTimers.current.clear();
    };
  }, [connectSignaling]);

  const startScreenCapture = async (fps = 60, resolution = '1080p', maxBitrateMbps = 25) => {
    try {
      if (nativeTargetPeerId.current) {
        await window.parsage?.stopNativePeer?.();
        nativeTargetPeerId.current = null;
        setNativeMediaStatus('idle');
      }
      let height = 1080;
      let width = 1920;
      if (resolution === '720p') { height = 720; width = 1280; }
      else if (resolution === '1440p') { height = 1440; width = 2560; }
      else if (resolution === '4K') { height = 2160; width = 3840; }
      else if (resolution === 'ultrawide') { height = 1080; width = 2560; }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: fps, max: fps },
          width: { ideal: width },
          height: { ideal: height },
          displaySurface: 'monitor'
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      maxBitrateBpsRef.current = maxBitrateMbps * 1_000_000;

      peerConnections.current.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          const sender = pc.addTrack(track, stream);
          if (track.kind === 'video') configureVideoSender(sender, maxBitrateBpsRef.current);
        });
      });

      if (isHostRef.current) {
        for (const [peerId, pc] of peerConnections.current) {
          await negotiatePeer(pc, peerId);
        }
      }

      return stream;
    } catch (err: any) {
      console.error('[Capture] Screen capture failed:', err);
      setErrorMsg(`Screen capture failed: ${err.message}`);
      return null;
    }
  };

  const startNativeCapture = async (targetPeerId: string, fps = 60, maxBitrateMbps = 25) => {
    if (!window.parsage?.startNativePeer) {
      setErrorMsg('Native media is available only in the installed Parsage desktop app.');
      return false;
    }
    const peer = roomStateRef.current?.peers.find((candidate) => candidate.id === targetPeerId);
    if (!isHostRef.current || !peer?.approved) {
      setErrorMsg('Approve a viewer before starting native media.');
      return false;
    }
    setNativeMediaStatus('starting');
    nativeTargetPeerId.current = targetPeerId;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    const browserPeer = peerConnections.current.get(targetPeerId);
    browserPeer?.close();
    peerConnections.current.delete(targetPeerId);
    dataChannels.current.delete(targetPeerId);
    const result = await window.parsage.startNativePeer({
      targetPeerId,
      fps,
      bitrate: maxBitrateMbps
    });
    if (!result.ok) {
      nativeTargetPeerId.current = null;
      setNativeMediaStatus('error');
      setErrorMsg(result.error || 'Could not start native media.');
      return false;
    }
    return true;
  };

  const stopNativeCapture = async () => {
    await window.parsage?.stopNativePeer?.();
    nativeTargetPeerId.current = null;
    setNativeMediaStatus('idle');
  };

  const createRoom = (hostName: string, settings?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'create-room',
        name: hostName,
        settings
      }));
    }
  };

  const joinRoom = (roomCode: string, name: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join-room',
        roomCode: roomCode.trim().toUpperCase(),
        name
      }));
    }
  };

  const approvePeer = (peerId: string, slot?: number | null) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'approve-peer', peerId, slot }));
    }
  };

  const claimSlot = (slot: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'claim-slot', slot }));
    }
  };

  const updatePermissions = (peerId: string, permissions: PeerInfo['permissions']) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'update-permissions', peerId, permissions }));
    }
  };

  const kickPeer = (peerId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'kick-peer', peerId }));
    }
  };

  const sendChat = (text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && text.trim()) {
      wsRef.current.send(JSON.stringify({ type: 'chat', message: text.trim() }));
    }
  };

  const sendReaction = (emoji: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reaction', emoji }));
    }
  };

  const sendInputPacket = (packet: any) => {
    const raw = JSON.stringify(packet);
    dataChannels.current.forEach((dc) => {
      if (dc.readyState === 'open') {
        dc.send(raw);
      }
    });
  };

  return {
    wsConnected,
    currentPeerId,
    roomState,
    isHost,
    assignedSlot,
    remoteStream,
    localStream,
    nativeMediaStatus,
    latencyMs,
    errorMsg,
    chatMessages,
    reactions,
    lanIps,
    setErrorMsg,
    startScreenCapture,
    startNativeCapture,
    stopNativeCapture,
    createRoom,
    joinRoom,
    approvePeer,
    claimSlot,
    updatePermissions,
    kickPeer,
    sendChat,
    sendReaction,
    sendInputPacket
  };
}

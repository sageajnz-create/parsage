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

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const dataChannels = useRef<Map<string, RTCDataChannel>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_STUN_SERVERS);
  const maxBitrateBpsRef = useRef(25_000_000);
  const isHostRef = useRef(false);
  const roomStateRef = useRef<RoomState | null>(null);
  const currentPeerIdRef = useRef<string | null>(null);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);
  useEffect(() => { currentPeerIdRef.current = currentPeerId; }, [currentPeerId]);

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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '5173' ? `${window.location.hostname}:7777` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setWsConnected(true);
      setErrorMsg(null);
    };

    ws.onclose = () => {
      setWsConnected(false);
      setTimeout(connectSignaling, 2000);
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

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        pc.restartIce();
        negotiatePeer(pc, targetPeerId).catch(() => {
          setErrorMsg('The peer connection failed and could not be recovered.');
        });
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

  const negotiatePeer = async (pc: RTCPeerConnection, targetPeerId: string) => {
    const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({ type: 'offer', targetPeerId, sdp: offer }));
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
        const pc = peerConnections.current.get(msg.fromPeerId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
        break;
      }

      case 'ice-candidate': {
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
    connectSignaling();
    return () => {
      wsRef.current?.close();
    };
  }, [connectSignaling]);

  const startScreenCapture = async (fps = 60, resolution = '1080p', maxBitrateMbps = 25) => {
    try {
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
    latencyMs,
    errorMsg,
    chatMessages,
    reactions,
    lanIps,
    setErrorMsg,
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
  };
}

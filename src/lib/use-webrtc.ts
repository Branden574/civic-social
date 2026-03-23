'use client';

// ═══════════════════════════════════════════════════════════════
// Civic Social — WebRTC Peer Connection Manager
// ═══════════════════════════════════════════════════════════════
//
// Manages RTCPeerConnection instances for debate voice/video.
// Uses the existing polling-based signaling API at
// /api/debates/[debateId]/voice (PATCH action:'signal', GET signals).
//
// Architecture:
//   - Mesh topology: each participant connects to every other
//   - "Perfect negotiation" pattern using userId comparison
//   - Google STUN servers for NAT traversal
//   - Polls for incoming signals every 1.5s
//   - Exposes Map<userId, MediaStream> of remote streams
//
// ═══════════════════════════════════════════════════════════════

import { useRef, useCallback, useEffect, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────

export interface RemoteStream {
  userId: string;
  displayName: string;
  stream: MediaStream;
}

interface PeerState {
  pc: RTCPeerConnection;
  makingOffer: boolean;
  ignoreOffer: boolean;
  iceRestarts: number;
  iceRestartTimer: ReturnType<typeof setTimeout> | null;
}

interface SignalMessage {
  fromUserId: string;
  toUserId: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  payload: string;
}

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Fetch ICE servers (including TURN credentials) from server-side API.
// Credentials are never exposed in the client bundle.
async function getIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/turn-credentials');
    if (res.ok) {
      const data = await res.json();
      const servers = data.servers ?? DEFAULT_ICE_SERVERS;
      if (typeof window !== 'undefined') {
        const hasTurn = servers.some((s: RTCIceServer) => String(s.urls).startsWith('turn'));
        console.log(`[WebRTC] ICE servers: ${servers.length} configured, TURN: ${hasTurn}`);
      }
      return servers;
    }
  } catch { /* fall through */ }
  console.warn('[WebRTC] Failed to fetch ICE servers, using STUN-only fallback');
  return DEFAULT_ICE_SERVERS;
}

const SIGNAL_POLL_MS = 1500;
const ICE_RESTART_DELAY_MS = 2000;
const MAX_ICE_RESTARTS = 3;

// ─── Hook ───────────────────────────────────────────────────────

export function useWebRTC(
  debateId: string,
  currentUserId: string,
  joined: boolean,
) {
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const creatingPeersRef = useRef<Set<string>>(new Set());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  // ── Send signal to server ──────────────────────────────────
  const sendSignal = useCallback(async (
    toUserId: string,
    signalType: SignalMessage['type'],
    payload: unknown,
  ) => {
    try {
      await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signal',
          toUserId,
          signalType,
          payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
        }),
      });
    } catch {
      // Signal send failed — peer will retry
    }
  }, [debateId]);

  // ── Create a peer connection for a remote user ─────────────
  const createPeer = useCallback(async (remoteUserId: string): Promise<PeerState | null> => {
    // Prevent duplicate concurrent creation (race between connectToPeers and handleSignal)
    if (peersRef.current.has(remoteUserId) || creatingPeersRef.current.has(remoteUserId)) {
      console.log(`[WebRTC] Skipping duplicate peer creation for ${remoteUserId}`);
      return peersRef.current.get(remoteUserId) || null;
    }
    creatingPeersRef.current.add(remoteUserId);

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    const peerState: PeerState = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      iceRestarts: 0,
      iceRestartTimer: null,
    };

    // Add available local tracks via addTrack (creates transceivers implicitly).
    // Do NOT use addTransceiver — both sides would create duplicate transceivers
    // causing offer collisions that never resolve with polling-based signaling.
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
      console.log(`[WebRTC] Added ${localStreamRef.current.getTracks().length} local tracks to peer ${remoteUserId}`);
    } else {
      console.log(`[WebRTC] No local stream when creating peer ${remoteUserId} — tracks will be added via setLocalStream`);
    }

    // Collect remote tracks into a single MediaStream per peer.
    // We accumulate tracks so the UI has a single source per remote user.
    const peerRemoteStream = new MediaStream();
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from ${remoteUserId}:`, event.track.kind);
      if (!peerRemoteStream.getTrackById(event.track.id)) {
        peerRemoteStream.addTrack(event.track);
      }
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(remoteUserId, peerRemoteStream);
        return next;
      });
    };

    // ICE candidates → relay via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(remoteUserId, 'ice-candidate', {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    // Perfect negotiation: handle negotiationneeded
    pc.onnegotiationneeded = async () => {
      try {
        peerState.makingOffer = true;
        console.log(`[WebRTC] Negotiation needed for ${remoteUserId}, sending offer`);
        await pc.setLocalDescription();
        sendSignal(remoteUserId, 'offer', {
          type: pc.localDescription!.type,
          sdp: pc.localDescription!.sdp,
        });
      } catch (err) {
        console.error(`[WebRTC] Negotiation failed for ${remoteUserId}:`, err);
      } finally {
        peerState.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state for ${remoteUserId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        // Attempt ICE restart before giving up
        if (peerState.iceRestarts < MAX_ICE_RESTARTS) {
          peerState.iceRestarts++;
          peerState.iceRestartTimer = setTimeout(async () => {
            try {
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              sendSignal(remoteUserId, 'offer', {
                type: pc.localDescription!.type,
                sdp: pc.localDescription!.sdp,
              });
            } catch {
              // ICE restart failed — remove stream
              setRemoteStreams((prev) => {
                const next = new Map(prev);
                next.delete(remoteUserId);
                return next;
              });
            }
          }, ICE_RESTART_DELAY_MS);
        } else {
          // Max restarts exceeded — clean up
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(remoteUserId);
            return next;
          });
        }
      } else if (pc.connectionState === 'connected') {
        // Reset restart counter on successful connection
        peerState.iceRestarts = 0;
      } else if (pc.connectionState === 'closed') {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
      }
    };

    peersRef.current.set(remoteUserId, peerState);
    creatingPeersRef.current.delete(remoteUserId);
    return peerState;
  }, [sendSignal]);

  // ── Handle incoming signal ─────────────────────────────────
  const handleSignal = useCallback(async (signal: SignalMessage) => {
    const { fromUserId, type, payload } = signal;

    if (type === 'hangup') {
      const peer = peersRef.current.get(fromUserId);
      if (peer) {
        peer.pc.close();
        peersRef.current.delete(fromUserId);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(fromUserId);
          return next;
        });
      }
      return;
    }

    // Get or create peer
    let peerState: PeerState | undefined = peersRef.current.get(fromUserId);
    if (!peerState) {
      const created = await createPeer(fromUserId);
      if (!created) return; // Another creation in progress — signal will be re-polled
      peerState = created;
    }

    const { pc, makingOffer } = peerState;
    // "Polite" peer = the one with the smaller userId
    const polite = currentUserId < fromUserId;

    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

    if (type === 'offer') {
      const offerCollision = makingOffer || pc.signalingState !== 'stable';
      peerState.ignoreOffer = !polite && offerCollision;
      if (peerState.ignoreOffer) {
        console.log(`[WebRTC] Ignoring offer from ${fromUserId} (collision, impolite)`);
        return;
      }
      console.log(`[WebRTC] Processing offer from ${fromUserId}`);

      await pc.setRemoteDescription(new RTCSessionDescription(parsed));
      await pc.setLocalDescription();
      sendSignal(fromUserId, 'answer', {
        type: pc.localDescription!.type,
        sdp: pc.localDescription!.sdp,
      });
    } else if (type === 'answer') {
      console.log(`[WebRTC] Processing answer from ${fromUserId}`);
      await pc.setRemoteDescription(new RTCSessionDescription(parsed));
    } else if (type === 'ice-candidate') {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(parsed));
      } catch {
        if (!peerState.ignoreOffer) {
          // ICE candidate error — non-critical
        }
      }
    }
  }, [createPeer, currentUserId, sendSignal]);

  // ── Poll for signals ───────────────────────────────────────
  const pollSignals = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      const res = await fetch(
        `/api/debates/${encodeURIComponent(debateId)}/voice?_t=${Date.now()}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const signals: SignalMessage[] = data.signals || [];
      for (const sig of signals) {
        await handleSignal(sig);
      }
    } catch {
      // Poll failed — will retry
    }
  }, [debateId, handleSignal]);

  // Keep a ref to the latest pollSignals so the interval never uses a stale closure
  const pollSignalsRef = useRef(pollSignals);
  pollSignalsRef.current = pollSignals;

  // ── Set local stream (called by VoiceChat when mic/camera changes) ──
  // Strategy: use replaceTrack on existing senders (no renegotiation),
  // addTrack only for brand-new track kinds (one-time renegotiation).
  const setLocalStream = useCallback((stream: MediaStream | null) => {
    localStreamRef.current = stream;

    const audioTrack = stream?.getAudioTracks()[0] ?? null;
    const videoTrack = stream?.getVideoTracks()[0] ?? null;

    for (const [peerId, peerState] of peersRef.current) {
      const { pc } = peerState;

      // Build a map of existing transceiver senders by kind
      // (transceiver.receiver.track.kind is always set, even if sender.track is null)
      const senderByKind = new Map<string, RTCRtpSender>();
      for (const t of pc.getTransceivers()) {
        senderByKind.set(t.receiver.track.kind, t.sender);
      }

      // Audio: replace if sender exists, add if not
      const audioSender = senderByKind.get('audio');
      if (audioSender) {
        if (audioSender.track?.id !== audioTrack?.id) {
          console.log(`[WebRTC] ${audioTrack ? 'Replacing' : 'Clearing'} audio track for ${peerId}`);
          audioSender.replaceTrack(audioTrack).catch(() => {});
        }
      } else if (audioTrack && stream) {
        console.log(`[WebRTC] Adding audio track to peer ${peerId}`);
        pc.addTrack(audioTrack, stream);
      }

      // Video: replace if sender exists, add if not
      const videoSender = senderByKind.get('video');
      if (videoSender) {
        if (videoSender.track?.id !== videoTrack?.id) {
          console.log(`[WebRTC] ${videoTrack ? 'Replacing' : 'Clearing'} video track for ${peerId}`);
          videoSender.replaceTrack(videoTrack).catch(() => {});
        }
      } else if (videoTrack && stream) {
        console.log(`[WebRTC] Adding video track to peer ${peerId}`);
        pc.addTrack(videoTrack, stream);
      }
    }
  }, []);

  // ── Initiate connections to a list of peer userIds ─────────
  const connectToPeers = useCallback(async (peerUserIds: string[]) => {
    for (const peerId of peerUserIds) {
      if (peerId === currentUserId) continue;
      if (peersRef.current.has(peerId) || creatingPeersRef.current.has(peerId)) continue;
      // Create peer — onnegotiationneeded will fire and send offer
      await createPeer(peerId);
    }
  }, [currentUserId, createPeer]);

  // ── Start WebRTC (called when user joins voice) ────────────
  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;

    // Start signal polling — use ref so interval always calls latest version
    pollSignalsRef.current();
    pollRef.current = setInterval(() => pollSignalsRef.current(), SIGNAL_POLL_MS);
  }, []);

  // ── Stop WebRTC (called when user leaves voice) ────────────
  const stop = useCallback(() => {
    activeRef.current = false;

    // Stop polling
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    // Send hangup to all peers and close connections
    for (const [peerId, peerState] of peersRef.current) {
      if (peerState.iceRestartTimer) clearTimeout(peerState.iceRestartTimer);
      sendSignal(peerId, 'hangup', {});
      peerState.pc.close();
    }
    peersRef.current.clear();
    setRemoteStreams(new Map());
    localStreamRef.current = null;
  }, [sendSignal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (activeRef.current) {
        activeRef.current = false;
        if (pollRef.current) clearInterval(pollRef.current);
        for (const [, peerState] of peersRef.current) {
          if (peerState.iceRestartTimer) clearTimeout(peerState.iceRestartTimer);
          peerState.pc.close();
        }
        peersRef.current.clear();
      }
    };
  }, []);

  // Auto-stop when leaving
  useEffect(() => {
    if (!joined && activeRef.current) {
      stop();
    }
  }, [joined, stop]);

  return {
    remoteStreams,
    setLocalStream,
    connectToPeers,
    start,
    stop,
  };
}

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
}

interface SignalMessage {
  fromUserId: string;
  toUserId: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  payload: string;
}

// ─── Constants ──────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const SIGNAL_POLL_MS = 1500;

// ─── Hook ───────────────────────────────────────────────────────

export function useWebRTC(
  debateId: string,
  currentUserId: string,
  joined: boolean,
) {
  const peersRef = useRef<Map<string, PeerState>>(new Map());
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
  const createPeer = useCallback((remoteUserId: string): PeerState => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const peerState: PeerState = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
    };

    // Add local tracks to outgoing connection
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        pc.addTrack(track, localStreamRef.current);
      }
    }

    // Collect remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteUserId, remoteStream);
          return next;
        });
      }
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
        await pc.setLocalDescription();
        sendSignal(remoteUserId, 'offer', {
          type: pc.localDescription!.type,
          sdp: pc.localDescription!.sdp,
        });
      } catch {
        // Negotiation failed
      } finally {
        peerState.makingOffer = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(remoteUserId);
          return next;
        });
      }
    };

    peersRef.current.set(remoteUserId, peerState);
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
    let peerState = peersRef.current.get(fromUserId);
    if (!peerState) {
      peerState = createPeer(fromUserId);
    }

    const { pc, makingOffer } = peerState;
    // "Polite" peer = the one with the smaller userId
    const polite = currentUserId < fromUserId;

    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

    if (type === 'offer') {
      const offerCollision = makingOffer || pc.signalingState !== 'stable';
      peerState.ignoreOffer = !polite && offerCollision;
      if (peerState.ignoreOffer) return;

      await pc.setRemoteDescription(new RTCSessionDescription(parsed));
      await pc.setLocalDescription();
      sendSignal(fromUserId, 'answer', {
        type: pc.localDescription!.type,
        sdp: pc.localDescription!.sdp,
      });
    } else if (type === 'answer') {
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

  // ── Set local stream (called by VoiceChat when mic/camera changes) ──
  const setLocalStream = useCallback((stream: MediaStream | null) => {
    localStreamRef.current = stream;

    // Update tracks on all existing peer connections
    for (const [, peerState] of peersRef.current) {
      const { pc } = peerState;
      const senders = pc.getSenders();

      if (!stream) {
        // Remove all tracks
        for (const sender of senders) {
          try { pc.removeTrack(sender); } catch { /* already removed */ }
        }
        continue;
      }

      for (const track of stream.getTracks()) {
        const existingSender = senders.find((s) => s.track?.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          pc.addTrack(track, stream);
        }
      }
    }
  }, []);

  // ── Initiate connections to a list of peer userIds ─────────
  const connectToPeers = useCallback((peerUserIds: string[]) => {
    for (const peerId of peerUserIds) {
      if (peerId === currentUserId) continue;
      if (peersRef.current.has(peerId)) continue;
      // Create peer — onnegotiationneeded will fire and send offer
      createPeer(peerId);
    }
  }, [currentUserId, createPeer]);

  // ── Start WebRTC (called when user joins voice) ────────────
  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;

    // Start signal polling
    pollSignals(); // immediate first poll
    pollRef.current = setInterval(pollSignals, SIGNAL_POLL_MS);
  }, [pollSignals]);

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

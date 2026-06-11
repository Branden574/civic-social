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
import type PusherClient from 'pusher-js';

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
  /** ICE candidates that arrived before the remote description was set.
   *  Signals are consumed-on-read, so a dropped candidate is gone forever —
   *  buffer and flush after setRemoteDescription instead. */
  pendingCandidates: RTCIceCandidateInit[];
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

// ── Double-mount guard ──────────────────────────────────────────
// Two useWebRTC instances for the same debate+user consume each
// other's signals (GET marks them consumed) and send competing
// offers — video breaks in ways that look random. The debate page
// must render exactly ONE VoiceChat (portaled between layouts).
const activeInstances = new Map<string, number>();

function registerInstance(key: string): () => void {
  const next = (activeInstances.get(key) ?? 0) + 1;
  activeInstances.set(key, next);
  if (next > 1) {
    console.error(
      `[WebRTC] ${next} useWebRTC instances active for ${key}. ` +
      'Multiple instances steal each other\'s signals — render exactly one VoiceChat per debate.',
    );
  }
  return () => {
    const cur = (activeInstances.get(key) ?? 1) - 1;
    if (cur <= 0) activeInstances.delete(key);
    else activeInstances.set(key, cur);
  };
}

// ─── Hook ───────────────────────────────────────────────────────

export function useWebRTC(
  debateId: string,
  currentUserId: string,
  joined: boolean,
) {
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  // Tracks in-progress peer creation with a promise so concurrent callers can await
  const pendingPeersRef = useRef<Map<string, Promise<PeerState>>>(new Map());
  // Ref to handleSignal so sendSignal can process piggybacked signals without circular deps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSignalRef = useRef<(sig: SignalMessage) => Promise<void>>(async () => {});
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(false);

  // Detect duplicate engines for the same debate+user (see guard above).
  useEffect(() => {
    if (!debateId || !currentUserId) return;
    return registerInstance(`${debateId}:${currentUserId}`);
  }, [debateId, currentUserId]);

  // ── Send signal to server ──────────────────────────────────
  const sendSignal = useCallback(async (
    toUserId: string,
    signalType: SignalMessage['type'],
    payload: unknown,
  ) => {
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signal',
          toUserId,
          signalType,
          payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error(`[WebRTC] Signal send FAILED (${res.status}):`, signalType, 'to', toUserId, err);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data._dbWrite === 'MEMORY_FALLBACK') {
          console.error(`[WebRTC] Signal went to MEMORY not DB!`, signalType, 'to', toUserId);
        } else if (signalType === 'offer' || signalType === 'answer') {
          console.log(`[WebRTC] Signal sent OK (${data._dbWrite}):`, signalType, 'to', toUserId.slice(-8));
        }
        // Process piggybacked signals returned with the PATCH response
        if (data.pendingSignals?.length > 0) {
          console.log(`[WebRTC] Piggyback: ${data.pendingSignals.length} signal(s) received via PATCH response`);
          for (const sig of data.pendingSignals) {
            await handleSignalRef.current(sig);
          }
        }
      }
    } catch (err) {
      console.error(`[WebRTC] Signal send ERROR:`, signalType, 'to', toUserId, err);
    }
  }, [debateId]);

  // ── Create (or await) a peer connection for a remote user ───
  // Returns a promise that concurrent callers can await, preventing
  // the race where handleSignal drops a consumed signal because
  // connectToPeers is still creating the peer asynchronously.
  const createPeer = useCallback((remoteUserId: string): Promise<PeerState> => {
    // Already created — return immediately
    const existing = peersRef.current.get(remoteUserId);
    if (existing) return Promise.resolve(existing);

    // Creation in progress — return the same promise so callers wait
    const pending = pendingPeersRef.current.get(remoteUserId);
    if (pending) return pending;

    // Start new creation
    const promise = (async (): Promise<PeerState> => {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });

      const peerState: PeerState = {
        pc,
        makingOffer: false,
        ignoreOffer: false,
        iceRestarts: 0,
        iceRestartTimer: null,
        pendingCandidates: [],
      };

      // Add available local tracks via addTrack (creates transceivers implicitly)
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
        console.log(`[WebRTC] Added ${localStreamRef.current.getTracks().length} local tracks to peer ${remoteUserId}`);
      } else {
        console.log(`[WebRTC] No local stream when creating peer ${remoteUserId} — tracks will be added via setLocalStream`);
      }

      // Collect remote tracks into a single MediaStream per peer
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
          const sdp = pc.localDescription!.sdp;
          console.log(`[WebRTC] Offer SDP size: ${sdp.length} chars`);
          await sendSignal(remoteUserId, 'offer', {
            type: pc.localDescription!.type,
            sdp,
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
                setRemoteStreams((prev) => {
                  const next = new Map(prev);
                  next.delete(remoteUserId);
                  return next;
                });
              }
            }, ICE_RESTART_DELAY_MS);
          } else {
            setRemoteStreams((prev) => {
              const next = new Map(prev);
              next.delete(remoteUserId);
              return next;
            });
          }
        } else if (pc.connectionState === 'connected') {
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
      return peerState;
    })();

    pendingPeersRef.current.set(remoteUserId, promise);
    promise.then(() => pendingPeersRef.current.delete(remoteUserId));
    return promise;
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

    // Get or create peer — awaits in-progress creation if needed
    let peerState: PeerState | undefined = peersRef.current.get(fromUserId);
    if (!peerState) {
      peerState = await createPeer(fromUserId);
    }

    const { pc, makingOffer } = peerState;
    // "Polite" peer = the one with the smaller userId
    const polite = currentUserId < fromUserId;

    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;

    // Flush ICE candidates buffered while waiting for the remote description
    const flushPendingCandidates = async () => {
      const queued = peerState!.pendingCandidates.splice(0);
      for (const cand of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          if (!peerState!.ignoreOffer) {
            console.error(`[WebRTC] Buffered candidate failed for ${fromUserId}:`, err);
          }
        }
      }
    };

    try {
      if (type === 'offer') {
        const offerCollision = makingOffer || pc.signalingState !== 'stable';
        peerState.ignoreOffer = !polite && offerCollision;
        if (peerState.ignoreOffer) {
          console.log(`[WebRTC] Ignoring offer from ${fromUserId} (collision, impolite)`);
          return;
        }
        console.log(`[WebRTC] Processing offer from ${fromUserId}, signalingState=${pc.signalingState}`);

        await pc.setRemoteDescription(new RTCSessionDescription(parsed));
        await flushPendingCandidates();
        await pc.setLocalDescription();
        console.log(`[WebRTC] Sending answer to ${fromUserId}`);
        await sendSignal(fromUserId, 'answer', {
          type: pc.localDescription!.type,
          sdp: pc.localDescription!.sdp,
        });
      } else if (type === 'answer') {
        console.log(`[WebRTC] Processing answer from ${fromUserId}, signalingState=${pc.signalingState}`);
        await pc.setRemoteDescription(new RTCSessionDescription(parsed));
        await flushPendingCandidates();
      } else if (type === 'ice-candidate') {
        // Buffer candidates that arrive before the remote description —
        // adding them now throws, and the signal is already consumed
        // server-side, so dropping it would lose the candidate forever.
        if (!pc.remoteDescription) {
          peerState.pendingCandidates.push(parsed);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(parsed));
      }
    } catch (err) {
      console.error(`[WebRTC] Error handling ${type} from ${fromUserId}:`, err);
    }
  }, [createPeer, currentUserId, sendSignal]);

  // Keep handleSignalRef current so sendSignal can use it without circular deps
  handleSignalRef.current = handleSignal;

  // ── Poll for signals ───────────────────────────────────────
  const pollCountRef = useRef(0);
  const pollSignals = useCallback(async () => {
    if (!activeRef.current) return;
    pollCountRef.current++;
    try {
      const res = await fetch(
        `/api/debates/${encodeURIComponent(debateId)}/voice?signals=1&_t=${Date.now()}`,
      );
      if (!res.ok) {
        console.error(`[WebRTC] Poll HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      const signals: SignalMessage[] = data.signals || [];
      // Log first 3 polls and whenever signals arrive
      if (pollCountRef.current <= 3 || signals.length > 0) {
        console.log(`[WebRTC] Poll #${pollCountRef.current}: ${signals.length} signal(s), peers=${peersRef.current.size}`);
      }
      if (signals.length > 0) {
        console.log(`[WebRTC] Signals:`, signals.map(s => `${s.type} from ${s.fromUserId?.slice(-8)}`));
      }
      for (const sig of signals) {
        await handleSignal(sig);
      }
    } catch (err) {
      console.error(`[WebRTC] Poll error:`, err);
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
      if (peersRef.current.has(peerId) || pendingPeersRef.current.has(peerId)) continue;
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

  // ── Subscribe to Pusher for instant signal delivery ────────
  // Gate on `joined` only — NOT activeRef. activeRef is set by start()
  // asynchronously after join, so checking it here raced and silently
  // skipped the subscription, leaving only the lossy polling path.
  useEffect(() => {
    if (!joined) return;

    let pusher: PusherClient | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/pusher-config');
        const config = await res.json();
        if (!config.key || cancelled) return; // Pusher not configured or effect cleaned up

        // Dynamic import so the bundle doesn't fail when pusher-js isn't available
        const { default: PusherJS } = await import('pusher-js');
        if (cancelled) return;

        pusher = new PusherJS(config.key, { cluster: config.cluster });
        channel = pusher.subscribe(`debate-${debateId}`);

        channel.bind('signal', async (data: { fromUserId: string; toUserId: string; type: string; payload: string }) => {
          // Only process signals addressed to us
          if (data.toUserId !== currentUserId) return;

          const sig: SignalMessage = {
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            type: data.type as SignalMessage['type'],
            payload: data.payload,
          };
          console.log(`[WebRTC] Pusher: received ${sig.type} from ${sig.fromUserId.slice(-8)}`);
          await handleSignalRef.current(sig);
        });

        console.log('[WebRTC] Pusher: subscribed to debate channel');
      } catch {
        console.warn('[WebRTC] Pusher: not available, using polling fallback');
      }
    })();

    return () => {
      cancelled = true;
      if (channel) channel.unbind_all();
      if (pusher) pusher.disconnect();
    };
  }, [joined, debateId, currentUserId]);

  return {
    remoteStreams,
    setLocalStream,
    connectToPeers,
    start,
    stop,
  };
}

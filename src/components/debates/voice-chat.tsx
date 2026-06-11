'use client';

// ═══════════════════════════════════════════════════════════════
// Civic Social — Voice Chat Panel for Debates
// ═══════════════════════════════════════════════════════════════
//
// Voice chat controls for live debates. Features:
//   - Host toggle to enable/disable voice chat
//   - Request-to-speak queue (like X Spaces / Clubhouse)
//   - Speaker grid with mute indicators
//   - Self-mute/unmute toggle
//   - Host controls: grant/revoke speaking, server-mute, mute-all
//   - Visual audio activity indicators
//   - WebRTC readiness (signaling layer connected)
//
// Architecture note:
//   In this implementation, the signaling layer is polling-based
//   for compatibility with Next.js API routes. In production,
//   this would use WebSocket + an SFU (LiveKit, mediasoup, etc.)
//   for actual audio streaming. The UI and control flow are
//   production-ready; only the transport layer needs upgrading.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Hand,
  Crown,
  Shield,
  Users,
  Volume2,
  VolumeX,
  Loader2,
  Settings,
  ChevronDown,
  ChevronUp,
  Radio,
  CircleDot,
  Camera,
  CameraOff,
} from 'lucide-react';
import clsx from 'clsx';
import { useWebRTC } from '@/lib/use-webrtc';

// ─── Types ──────────────────────────────────────────────────────

interface VoiceParticipant {
  userId: string;
  displayName: string;
  role: 'speaker' | 'listener' | 'pending';
  isMuted: boolean;
  isServerMuted: boolean;
  joinedAt: string;
  requestedSpeakAt?: string;
}

interface VoiceRoom {
  debateId: string;
  enabled: boolean;
  creatorId: string;
  maxSpeakers: number;
  participants: VoiceParticipant[];
  speakRequests: string[];
  createdAt: string;
}

interface VoiceChatProps {
  debateId: string;
  debateStatus: 'waiting' | 'live' | 'paused' | 'completed';
  isCreator: boolean;
  isDebater: boolean;       // true if user is a debate participant (not just a spectator)
  currentUserId: string;
  onRemoteStreamsChange?: (streams: Map<string, MediaStream>) => void;
  onLocalStreamChange?: (stream: MediaStream | null) => void;
  onCameraChange?: (on: boolean) => void;
}

// ─── Audio device types ─────────────────────────────────────────

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

type MicPermission = 'prompt' | 'granted' | 'denied' | 'unsupported';

// ─── Audio device helpers ───────────────────────────────────────

/**
 * Request microphone permission with an optional specific device.
 */
async function requestMicPermission(
  deviceId?: string,
): Promise<{ granted: boolean; stream: MediaStream | null; error?: string }> {
  if (!navigator?.mediaDevices?.getUserMedia) {
    return { granted: false, stream: null, error: 'Your browser does not support microphone access.' };
  }

  try {
    const constraints: MediaStreamConstraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId } }
        : true,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return { granted: true, stream };
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { granted: false, stream: null, error: 'Microphone access was denied. Please allow microphone access in your browser settings.' };
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return { granted: false, stream: null, error: 'Selected microphone not found. Please choose a different device.' };
    }
    return { granted: false, stream: null, error: 'Could not access microphone. Please check your device settings.' };
  }
}

/**
 * Enumerate all audio input and output devices.
 * Must be called AFTER getUserMedia so labels are populated.
 */
async function enumerateAudioDevices(): Promise<{ inputs: AudioDevice[]; outputs: AudioDevice[] }> {
  if (!navigator?.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs: AudioDevice[] = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${i + 1}`,
        kind: 'audioinput' as const,
      }));
    const outputs: AudioDevice[] = devices
      .filter((d) => d.kind === 'audiooutput')
      .map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Speaker ${i + 1}`,
        kind: 'audiooutput' as const,
      }));
    return { inputs, outputs };
  } catch {
    return { inputs: [], outputs: [] };
  }
}

// ─── Voice activity detection hook ──────────────────────────────
// Uses the Web Audio API AnalyserNode to detect when the user is
// actively speaking into their mic. Returns true when voice volume
// exceeds a threshold, with a small hold-time to prevent flicker.

function useVoiceActivity(stream: MediaStream | null, muted: boolean): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // No stream or muted — not speaking
    if (!stream || muted) {
      setIsSpeaking(false);
      return;
    }

    // Create audio context + analyser
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const THRESHOLD = 25; // Volume threshold (0-255 scale)
    const HOLD_MS = 250;  // Keep "speaking" for 250ms after dropping below threshold

    function detect() {
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume across frequency bins
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;

      if (avg > THRESHOLD) {
        // Speaking — clear any pending "stop" timer
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        setIsSpeaking(true);
      } else {
        // Below threshold — start hold timer if not already running
        if (!holdTimerRef.current) {
          holdTimerRef.current = setTimeout(() => {
            setIsSpeaking(false);
            holdTimerRef.current = null;
          }, HOLD_MS);
        }
      }

      rafRef.current = requestAnimationFrame(detect);
    }

    rafRef.current = requestAnimationFrame(detect);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close().catch(() => {});
      setIsSpeaking(false);
    };
  }, [stream, muted]);

  return isSpeaking;
}

// ─── Component ──────────────────────────────────────────────────

export function VoiceChat({ debateId, debateStatus, isCreator, isDebater, currentUserId, onRemoteStreamsChange, onLocalStreamChange, onCameraChange }: VoiceChatProps) {
  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [micPermission, setMicPermission] = useState<MicPermission>('prompt');
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  // Audio device selection
  const [audioInputs, setAudioInputs] = useState<AudioDevice[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<AudioDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('default');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('default');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  // Ref for the hidden <audio> element used to route output
  const audioOutputRef = useRef<HTMLAudioElement | null>(null);

  // ── WebRTC peer connections ─────────────────────────────────
  const { remoteStreams, setLocalStream, connectToPeers, start: startWebRTC, stop: stopWebRTC } = useWebRTC(debateId, currentUserId, joined);

  // Notify parent when remote streams change
  useEffect(() => {
    onRemoteStreamsChange?.(remoteStreams);
  }, [remoteStreams, onRemoteStreamsChange]);

  // ── Camera state ────────────────────────────────────────────
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const toggleCamera = useCallback(async () => {
    if (cameraEnabled && localVideoStream) {
      localVideoStream.getVideoTracks().forEach((t) => t.stop());
      setLocalVideoStream(null);
      setCameraEnabled(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        });
        setLocalVideoStream(stream);
        setCameraEnabled(true);
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError') setDeviceError('Camera access was denied.');
        else if (name === 'NotFoundError') setDeviceError('No camera found.');
        else setDeviceError('Could not access camera.');
      }
    }
  }, [cameraEnabled, localVideoStream]);

  // Wire video element to stream + handle track ended (filters, OS interruptions)
  useEffect(() => {
    if (localVideoRef.current && localVideoStream) {
      localVideoRef.current.srcObject = localVideoStream;
    }

    if (!localVideoStream) return;

    // If the video track ends (e.g. iOS filter processing, app backgrounding,
    // or OS-level camera interruption), clean up gracefully
    const videoTrack = localVideoStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const handleEnded = () => {
      setLocalVideoStream(null);
      setCameraEnabled(false);
    };

    videoTrack.addEventListener('ended', handleEnded);
    return () => {
      videoTrack.removeEventListener('ended', handleEnded);
    };
  }, [localVideoStream]);

  // ── Sync local tracks (mic + camera) to WebRTC ────────────
  // Use a stable MediaStream ref so addTrack always passes the same stream
  // to pc.addTrack — this ensures the remote ontrack events share one stream.
  const combinedStreamRef = useRef<MediaStream>(new MediaStream());

  useEffect(() => {
    if (!joined) return;
    const stable = combinedStreamRef.current;

    // Remove tracks that are no longer present
    for (const existing of stable.getTracks()) {
      const stillHaveAudio = micStream?.getAudioTracks().some((t) => t.id === existing.id);
      const stillHaveVideo = localVideoStream?.getVideoTracks().some((t) => t.id === existing.id);
      if (!stillHaveAudio && !stillHaveVideo) {
        stable.removeTrack(existing);
      }
    }

    // Add new tracks that aren't already on the stable stream
    if (micStream) {
      for (const track of micStream.getAudioTracks()) {
        if (!stable.getTrackById(track.id)) {
          stable.addTrack(track);
        }
      }
    }
    if (localVideoStream) {
      for (const track of localVideoStream.getVideoTracks()) {
        if (!stable.getTrackById(track.id)) {
          stable.addTrack(track);
        }
      }
    }

    setLocalStream(stable.getTracks().length > 0 ? stable : null);
    onLocalStreamChange?.(stable.getTracks().length > 0 ? stable : null);
  }, [micStream, localVideoStream, joined, setLocalStream, onLocalStreamChange]);

  // Notify parent of camera state changes
  useEffect(() => {
    onCameraChange?.(cameraEnabled);
  }, [cameraEnabled, onCameraChange]);

  // Cleanup video on unmount
  useEffect(() => {
    return () => {
      localVideoStream?.getVideoTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Connect to new peers when room participants change ─────
  // Use a stable string key so React detects new participants reliably
  const peerIdKey = room?.participants
    ?.map((p) => p.userId)
    .filter((id) => id !== currentUserId)
    .sort()
    .join(',') ?? '';

  // Only connect to peers after local stream is ready (mic at minimum)
  // so the initial offer includes media lines
  const hasLocalStream = !!micStream || !!localVideoStream;
  useEffect(() => {
    if (!joined || !peerIdKey || !hasLocalStream) return;
    const peerIds = peerIdKey.split(',');
    if (peerIds.length > 0) connectToPeers(peerIds);
  }, [joined, peerIdKey, hasLocalStream, connectToPeers]);

  // Current user's participant state
  const myParticipant = room?.participants.find((p) => p.userId === currentUserId) ?? null;
  const isSpeaker = myParticipant?.role === 'speaker';
  const isPending = myParticipant?.role === 'pending';
  const isSelfMuted = myParticipant?.isMuted ?? true;
  const isServerMutedMe = myParticipant?.isServerMuted ?? false;

  // ── Enforce mute on the actual audio tracks ────────────────
  // Room state (isMuted/isServerMuted) previously only changed the
  // badge — the mic track kept transmitting to every peer while the
  // UI said "Muted". track.enabled=false makes WebRTC send silence
  // without renegotiation. (P2P limitation: server-mute is enforced
  // client-side; a tampered client could ignore it.)
  useEffect(() => {
    if (!joined) return;
    const shouldTransmit = !isSelfMuted && !isServerMutedMe;
    const tracks = [
      ...(micStream?.getAudioTracks() ?? []),
      ...combinedStreamRef.current.getAudioTracks(),
    ];
    for (const t of tracks) {
      if (t.enabled !== shouldTransmit) t.enabled = shouldTransmit;
    }
  }, [joined, isSelfMuted, isServerMutedMe, micStream]);

  // Voice activity detection — green ring when speaking
  const isSpeaking = useVoiceActivity(micStream, isSelfMuted);

  const speakers = room?.participants.filter((p) => p.role === 'speaker') ?? [];
  const listeners = room?.participants.filter((p) => p.role === 'listener') ?? [];
  const pendingRequests = room?.speakRequests ?? [];

  // Track whether we've already auto-reconnected after a refresh
  const hasAutoReconnected = useRef(false);

  // ── Fetch voice room state ──────────────────────────────────
  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice?_t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      setRoom(data.room || null);

      // Check if we're in the room (e.g. after page refresh)
      if (data.room?.participants.some((p: VoiceParticipant) => p.userId === currentUserId)) {
        setJoined(true);
      }
    } catch { /* ignore */ }
  }, [debateId, currentUserId]);

  // Initial + polling
  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // ── Auto-reconnect after page refresh ─────────────────────
  // When the component mounts and detects the user is already in the
  // voice room (joined=true from fetchRoom), re-request mic and
  // restart WebRTC so audio/video resumes without manual action.
  useEffect(() => {
    if (!joined || hasAutoReconnected.current || !room?.enabled) return;
    hasAutoReconnected.current = true;

    const myParticipant = room.participants.find((p) => p.userId === currentUserId);
    if (!myParticipant) return;

    (async () => {
      // Speakers need mic BEFORE starting WebRTC so offers include media
      if (myParticipant.role === 'speaker') {
        const mic = await requestMicPermission();
        if (mic.granted && mic.stream) {
          setMicPermission('granted');
          setMicStream(mic.stream);
          // Eagerly add mic to stable stream so peers created during startWebRTC include audio
          const stable = combinedStreamRef.current;
          for (const t of mic.stream.getAudioTracks()) {
            if (!stable.getTrackById(t.id)) stable.addTrack(t);
          }
          setLocalStream(stable);
        }
      }
      startWebRTC();
    })();
  }, [joined, room, currentUserId, startWebRTC]);

  useEffect(() => {
    if (!room?.enabled) return;
    const interval = setInterval(fetchRoom, 1500);
    return () => clearInterval(interval);
  }, [fetchRoom, room?.enabled]);

  // ── Microphone permission + cleanup ─────────────────────────
  // Stop mic stream tracks when leaving or unmounting
  const stopMicStream = useCallback(() => {
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    }
  }, [micStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (micStream) micStream.getTracks().forEach((track) => track.stop());
    };
  }, [micStream]);

  // ── Enumerate audio devices after permission is granted ─────
  const refreshDevices = useCallback(async () => {
    const { inputs, outputs } = await enumerateAudioDevices();
    setAudioInputs(inputs);
    setAudioOutputs(outputs);

    // If current selection no longer exists, reset to default
    if (inputs.length > 0 && !inputs.some((d) => d.deviceId === selectedInputId)) {
      setSelectedInputId(inputs[0].deviceId);
    }
    if (outputs.length > 0 && !outputs.some((d) => d.deviceId === selectedOutputId)) {
      setSelectedOutputId(outputs[0].deviceId);
    }
  }, [selectedInputId, selectedOutputId]);

  // Refresh device list whenever mic permission changes to granted
  useEffect(() => {
    if (micPermission === 'granted') {
      refreshDevices();
    }
  }, [micPermission, refreshDevices]);

  // Listen for device changes (e.g. headphones plugged in/out)
  useEffect(() => {
    if (micPermission !== 'granted') return;
    const handler = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', handler);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handler);
    };
  }, [micPermission, refreshDevices]);

  // ── Switch input device (re-acquire mic stream) ────────────
  const switchInputDevice = useCallback(async (deviceId: string) => {
    setSelectedInputId(deviceId);
    setDeviceError(null);

    // Stop existing stream
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
    }

    // Acquire new stream with the chosen device
    const mic = await requestMicPermission(deviceId);
    if (!mic.granted) {
      setDeviceError(mic.error || 'Could not switch microphone.');
      return;
    }
    setMicStream(mic.stream);
  }, [micStream]);

  // ── Switch output device (setSinkId on audio element) ──────
  const switchOutputDevice = useCallback(async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    setDeviceError(null);

    // setSinkId is available on HTMLAudioElement in Chromium browsers
    const audioEl = audioOutputRef.current;
    if (audioEl && 'setSinkId' in audioEl) {
      try {
        await (audioEl as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
      } catch {
        setDeviceError('Could not switch speaker. Your browser may not support output device selection.');
      }
    }
  }, []);

  // ── Actions ─────────────────────────────────────────────────

  /**
   * Request mic permission, then enable voice chat (host only).
   */
  const enableVoice = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Step 1: Request microphone permission (use selected device if available)
    const mic = await requestMicPermission(selectedInputId !== 'default' ? selectedInputId : undefined);
    if (!mic.granted) {
      setMicPermission('denied');
      setError(mic.error || 'Microphone access is required for voice chat.');
      setLoading(false);
      return;
    }
    setMicPermission('granted');
    setMicStream(mic.stream);

    // Eagerly add mic to stable stream so peers created during startWebRTC include audio
    if (mic.stream) {
      const stable = combinedStreamRef.current;
      for (const t of mic.stream.getAudioTracks()) {
        if (!stable.getTrackById(t.id)) stable.addTrack(t);
      }
      setLocalStream(stable);
    }

    // Step 2: Enable voice on server
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable', maxSpeakers: 8 }),
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data.room);
        setJoined(true);
        startWebRTC();
      } else {
        setError(data.error);
        // Release mic if server failed
        mic.stream?.getTracks().forEach((t) => t.stop());
        setMicStream(null);
      }
    } catch {
      setError('Network error.');
      mic.stream?.getTracks().forEach((t) => t.stop());
      setMicStream(null);
    } finally {
      setLoading(false);
    }
  }, [debateId, selectedInputId, setLocalStream]);

  /**
   * Request mic permission, then join the voice room (debaters only).
   */
  const joinRoom = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Step 1: Request microphone permission (use selected device if available)
    const mic = await requestMicPermission(selectedInputId !== 'default' ? selectedInputId : undefined);
    if (!mic.granted) {
      setMicPermission('denied');
      setError(mic.error || 'Microphone access is required to join voice chat.');
      setLoading(false);
      return;
    }
    setMicPermission('granted');
    setMicStream(mic.stream);

    // Eagerly add mic to stable stream so peers created during startWebRTC include audio
    if (mic.stream) {
      const stable = combinedStreamRef.current;
      for (const t of mic.stream.getAudioTracks()) {
        if (!stable.getTrackById(t.id)) stable.addTrack(t);
      }
      setLocalStream(stable);
    }

    // Step 2: Join voice room on server
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', asListener: false }),
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data.room);
        setJoined(true);
        startWebRTC();
        // Connect to existing participants
        if (data.room?.participants) {
          const peerIds = data.room.participants
            .map((p: VoiceParticipant) => p.userId)
            .filter((id: string) => id !== currentUserId);
          connectToPeers(peerIds);
        }
      } else {
        setError(data.error);
        mic.stream?.getTracks().forEach((t) => t.stop());
        setMicStream(null);
      }
    } catch {
      setError('Network error.');
      mic.stream?.getTracks().forEach((t) => t.stop());
      setMicStream(null);
    } finally {
      setLoading(false);
    }
  }, [debateId, selectedInputId, setLocalStream]);

  /**
   * Join as listen-only spectator (no mic permission needed).
   * Establishes receive-only WebRTC connections to hear/see speakers.
   */
  const listenIn = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', asListener: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setRoom(data.room);
        setJoined(true);
        startWebRTC();
        // Connect to speakers to receive their streams (no local tracks sent)
        if (data.room?.participants) {
          const speakerIds = data.room.participants
            .filter((p: VoiceParticipant) => p.role === 'speaker')
            .map((p: VoiceParticipant) => p.userId)
            .filter((id: string) => id !== currentUserId);
          connectToPeers(speakerIds);
        }
      } else {
        setError(data.error || 'Could not join as listener.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }, [debateId, currentUserId, startWebRTC, connectToPeers]);

  const leaveRoom = useCallback(async () => {
    stopWebRTC();
    stopMicStream();
    // Stop camera too
    if (localVideoStream) {
      localVideoStream.getVideoTracks().forEach((t) => t.stop());
      setLocalVideoStream(null);
      setCameraEnabled(false);
    }
    try {
      await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice?leave=1`, { method: 'DELETE' });
      setJoined(false);
      setMicPermission('prompt');
      fetchRoom();
    } catch { /* ignore */ }
  }, [debateId, fetchRoom, stopMicStream, stopWebRTC, localVideoStream]);

  const disableVoice = useCallback(async () => {
    stopWebRTC();
    try {
      await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice`, { method: 'DELETE' });
      setRoom(null);
      setJoined(false);
    } catch { /* ignore */ }
  }, [debateId, stopWebRTC]);

  const voiceAction = useCallback(async (action: string, extra: Record<string, string> = {}) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/debates/${encodeURIComponent(debateId)}/voice`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (res.ok && data.room) setRoom(data.room);
    } catch { /* ignore */ }
    finally { setActionLoading(null); }
  }, [debateId]);

  // ── Not enabled yet ─────────────────────────────────────────
  if (!room || !room.enabled) {
    return (
      <div className="bg-surface-elevated border border-border-subtle rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mic className="w-4 h-4 text-text-muted" />
          <span className="text-xs font-semibold text-text-primary">Voice Chat</span>
          <span className="text-xs text-text-muted bg-surface-active px-1.5 py-0.5 rounded-full">Debaters only</span>
        </div>

        {!isDebater ? (
          <div className="text-center">
            <p className="text-xs text-text-muted mb-3">
              Voice chat is not enabled yet. The host can enable it.
            </p>
          </div>
        ) : isCreator ? (
          <div className="text-center">
            <p className="text-xs text-text-muted mb-3">
              Enable voice chat to let debaters speak live. Your browser will request microphone access.
            </p>
            <button
              onClick={enableVoice}
              disabled={loading || debateStatus === 'completed'}
              className="flex items-center gap-1.5 mx-auto px-4 py-2 text-xs font-semibold bg-civic text-white rounded-xl hover:bg-civic-dark disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
              Enable Voice Chat
            </button>
            {error && <p className="text-xs text-danger-light mt-2">{error}</p>}
          </div>
        ) : (
          <p className="text-xs text-text-muted text-center">
            Voice chat is not enabled yet. The host can enable it.
          </p>
        )}
      </div>
    );
  }

  // ── Voice room enabled ──────────────────────────────────────
  return (
    <div className={clsx(
      'bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden transition-colors',
      collapsed ? 'h-12' : '',
    )}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle cursor-pointer hover:bg-surface-hover transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Mic className="w-4 h-4 text-positive-light" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-positive rounded-full animate-pulse" />
          </div>
          <span className="text-xs font-semibold text-text-primary">Voice Chat</span>
          <span className="text-xs text-text-muted bg-surface-active px-1.5 py-0.5 rounded-full">Debaters only</span>
          <span className="text-xs text-text-muted">
            {speakers.length} speaking · {room.participants.length} in room
          </span>
        </div>
        {collapsed ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
      </div>

      {!collapsed && (
        <div className="p-3 space-y-3">
          {/* ── Speakers grid ── */}
          <div>
            <p className="text-xs font-semibold text-text-muted mb-2">
              Speakers ({speakers.length}/{room.maxSpeakers})
            </p>
            {speakers.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {speakers.map((p) => (
                  <VoiceAvatar
                    key={p.userId}
                    participant={p}
                    isCreator={isCreator}
                    isHost={p.userId === room.creatorId}
                    currentUserId={currentUserId}
                    isSpeakingNow={p.userId === currentUserId ? isSpeaking : false}
                    onRevoke={() => voiceAction('revoke_speak', { targetUserId: p.userId })}
                    onServerMute={() => voiceAction('server_mute', { targetUserId: p.userId })}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted text-center py-2">No active speakers</p>
            )}
          </div>

          {/* ── Request-to-speak queue (host only) ── */}
          {isCreator && pendingRequests.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-warning-light mb-2 flex items-center gap-1">
                <Hand className="w-3 h-3" />
                Requests to Speak ({pendingRequests.length})
              </p>
              <div className="space-y-1.5">
                {pendingRequests.map((userId) => {
                  const p = room.participants.find((pp) => pp.userId === userId);
                  if (!p) return null;
                  return (
                    <div key={userId} className="flex items-center justify-between bg-warning/5 border border-warning/15 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-warning/15 flex items-center justify-center text-[9px] font-bold text-warning-light">
                          {p.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-xs text-text-primary font-medium">{p.displayName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => voiceAction('grant_speak', { targetUserId: userId })}
                          disabled={actionLoading === 'grant_speak'}
                          className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-positive/15 text-positive-light hover:bg-positive/25 transition-colors"
                        >
                          Grant
                        </button>
                        <button
                          onClick={() => voiceAction('revoke_speak', { targetUserId: userId })}
                          className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-danger/10 text-danger-light hover:bg-danger/20 transition-colors"
                        >
                          Deny
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Listeners ── */}
          {listeners.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted mb-2">
                Listeners ({listeners.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {listeners.slice(0, 20).map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center gap-1 bg-surface px-2 py-1 rounded-full text-xs text-text-muted"
                    title={p.displayName}
                  >
                    <span className="w-4 h-4 rounded-sm bg-surface-active flex items-center justify-center text-[8px] font-bold">
                      {p.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </span>
                    <span className="truncate max-w-[60px]">{p.displayName.split(' ')[0]}</span>
                  </div>
                ))}
                {listeners.length > 20 && (
                  <span className="text-xs text-text-muted px-2 py-1">+{listeners.length - 20} more</span>
                )}
              </div>
            </div>
          )}

          {/* ── Device Settings Panel ── */}
          {joined && showDeviceSettings && (
            <div className="bg-surface border border-border-subtle rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-text-muted" />
                  Audio Settings
                </p>
                <button
                  onClick={() => setShowDeviceSettings(false)}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Close
                </button>
              </div>

              {/* Microphone (Input) */}
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">
                  Microphone (Input)
                </label>
                <div className="relative">
                  <Mic className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                  <select
                    value={selectedInputId}
                    onChange={(e) => switchInputDevice(e.target.value)}
                    className="w-full bg-surface-elevated border border-border-subtle rounded-xl pl-8 pr-3 py-2 text-xs text-text-primary appearance-none cursor-pointer hover:border-civic/40 focus:border-civic focus:outline-none transition-colors"
                  >
                    {audioInputs.length === 0 && (
                      <option value="default">Default Microphone</option>
                    )}
                    {audioInputs.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
                </div>
                {/* Active input indicator */}
                {micStream && (
                  <p className="text-[9px] text-positive-light mt-1 flex items-center gap-1">
                    <CircleDot className="w-2.5 h-2.5" />
                    Active: {micStream.getAudioTracks()[0]?.label || 'Unknown device'}
                  </p>
                )}
              </div>

              {/* Speaker (Output) */}
              <div>
                <label className="text-xs font-medium text-text-muted block mb-1.5">
                  Speaker (Output)
                </label>
                <div className="relative">
                  <Volume2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                  <select
                    value={selectedOutputId}
                    onChange={(e) => switchOutputDevice(e.target.value)}
                    disabled={audioOutputs.length === 0}
                    className="w-full bg-surface-elevated border border-border-subtle rounded-xl pl-8 pr-3 py-2 text-xs text-text-primary appearance-none cursor-pointer hover:border-civic/40 focus:border-civic focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {audioOutputs.length === 0 ? (
                      <option value="default">System Default (browser-managed)</option>
                    ) : (
                      audioOutputs.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
                </div>
                {audioOutputs.length === 0 && (
                  <p className="text-[9px] text-text-muted mt-1">
                    Output device selection requires a Chromium-based browser (Chrome, Edge, Brave).
                  </p>
                )}
              </div>

              {deviceError && (
                <p className="text-xs text-danger-light">{deviceError}</p>
              )}

              {/* Test output button */}
              <button
                onClick={() => {
                  const el = audioOutputRef.current;
                  if (el) {
                    el.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAA';
                    el.play().catch(() => {});
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-text-muted bg-surface-active rounded-xl hover:bg-surface-hover transition-colors"
              >
                <Volume2 className="w-3 h-3" />
                Test Speaker
              </button>
            </div>
          )}

          {/* ── Controls ── */}
          <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
            {!joined && !isDebater ? (
              /* Spectators can listen in (receive-only, no mic needed) */
              <button
                onClick={listenIn}
                disabled={loading || debateStatus === 'completed'}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-civic-subtle text-civic-light rounded-xl hover:bg-civic-muted disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                Listen In (no mic needed)
              </button>
            ) : !joined ? (
              <button
                onClick={joinRoom}
                disabled={loading || debateStatus === 'completed'}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold bg-positive text-white rounded-xl hover:bg-positive-light disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />}
                Join Voice (mic required)
              </button>
            ) : (
              <>
                {/* Speaker controls: mute, camera, settings */}
                {isSpeaker && (
                  <>
                    <button
                      onClick={() => voiceAction('toggle_mute')}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors',
                        isSelfMuted
                          ? 'bg-surface text-text-muted border border-border-subtle hover:bg-surface-hover'
                          : 'bg-positive/15 text-positive-light hover:bg-positive/25',
                      )}
                    >
                      {isSelfMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      {isSelfMuted ? 'Unmute' : 'Mute'}
                    </button>

                    <button
                      onClick={toggleCamera}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-colors',
                        cameraEnabled
                          ? 'bg-civic-muted text-civic-light hover:bg-civic/25'
                          : 'bg-surface text-text-muted border border-border-subtle hover:bg-surface-hover',
                      )}
                    >
                      {cameraEnabled ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}
                      {cameraEnabled ? 'Cam On' : 'Cam Off'}
                    </button>

                    <button
                      onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                      className={clsx(
                        'p-2 rounded-xl transition-colors',
                        showDeviceSettings
                          ? 'bg-civic-muted text-civic'
                          : 'text-text-muted hover:text-text-primary hover:bg-surface-hover',
                      )}
                      title="Audio device settings"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                {/* Listener controls: raise hand only */}
                {!isSpeaker && !isPending && (
                  <button
                    onClick={() => voiceAction('request_speak')}
                    disabled={actionLoading === 'request_speak'}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-warning/15 text-warning-light rounded-xl hover:bg-warning/25 transition-colors"
                  >
                    <Hand className="w-3.5 h-3.5" />
                    Raise Hand
                  </button>
                )}

                {isPending && (
                  <span className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-warning-light bg-warning/10 rounded-xl">
                    <Hand className="w-3.5 h-3.5 animate-pulse" />
                    Hand raised
                  </span>
                )}

                {/* Listening indicator for non-speakers */}
                {!isSpeaker && (
                  <span className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-text-muted bg-surface-active rounded-lg">
                    <Volume2 className="w-3 h-3" />
                    Listening
                  </span>
                )}

                {/* Leave — always visible */}
                <button
                  onClick={leaveRoom}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-danger/10 text-danger-light rounded-xl hover:bg-danger/20 transition-colors ml-auto"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  Leave
                </button>
              </>
            )}

            {/* Host: Mute All & Disable */}
            {isCreator && joined && (
              <>
                <button
                  onClick={() => voiceAction('mute_all')}
                  className="p-2 text-text-muted hover:text-warning-light hover:bg-warning/10 rounded-xl transition-colors"
                  title="Mute all speakers"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={disableVoice}
                  className="p-2 text-text-muted hover:text-danger-light hover:bg-danger/10 rounded-xl transition-colors"
                  title="Disable voice chat"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          {error && (
            <p className="text-xs text-danger-light text-center">{error}</p>
          )}

          {/* ── Info note ── */}
          <p className="text-[9px] text-text-muted text-center leading-relaxed">
            Voice &amp; video is peer-to-peer (WebRTC). Audio/video is encrypted in transit (DTLS-SRTP).
            No recordings are stored. Microphone permission is required to join.
          </p>
        </div>
      )}

      {/* Hidden audio element for output device routing */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioOutputRef} className="hidden" />

      {/* Remote audio playback — one <audio> per remote peer stream.
          sinkId routes output to the selected speaker (previously only
          the hidden placeholder element got setSinkId, so switching
          output devices audibly did nothing). */}
      {Array.from(remoteStreams.entries()).map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} sinkId={selectedOutputId} />
      ))}
    </div>
  );
}

// ─── VoiceAvatar ────────────────────────────────────────────────

function VoiceAvatar({
  participant,
  isCreator,
  isHost,
  currentUserId,
  isSpeakingNow,
  onRevoke,
  onServerMute,
}: {
  participant: VoiceParticipant;
  isCreator: boolean;
  isHost: boolean;
  currentUserId: string;
  isSpeakingNow: boolean;
  onRevoke: () => void;
  onServerMute: () => void;
}) {
  const isMuted = participant.isMuted || participant.isServerMuted;
  const isMe = participant.userId === currentUserId;
  const initials = participant.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2);

  // Determine visual state:
  //   - Speaking (green glow + ring pulse)
  //   - Unmuted but silent (green ring, no pulse)
  //   - Muted (grey, no ring)
  const visualState = isSpeakingNow && !isMuted ? 'speaking' : isMuted ? 'muted' : 'silent';

  return (
    <div className="flex flex-col items-center gap-1 group relative">
      {/* Outer ring — audio-reactive glow when speaking */}
      <div className="relative">
        {visualState === 'speaking' && (
          <div
            className="absolute -inset-1 rounded-xl opacity-60"
            style={{
              background: 'radial-gradient(circle, rgba(34,197,94,0.3) 0%, transparent 70%)',
              animation: 'breathe 1.2s ease-in-out infinite',
            }}
          />
        )}
        <div
          className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold relative transition-all duration-300',
            visualState === 'speaking'
              ? 'bg-positive/20 text-positive-light ring-2 ring-positive scale-[1.04]'
              : visualState === 'silent'
                ? 'bg-positive/10 text-positive-light ring-2 ring-positive/25'
                : 'bg-surface-active text-text-muted',
          )}
          style={visualState === 'speaking' ? {
            boxShadow: '0 0 16px rgba(34,197,94,0.4), 0 0 32px rgba(34,197,94,0.15)',
          } : undefined}
        >
          {initials}
          {isHost && (
            <Crown className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-warning" />
          )}
          {/* Mute / speaking indicator badge */}
          <div className={clsx(
            'absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center transition-colors duration-300',
            visualState === 'speaking' ? 'bg-positive' :
            visualState === 'silent' ? 'bg-positive/70' :
            'bg-danger',
          )}>
            {isMuted
              ? <MicOff className="w-2.5 h-2.5 text-white" />
              : <Mic className={clsx('w-2.5 h-2.5 text-white', visualState === 'speaking' && 'animate-pulse')} />
            }
          </div>
        </div>
      </div>

      {/* Name + speaking label */}
      <span className={clsx(
        'text-[9px] text-center truncate w-full transition-colors duration-300',
        visualState === 'speaking' ? 'text-positive-light font-semibold' : 'text-text-muted',
      )}>
        {isMe ? (visualState === 'speaking' ? 'You (speaking)' : 'You') : participant.displayName.split(' ')[0]}
      </span>

      {/* Host controls on hover */}
      {isCreator && !isMe && (
        <div className="absolute -top-1 -right-1 hidden group-hover:flex items-center gap-0.5 bg-surface-elevated border border-border-subtle rounded-xl shadow-md p-0.5 z-10">
          <button onClick={onServerMute} className="p-0.5 text-text-muted hover:text-warning-light" title="Server mute">
            <VolumeX className="w-3 h-3" />
          </button>
          <button onClick={onRevoke} className="p-0.5 text-text-muted hover:text-danger-light" title="Revoke speaking">
            <MicOff className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── RemoteAudio ─────────────────────────────────────────────────
// Hidden audio element that plays a remote peer's audio stream.
// Explicitly calls play() to handle iOS autoplay restrictions.

function RemoteAudio({ stream, sinkId }: { stream: MediaStream; sinkId?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Route playback to the selected output device (Chromium only —
  // setSinkId is a no-op elsewhere).
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !sinkId || sinkId === 'default') return;
    if ('setSinkId' in el) {
      (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
        .setSinkId(sinkId)
        .catch(() => { /* unsupported or revoked device — keep default */ });
    }
  }, [sinkId]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;

    el.srcObject = stream;

    // Explicitly call play() — iOS blocks autoPlay for streams arriving
    // outside a user-gesture call stack (e.g. WebRTC ontrack events)
    const tryPlay = () => {
      el.play().catch(() => {
        // Autoplay blocked — retry on next user interaction
        const resume = () => {
          el.play().catch(() => {});
          document.removeEventListener('touchstart', resume);
          document.removeEventListener('click', resume);
        };
        document.addEventListener('touchstart', resume, { once: true });
        document.addEventListener('click', resume, { once: true });
      });
    };

    tryPlay();

    // If stream gets new tracks added later, re-trigger play
    const onTrackAdded = () => tryPlay();
    stream.addEventListener('addtrack', onTrackAdded);

    return () => {
      stream.removeEventListener('addtrack', onTrackAdded);
    };
  }, [stream]);

  // eslint-disable-next-line jsx-a11y/media-has-caption
  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

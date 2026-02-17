'use client';

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Swords,
  Clock,
  Tag,
  Loader2,
  ArrowLeftRight,
  Plus,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

interface CreateDebateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (debate: unknown) => void;
}

const IDEOLOGY_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center-left', label: 'Center-Left' },
  { value: 'center', label: 'Center' },
  { value: 'center-right', label: 'Center-Right' },
  { value: 'right', label: 'Right' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
];

const TOPIC_SUGGESTIONS = [
  'economy', 'healthcare', 'climate', 'education', 'immigration',
  'technology', 'elections', 'criminal-justice', 'housing', 'defense',
  'taxation', 'free-speech', 'energy', 'infrastructure', 'regulation',
];

export function CreateDebateModal({ isOpen, onClose, onCreated }: CreateDebateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sideALabel, setSideALabel] = useState('');
  const [sideBLabel, setSideBLabel] = useState('');
  const [sideAIdeology, setSideAIdeology] = useState('center-left');
  const [sideBIdeology, setSideBIdeology] = useState('center-right');
  const [creatorSide, setCreatorSide] = useState<'A' | 'B'>('A');
  const [duration, setDuration] = useState(30);
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTopic = (topic: string) => {
    const t = topic.trim().toLowerCase();
    if (t && !topics.includes(t) && topics.length < 5) {
      setTopics([...topics, t]);
    }
    setTopicInput('');
  };

  const removeTopic = (t: string) => setTopics(topics.filter((x) => x !== t));

  const isValid = title.trim().length >= 5 && sideALabel.trim().length > 0 && sideBLabel.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          sideA: { label: sideALabel.trim(), ideology: sideAIdeology },
          sideB: { label: sideBLabel.trim(), ideology: sideBIdeology },
          topics,
          durationMinutes: duration,
          creatorSide,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create debate.');
      }
      const data = await res.json();
      onCreated?.(data.debate);
      // Reset
      setTitle('');
      setDescription('');
      setSideALabel('');
      setSideBLabel('');
      setTopics([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, title, description, sideALabel, sideAIdeology, sideBLabel, sideBIdeology, topics, duration, creatorSide, onCreated, onClose]);

  if (!isOpen) return null;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" style={{ pointerEvents: 'auto' }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-xl bg-[var(--surface-elevated,#151821)] sm:rounded-2xl border border-border-subtle max-h-[90vh] overflow-hidden flex flex-col animate-slide-up rounded-t-2xl sm:rounded-b-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-civic-light" />
            <h2 className="text-base font-bold text-text-primary">Create a Debate</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger-light">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
              Debate Title <span className="text-danger-light">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="e.g., Should the US Adopt Universal Basic Income?"
              className="w-full bg-surface rounded-lg border border-border-subtle p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic/40 transition-colors"
            />
            <p className="text-[11px] text-text-muted mt-1">{title.length}/120 — frame it as a clear question</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Brief context for the debate..."
              className="w-full bg-surface rounded-lg border border-border-subtle p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic/40 transition-colors resize-none"
            />
          </div>

          {/* Sides */}
          <div>
            <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
              Debate Sides <span className="text-danger-light">*</span>
            </label>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
              {/* Side A */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={sideALabel}
                  onChange={(e) => setSideALabel(e.target.value)}
                  maxLength={40}
                  placeholder="Side A label..."
                  className="w-full bg-surface rounded-lg border border-border-subtle p-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic/40"
                />
                <select
                  value={sideAIdeology}
                  onChange={(e) => setSideAIdeology(e.target.value)}
                  className="w-full bg-surface rounded-lg border border-border-subtle p-2 text-xs text-text-secondary focus:outline-none"
                >
                  {IDEOLOGY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button
                  onClick={() => setCreatorSide('A')}
                  className={clsx(
                    'w-full text-[11px] font-medium py-1.5 rounded-lg border transition-colors',
                    creatorSide === 'A'
                      ? 'border-civic/40 bg-civic/10 text-civic-light'
                      : 'border-border-subtle text-text-muted hover:text-text-secondary',
                  )}
                >
                  {creatorSide === 'A' ? 'You\u2019re on this side' : 'Join this side'}
                </button>
              </div>

              {/* VS divider */}
              <div className="flex flex-col items-center justify-center gap-1 pt-2">
                <ArrowLeftRight className="w-4 h-4 text-text-muted" />
                <span className="text-[10px] text-text-muted font-bold">VS</span>
              </div>

              {/* Side B */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={sideBLabel}
                  onChange={(e) => setSideBLabel(e.target.value)}
                  maxLength={40}
                  placeholder="Side B label..."
                  className="w-full bg-surface rounded-lg border border-border-subtle p-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic/40"
                />
                <select
                  value={sideBIdeology}
                  onChange={(e) => setSideBIdeology(e.target.value)}
                  className="w-full bg-surface rounded-lg border border-border-subtle p-2 text-xs text-text-secondary focus:outline-none"
                >
                  {IDEOLOGY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button
                  onClick={() => setCreatorSide('B')}
                  className={clsx(
                    'w-full text-[11px] font-medium py-1.5 rounded-lg border transition-colors',
                    creatorSide === 'B'
                      ? 'border-civic/40 bg-civic/10 text-civic-light'
                      : 'border-border-subtle text-text-muted hover:text-text-secondary',
                  )}
                >
                  {creatorSide === 'B' ? 'You\u2019re on this side' : 'Join this side'}
                </button>
              </div>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5" />
              Duration
            </label>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                    duration === opt.value
                      ? 'border-civic/40 bg-civic/10 text-civic-light'
                      : 'border-border-subtle text-text-muted hover:text-text-secondary',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
              <Tag className="w-3.5 h-3.5" />
              Topics (up to 5)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {topics.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[11px] font-medium text-civic-light bg-civic/8 px-2.5 py-1 rounded-full">
                  #{t}
                  <button onClick={() => removeTopic(t)} className="hover:text-danger-light"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(topicInput); } }}
                placeholder="Type a topic..."
                className="flex-1 bg-surface rounded-lg border border-border-subtle p-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-civic/40"
              />
              <button
                onClick={() => addTopic(topicInput)}
                disabled={!topicInput.trim() || topics.length >= 5}
                className="p-2 rounded-lg bg-surface-elevated border border-border-subtle text-text-muted hover:text-civic-light disabled:opacity-40 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {topics.length < 3 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TOPIC_SUGGESTIONS.filter((s) => !topics.includes(s)).slice(0, 8).map((s) => (
                  <button
                    key={s}
                    onClick={() => addTopic(s)}
                    className="text-[10px] text-text-muted hover:text-civic-light bg-surface px-2 py-0.5 rounded-full border border-border-subtle hover:border-civic/30 transition-colors"
                  >
                    +{s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className={clsx(
              'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all',
              isValid && !submitting
                ? 'bg-civic text-white hover:bg-civic-dark active:scale-[0.98]'
                : 'bg-surface-active text-text-muted cursor-not-allowed',
            )}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
            Create Debate
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(modal, document.body);
}

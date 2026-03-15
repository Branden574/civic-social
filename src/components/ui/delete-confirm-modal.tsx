'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Trash2,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  X,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Delete Confirm Modal — Portal-Rendered, Fully Accessible
// ═══════════════════════════════════════════════════════════════
//
// Renders via createPortal to document.body so it escapes all
// parent stacking contexts (animations, transforms, overflow).
// Uses z-[9999] to sit above everything in the app.
// Locks body scroll, traps focus, supports ESC to close.
// ═══════════════════════════════════════════════════════════════

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
  contentPreview: string;
  error?: string | null;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  deleting,
  contentPreview,
  error,
}: DeleteConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // ── Lock body scroll when open ──────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // ── Focus trap + ESC key ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Focus the cancel button on open
    setTimeout(() => cancelRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        e.preventDefault();
        onClose();
        return;
      }

      // Trap Tab inside modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, deleting, onClose]);

  // ── Backdrop click ──────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !deleting) {
        onClose();
      }
    },
    [deleting, onClose],
  );

  if (!isOpen) return null;

  // ── Portal render to document.body ──────────────────────
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ pointerEvents: 'auto' }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      aria-describedby="delete-modal-desc"
    >
      {/* Backdrop — fully opaque, blocks all interaction */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ pointerEvents: 'auto' }}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={modalRef}
        className="relative w-full max-w-sm bg-[var(--surface-elevated,#151821)] rounded-2xl border border-[var(--border,#2a2e3a)] shadow-2xl p-6 space-y-4"
        style={{ pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={deleting}
          className="absolute top-3 right-3 p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-danger-light" />
          </div>
          <h3 id="delete-modal-title" className="text-base font-bold text-text-primary">
            Delete This Post?
          </h3>
          <p id="delete-modal-desc" className="text-sm text-text-muted leading-relaxed">
            This will{' '}
            <strong className="text-text-secondary">permanently delete</strong>{' '}
            your post and wipe all associated data including reactions, replies,
            and analytics. This action cannot be undone.
          </p>
        </div>

        {/* Content preview */}
        <div className="bg-surface/50 rounded-xl border border-border-subtle p-3">
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
            {contentPreview.slice(0, 150)}
            {contentPreview.length > 150 ? '...' : ''}
          </p>
        </div>

        {/* Privacy assurance */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-positive/5 border border-positive/15">
          <ShieldCheck className="w-4 h-4 text-positive-light shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted leading-relaxed">
            Your content will be fully wiped from our servers. No residual data
            will remain that could be extracted or recovered.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20">
            <p className="text-xs text-danger-light font-medium">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={deleting}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-text-secondary bg-surface-elevated rounded-xl border border-border-subtle hover:bg-surface-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-danger rounded-xl hover:bg-danger/80 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete Forever
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

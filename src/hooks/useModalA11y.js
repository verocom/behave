import { useEffect, useRef } from 'react';

// Reference-counted so overlapping modals (e.g. a confirm sheet closing in the same
// tick another modal opens) can never leave body scroll stuck locked — each lock/unlock
// is paired 1:1 with an effect run, regardless of how many modals are open at once or
// in what order they close.
let lockCount = 0;
function lockScroll() {
  lockCount++;
  if (lockCount === 1) document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = '';
}

export function useModalA11y(open, onCancel) {
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return undefined;
    triggerRef.current = document.activeElement;
    const modal = modalRef.current;
    lockScroll();
    const focusable = () => modal?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [];
    const first = focusable()[0];
    first?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = [...focusable()];
      if (!nodes.length) return;
      const current = document.activeElement;
      const index = nodes.indexOf(current);
      const next = event.shiftKey
        ? (index <= 0 ? nodes[nodes.length - 1] : nodes[index - 1])
        : (index === nodes.length - 1 ? nodes[0] : nodes[index + 1]);
      event.preventDefault();
      next.focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
      triggerRef.current?.focus?.();
    };
  }, [open]);

  return modalRef;
}

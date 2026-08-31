import { useEffect, useRef } from 'react';

export function useModalA11y(open, onCancel) {
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return undefined;
    triggerRef.current = document.activeElement;
    const modal = modalRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
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
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus?.();
    };
  }, [open]);

  return modalRef;
}

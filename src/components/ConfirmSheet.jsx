import { useModalA11y } from '../hooks/useModalA11y';

export default function ConfirmSheet({ open, title, body, confirmLabel, cancelLabel, danger = false, disabled = false, onConfirm, onCancel, children }) {
  const modalRef = useModalA11y(open, onCancel);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel}>
      <div ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-sheet-title" onClick={event => event.stopPropagation()}>
        <div className="modal-handle"/>
        <div id="confirm-sheet-title" className="modal-title">{title}</div>
        {body && <p className="onb-body">{body}</p>}
        {children}
        <div className="modal-actions">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} style={{ flex: 2 }} onClick={onConfirm} disabled={disabled}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

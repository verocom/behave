import { useModalA11y } from '../hooks/useModalA11y';

export default function LegalSheet({ open, title, sections, closeLabel, onCancel }) {
  const modalRef = useModalA11y(open, onCancel);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel}>
      <div ref={modalRef} className="modal legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-sheet-title" onClick={event => event.stopPropagation()}>
        <div className="modal-handle"/>
        <div id="legal-sheet-title" className="modal-title">{title}</div>
        {sections.map(section => <section key={section.heading} className="legal-section"><h3>{section.heading}</h3><p>{section.body}</p></section>)}
        <div className="modal-actions"><button className="btn btn-primary btn-full" onClick={onCancel}>{closeLabel}</button></div>
      </div>
    </div>
  );
}

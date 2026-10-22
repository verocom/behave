import { useState } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
import { COPING_CATEGORIES, COPING_TECHNIQUES } from '../copingToolkit';
import { prioritizeTechniques } from '../challenges';

export default function CopingToolkitModal({ open, t, favorites, onToggleFavorite, onCancel, priorityTagIds }) {
  const modalRef = useModalA11y(open, onCancel);
  const [expandedId, setExpandedId] = useState(null);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel}>
      <div ref={modalRef} className="modal legal-modal" role="dialog" aria-modal="true" aria-labelledby="coping-toolkit-title" onClick={event => event.stopPropagation()}>
        <div className="modal-handle"/>
        <div id="coping-toolkit-title" className="modal-title">🧰 {t.copingToolkit}</div>
        <p className="onb-body">{t.copingToolkitIntro}</p>
        {COPING_CATEGORIES.map(cat => (
          <section key={cat} className="legal-section">
            <h3>{t.copingCategories[cat]}</h3>
            {prioritizeTechniques(COPING_TECHNIQUES.filter(tc => tc.category === cat), priorityTagIds).map(tc => {
              const tech = t.copingTechniques[tc.id];
              const isFav = favorites?.includes(tech.title);
              const isOpen = expandedId === tc.id;
              return (
                <div key={tc.id} className="behavior-item" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer' }} onClick={() => setExpandedId(isOpen ? null : tc.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="behavior-name">{tech.title}</div>
                    <button className="entry-delete" onClick={event => { event.stopPropagation(); onToggleFavorite(tech.title); }} aria-label={isFav ? t.favoriteRemove : t.favoriteAdd}>
                      {isFav ? '★' : '☆'}
                    </button>
                  </div>
                  {isOpen && <p className="technique-howto">{tech.how}</p>}
                </div>
              );
            })}
          </section>
        ))}
        <p className="legal-links" style={{ marginTop: 18 }}>{t.copingCrisisNote}</p>
        <div className="modal-actions"><button className="btn btn-primary btn-full" onClick={onCancel}>{t.close}</button></div>
      </div>
    </div>
  );
}

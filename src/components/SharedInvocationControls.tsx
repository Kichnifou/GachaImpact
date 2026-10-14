import { useEffect, useState } from 'react';
import type { SharedInvocationList } from '../api/shared-invocations-types';
import { sharedInvocationEmojis } from '../api/shared-invocations-types';
import type { SharedInvocationController } from '../gacha/use-shared-invocations';
import { useModalDialog } from './useModalDialog';
import CharacterAssetImage from './CharacterAssetImage';
import { apiErrorMessage } from '../utils/formatters';
import './shared-invocations.css';
export default function SharedInvocationControls({ shared, presenting=false }: {
    shared: SharedInvocationController;
    presenting?: boolean;
}) {
    const [open, setOpen] = useState(false);
    if (!shared.enabled)
        return null;
    const own = shared.state.broadcasting, watching = shared.state.watching;
    const showIdle=!own&&!watching&&!presenting;
    if(!own&&!watching&&presenting&&!shared.personalError)return null;
    return <div data-tutorial-anchor="invocation-shared" className="shared-invocation-controls">
  <div className="shared-invocation-buttons">
   {(own||showIdle)&&<button type="button" className={`banner-change-button shared-invocation-button${own ? ' is-live' : ''}`} disabled={shared.pending || !!own && !own.authoritative} aria-pressed={!!own} title={own ? undefined : 'Votre scène, résultats, pity, garantie et Capture seront visibles aux joueurs connectés.'} onClick={() => void (own ? shared.stop() : shared.start())}>{own ? '● En diffusion' : 'Diffuser'}</button>}
   {(watching||showIdle)&&<button type="button" className={`banner-change-button shared-invocation-button${watching ? ' is-live' : ''}`} disabled={shared.pending} onClick={() => watching ? void shared.watch(null) : setOpen(true)}>{watching ? 'Arrêter' : 'Voir'}</button>}
  </div>
  {showIdle && <small>Diffusez vos invocations, ou visionnez celles des autres joueurs</small>}
  {watching && <div className="shared-invocation-reactions" aria-label="Réagir à la diffusion">{sharedInvocationEmojis.map(emoji => <button type="button" className="banner-change-button" disabled={shared.pending || shared.reactionCooling} key={emoji} onClick={() => void shared.react(emoji)} aria-label={`Réagir ${emoji}`}>{emoji}</button>)}</div>}
  {shared.personalReady===false&&!watching&&shared.personalError&&<button className="shared-recovery-link" type="button" onClick={()=>void shared.refreshPersonal()}>Réessayer l’actualisation</button>}
  {shared.error && <p role="status" className="shared-invocation-error">{shared.error}</p>}
  {open && <SessionPicker shared={shared} onClose={() => setOpen(false)}/>}
 </div>;
}
function SessionPicker({ shared, onClose }: {
    shared: SharedInvocationController;
    onClose: () => void;
}) {
    const ref = useModalDialog<HTMLElement>(onClose), [list, setList] = useState<SharedInvocationList>({ sessions: [] }), [loading, setLoading] = useState(true), [error, setError] = useState('');
    useEffect(() => {
        let disposed = false, timer: ReturnType<typeof setTimeout>;
        const read = async () => {
            try {
                const value = await shared.api!.list();
                if (!disposed) {
                    setList(value);
                    setError('');
                }
            }
            catch (e) {
                if (!disposed)
                    setError(apiErrorMessage(e));
            }
            finally {
                if (!disposed) {
                    setLoading(false);
                    timer = setTimeout(read, 5000);
                }
            }
        };
        void read();
        return () => {
            disposed = true;
            clearTimeout(timer);
        };
    }, [shared.api]);
    return <div className="history-modal-overlay" onMouseDown={onClose}><section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="shared-invocation-picker-title" className="panel shared-invocation-picker" onMouseDown={e => e.stopPropagation()}>
  <header><h2 id="shared-invocation-picker-title">Invocations en direct</h2><button className="icon-button" type="button" onClick={onClose} aria-label="Fermer"><span className="icon-glyph">×</span></button></header>
  <div className="shared-invocation-picker-body">{loading ? <p>Recherche des diffusions…</p> : list.sessions.length === 0 ? <p>Aucune diffusion disponible.</p> : list.sessions.map(session => <button className="shared-invocation-session" type="button" disabled={shared.pending} key={session.id} onClick={() => void shared.watch(session.id).then(ok => {
                if (ok)
                    onClose();
            })}><CharacterAssetImage className="shared-avatar" assetPaths={[session.avatarPath]} characterName={session.displayName} fallback={<span aria-hidden="true">✦</span>} alt=""/><span>{session.displayName}<small>{session.status === 'PAUSED' ? 'En pause' : '● En direct'}</small></span></button>)}{error && <p role="alert">{error}</p>}</div>
 </section></div>;
}

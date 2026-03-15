import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function ChallengeDetail() {
  const { id } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [flag, setFlag] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hints, setHints] = useState([]);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [totalHints, setTotalHints] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [requestingHint, setRequestingHint] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getChallenge(id);
        if (!cancelled) {
          const c = data.challenge;
          setChallenge(c);
          setHints(c.hints || []);
          setHintsRevealed(c.hintsRevealed || 0);
          setTotalHints(c.totalHints || 0);
          setHintUsed(c.hintUsed || false);
        }
      } catch {
        if (!cancelled) setChallenge(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!flag.trim() || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const data = await api.submitFlag(id, flag.trim());
      setResult(data);
      if (data.correct) setFlag('');
    } catch (err) {
      setResult({ correct: false, message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestHint() {
    const isFirst = !hintUsed;
    if (isFirst) {
      const penalty = challenge.hintPenalty || 0.5;
      const penaltyPct = Math.round(penalty * 100);
      const pointsLost = Math.floor(challenge.points * penalty);
      const remaining = challenge.points - pointsLost;
      const confirmed = window.confirm(
        `Requesting a hint will cost ${penaltyPct}% of this challenge's points.\n\n` +
        `Points: ${challenge.points} -> ${remaining} (lose ${pointsLost} pts)\n\n` +
        `This cannot be undone. Continue?`
      );
      if (!confirmed) return;
    }

    setRequestingHint(true);
    try {
      const data = await api.requestHint(id);
      setHints(data.hints);
      setHintsRevealed(data.hintsRevealed);
      setHintUsed(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setRequestingHint(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
        <span>Loading challenge...</span>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="page">
        <div className="container">
          <div className="empty-state">
            <p style={{ marginBottom: '1rem' }}>Challenge not found.</p>
            <Link to="/challenges" className="btn btn-ghost">Back to Challenges</Link>
          </div>
        </div>
      </div>
    );
  }

  const penalty = challenge.hintPenalty || 0.5;
  const penalizedPoints = Math.floor(challenge.points * (1 - penalty));
  const effectivePoints = hintUsed ? penalizedPoints : challenge.points;
  const moreHintsAvailable = hintsRevealed < totalHints;

  return (
    <div className="page" style={{ paddingBottom: '4rem' }}>
      <div className="container animate-in" style={{ maxWidth: '1280px', margin: '0 auto' }}>
        
        {/* Top Banner Area */}
        <div style={{ padding: '0 0.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Link to="/challenges" className="btn btn-ghost btn-sm" style={{ padding: '0.4rem 0.5rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <div style={{ fontSize: '0.9rem', color: 'var(--c-text-3)', fontWeight: 600 }}>
              <Link to="/challenges" style={{ color: 'inherit', textDecoration: 'none' }}>Challenges</Link>
              <span style={{ margin: '0 0.5rem' }}>/</span>
              <span style={{ color: 'var(--c-text-1)' }}>{challenge.title}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '2rem', background: 'rgba(15,23,42,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
              <div style={{ 
                width: 64, height: 64, borderRadius: '50%', background: 'var(--c-bg-0)', 
                border: '2px solid var(--c-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                color: 'white', fontWeight: 800, fontSize: '1.2rem', fontFamily: 'var(--font-mono)' 
              }}>
                CTF
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 0.5rem 0', color: 'var(--c-text-0)' }}>
                  {challenge.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--c-text-2)', fontWeight: 600 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>System</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--c-text-2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span className="mono">Runtime Data</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1px',
              background: 'var(--c-border)', marginTop: '2rem', border: '1px solid var(--c-border)', borderRadius: 'var(--radius)', overflow: 'hidden'
            }}>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--c-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Challenge Details
              </div>
              <div style={{ background: 'rgba(15,23,42,0.8)', padding: '0.75rem', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, color: 'var(--c-text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Solves ({challenge.solveCount})
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Layout layout */}
        <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start', padding: '0 0.5rem' }}>
          
          {/* Left Column (Description & Flag) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
              <div className="section-label" style={{ fontSize: '1.05rem', color: 'var(--c-text-0)' }}>Challenge Description</div>
              
              {challenge.description && (
                <div className="detail-desc" style={{ fontSize: '1.05rem', lineHeight: 1.8, background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.03)' }}>
                  {challenge.description}
                </div>
              )}
              
              <div style={{ flex: 1 }} />
              
              <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid var(--c-border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--c-text-3)', marginBottom: '1rem' }}>Submit Flag</div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="flag{...}"
                    value={flag}
                    onChange={(e) => setFlag(e.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)', padding: '1rem' }}
                  />
                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{ whiteSpace: 'nowrap', padding: '0 2rem' }}>
                    {submitting ? '...' : 'Submit'}
                  </button>
                </form>

                {result && (
                  <div className={`flag-result ${result.correct ? 'flag-correct' : 'flag-incorrect'}`} style={{ marginTop: '1rem' }}>
                    {result.correct && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                    {!result.correct && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                    {result.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (Info, Hints, Files) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Details Card */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div className="section-label" style={{ fontSize: '0.95rem', color: 'var(--c-text-0)', marginBottom: '1.5rem' }}>Challenge Details</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--c-text-3)', fontWeight: 600 }}>Points</span>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {hintUsed ? (
                      <div>
                        <span style={{ textDecoration: 'line-through', color: 'var(--c-text-3)', fontSize: '0.9rem', marginRight: '0.5rem' }}>{challenge.points}</span>
                        <span className="mono" style={{ color: 'var(--c-cyan)', fontWeight: 700 }}>{effectivePoints}</span>
                      </div>
                    ) : (
                      <span className="mono" style={{ color: 'var(--c-cyan)', fontWeight: 700 }}>{challenge.points}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--c-text-3)', fontWeight: 600 }}>Difficulty</span>
                  <div><span className={`badge badge-${challenge.difficulty}`}>{challenge.difficulty}</span></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--c-text-3)', fontWeight: 600 }}>Category</span>
                  <div><span className="badge" style={{ background: 'var(--c-bg-2)', border: '1px solid var(--c-border)' }}>{challenge.category}</span></div>
                </div>
              </div>
            </div>

            {/* Hints Card */}
            {totalHints > 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <div className="section-label" style={{ fontSize: '0.95rem', color: 'var(--c-text-0)', marginBottom: '1.25rem' }}>
                  Hints
                </div>

                {hints.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: moreHintsAvailable ? '1.25rem' : 0 }}>
                    {hints.map((hint, i) => (
                      <div key={i} style={{ padding: '0.75rem', background: 'var(--c-bg-1)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--c-border)', fontSize: '0.9rem', color: 'var(--c-text-1)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--c-amber)', marginBottom: '0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hint {i + 1}</div>
                        {hint}
                      </div>
                    ))}
                  </div>
                )}

                {moreHintsAvailable && (
                  <div style={{ padding: '1rem', background: 'rgba(245,158,11,0.05)', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(245,158,11,0.2)' }}>
                    {!hintUsed ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--c-text-2)', marginBottom: '1rem', lineHeight: 1.5 }}>
                        First hint costs <b style={{ color: 'var(--c-amber)' }}>{Math.round(penalty * 100)}%</b> of points. ({challenge.points} → {penalizedPoints} pts)
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--c-text-2)', marginBottom: '1rem' }}>
                        {totalHints - hintsRevealed} more hint{totalHints - hintsRevealed > 1 ? 's' : ''} available.
                      </div>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={handleRequestHint}
                      disabled={requestingHint}
                      style={{ width: '100%', borderColor: 'var(--c-amber)', color: 'var(--c-amber)', background: 'rgba(245,158,11,0.1)' }}
                    >
                      {requestingHint ? 'Requesting...' : hintUsed ? 'Next Hint' : 'Unlock Hint 1'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Attachments Card */}
            {(challenge.files && challenge.files.length > 0) ? (
              <div className="card" style={{ padding: '1.5rem' }}>
                <div className="section-label" style={{ fontSize: '0.95rem', color: 'var(--c-text-0)', marginBottom: '1.25rem' }}>File Attachments</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {challenge.files.map((file, i) => {
                    const url = typeof file === 'string' ? file : file.url;
                    const name = typeof file === 'string' ? `File ${i + 1}` : (file.name || `File ${i + 1}`);
                    return (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', padding: '0.75rem', background: 'var(--c-bg-1)' }} download>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '1.5rem', background: 'rgba(15,23,42,0.3)', border: '1px dashed var(--c-border)' }}>
                 <div className="section-label" style={{ fontSize: '0.95rem', color: 'var(--c-text-2)', marginBottom: '0.5rem' }}>File Attachments</div>
                 <div style={{ fontSize: '0.85rem', color: 'var(--c-text-3)', fontStyle: 'italic' }}>No attachments available.</div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}

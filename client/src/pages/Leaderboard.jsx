import { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const CHART_COLORS = [
  '#06b6d4', '#a855f7', '#22c55e', '#f59e0b', '#ef4444',
  '#ec4899', '#3b82f6', '#14b8a6', '#f97316', '#8b5cf6',
];

export default function Leaderboard() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [chartTeams, setChartTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [totalChallenges, setTotalChallenges] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [lb, tl, teamData] = await Promise.all([
          api.getLeaderboard(),
          api.getTimeline().catch(() => ({ timeline: [], teams: [] })),
          profile?.teamId ? api.getMyTeam().catch(() => ({ team: null })) : Promise.resolve({ team: null }),
        ]);
        setTeams(lb.leaderboard);
        setTotalPoints(lb.totalPoints || 0);
        setTotalChallenges(lb.totalChallenges || 0);
        setTimeline(tl.timeline || []);
        setChartTeams(tl.teams || []);
        setMyTeam(teamData.team);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [profile?.teamId]);

  if (loading) {
    return (
      <div className="loading-page" style={{ minHeight: '60vh' }}>
        <div className="loading-spinner" />
        <span>Loading leaderboard...</span>
      </div>
    );
  }

  const myRank = profile?.teamId ? teams.findIndex((t) => t.id === profile.teamId) + 1 : 0;
  const solvedCount = myTeam?.score ? teams.find((t) => t.id === profile?.teamId) : null;

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 className="page-title">Leaderboard</h1>
          <p className="page-subtitle">Teams ranked by score, then by fastest last solve</p>
        </div>

        {timeline.length > 0 && (
          <div className="card animate-in" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: '1rem' }}>
              Timeline for Top {chartTeams.length} Teams
            </div>
            <TimelineChart timeline={timeline} chartTeams={chartTeams} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: myTeam ? '1fr 300px' : '1fr', gap: '1.5rem', alignItems: 'start' }}>
          <div>
            {teams.length >= 3 && <Podium teams={teams} totalPoints={totalPoints} totalChallenges={totalChallenges} />}

            <div className="card animate-in" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
              <div style={{ padding: '1rem 1.25rem 0.5rem', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--c-text-3)' }}>
                Top Players
              </div>
              <div className="lb-table-wrap">
                <table className="lb-table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Rank</th>
                      <th>Team</th>
                      <th style={{ width: 100 }}>Solves</th>
                      <th style={{ width: 130 }}>Points</th>
                      <th style={{ width: 180 }}>Last Solve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t) => (
                      <tr key={t.id} className={t.rank <= 3 ? ['', 'lb-gold', 'lb-silver', 'lb-bronze'][t.rank] : ''} style={t.id === profile?.teamId ? { background: 'rgba(6,182,212,0.08)' } : undefined}>
                        <td className="lb-rank">#{t.rank}</td>
                        <td className="lb-team">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--c-bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--c-text-3)', flexShrink: 0 }}>
                              {t.teamName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{t.teamName}</div>
                              {t.lastSolveTime && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--c-text-3)' }}>
                                  Last Flag at {new Date(t.lastSolveTime).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: '0.85rem', color: 'var(--c-text-2)' }}>
                          {t.solveCount ?? '--'}/{totalChallenges}
                        </td>
                        <td className="lb-score">{t.score}/{totalPoints}</td>
                        <td className="lb-time">
                          {t.lastSolveTime ? new Date(t.lastSolveTime).toLocaleString() : '\u2014'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {myTeam && (
            <div className="card animate-in" style={{ position: 'sticky', top: '5rem' }}>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--c-bg-2)', margin: '0 auto 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700, color: 'var(--c-cyan)' }}>
                  {myTeam.teamName?.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{myTeam.teamName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--c-text-3)', marginTop: '0.2rem' }}>
                  Team Rank: #{myRank || '--'}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--c-text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                  Progress: {totalPoints > 0 ? Math.round((myTeam.score / totalPoints) * 100) : 0}%
                </div>
                <div style={{ height: 8, background: 'var(--c-bg-2)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalPoints > 0 ? Math.min(100, (myTeam.score / totalPoints) * 100) : 0}%`, background: 'var(--c-cyan)', borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
              </div>

              <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--c-bg-1)', borderRadius: '6px', border: '1px solid var(--c-border)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.3rem', display: 'block' }}>
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
                </svg>
                <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--c-cyan)' }}>
                  {myTeam.score} / {totalPoints}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--c-text-3)', textTransform: 'uppercase', fontWeight: 600 }}>Points</div>
              </div>

              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--c-text-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--c-border)' }}>
                  <span>Members</span>
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--c-text-2)' }}>{myTeam.members?.length || 0}</span>
                </div>
                {myTeam.members?.map((m) => (
                  <div key={m.uid} style={{ padding: '0.25rem 0', paddingLeft: '0.5rem', fontSize: '0.78rem', color: 'var(--c-text-2)' }}>
                    {m.username} {m.uid === myTeam.captainId && <span style={{ fontSize: '0.65rem', color: 'var(--c-cyan)' }}>(Captain)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Podium({ teams, totalPoints, totalChallenges }) {
  const top3 = teams.slice(0, 3);
  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const heights = ['120px', '160px', '100px'];
  const colors = ['var(--c-text-2)', 'var(--c-yellow)', 'var(--c-text-3)'];
  const borderColors = ['rgba(148,163,184,0.3)', 'rgba(251,191,36,0.5)', 'rgba(180,83,9,0.3)'];

  return (
    <div className="animate-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '0.5rem' }}>
      {order.map((t, i) => {
        const isCenter = i === 1;
        return (
          <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: isCenter ? 200 : 160 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: colors[i], marginBottom: '0.3rem', padding: '0.15rem 0.6rem', background: `${borderColors[i]}`, borderRadius: '4px' }}>
              #{t.rank}
            </div>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--c-bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700, color: colors[i], border: `2px solid ${borderColors[i]}`, marginBottom: '0.4rem' }}>
              {t.teamName?.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontWeight: 700, fontSize: isCenter ? '1rem' : '0.9rem', fontFamily: 'var(--font-mono)', textAlign: 'center', marginBottom: '0.15rem', color: 'var(--c-text-1)' }}>
              {t.teamName}
            </div>
            <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--c-text-3)' }}>
              {t.score}/{totalPoints} Pts
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TimelineChart({ timeline, chartTeams }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || timeline.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    const PAD_L = 55, PAD_R = 15, PAD_T = 10, PAD_B = 30;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    ctx.clearRect(0, 0, W, H);

    const timestamps = timeline.map((e) => new Date(e.timestamp).getTime());
    const minT = Math.min(...timestamps);
    const maxT = Math.max(...timestamps);
    const maxScore = Math.max(...timeline.map((e) => e.score), 1);

    const teamTimelines = {};
    for (const t of chartTeams) {
      teamTimelines[t.id] = [{ time: minT, score: 0 }];
    }
    for (const e of timeline) {
      if (teamTimelines[e.teamId]) {
        teamTimelines[e.teamId].push({ time: new Date(e.timestamp).getTime(), score: e.score });
      }
    }

    const xScale = (t) => PAD_L + ((t - minT) / (maxT - minT || 1)) * plotW;
    const yScale = (s) => PAD_T + plotH - (s / (maxScore * 1.1)) * plotH;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const val = Math.round((maxScore * 1.1 / gridLines) * i);
      const y = yScale(val);
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(W - PAD_R, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val.toLocaleString(), PAD_L - 8, y + 4);
    }

    chartTeams.forEach((team, idx) => {
      const points = teamTimelines[team.id];
      if (!points || points.length < 2) return;

      const color = CHART_COLORS[idx % CHART_COLORS.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < points.length; i++) {
        const x = xScale(points[i].time);
        const y = yScale(points[i].score);
        if (i === 0) ctx.moveTo(x, y);
        else {
          ctx.lineTo(x, y);
        }
      }
      const lastPt = points[points.length - 1];
      ctx.lineTo(xScale(maxT), yScale(lastPt.score));
      ctx.stroke();
    });

  }, [timeline, chartTeams]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 250, display: 'block' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem 1.25rem', marginTop: '0.75rem', justifyContent: 'center' }}>
        {chartTeams.map((t, i) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--c-text-2)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
            {t.teamName}
          </div>
        ))}
      </div>
    </div>
  );
}

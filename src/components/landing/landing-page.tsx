'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/landing/landing-nav';

/* ─── Particle Canvas ─────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let animId: number;

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      r: number; alpha: number; color: string;
    }

    let W = 0, H = 0;
    let particles: Particle[] = [];

    function resize() {
      W = canvas!.width = canvas!.offsetWidth;
      H = canvas!.height = canvas!.offsetHeight;
      initParticles();
    }

    function initParticles() {
      particles = Array.from({ length: 70 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .32, vy: (Math.random() - .5) * .32,
        r: Math.random() * 1.6 + .4,
        alpha: Math.random() * .45 + .1,
        color: Math.random() > .55 ? '59,130,246' : '45,212,191',
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 140) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(59,130,246,${(1 - d / 140) * .13})`;
            ctx.lineWidth = .7;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    draw();
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0, opacity: .55 }}
    />
  );
}

/* ─── Landing Page ────────────────────────────────────── */
export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: '#09090f', color: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes gradientDrift { 0% { opacity:1; transform:scale(1) translate(0,0); } 100% { opacity:.85; transform:scale(1.04) translate(-1%,1%); } }
        @keyframes float1 { 0%,100%{transform:translateY(0px) rotate(-.5deg)} 50%{transform:translateY(-12px) rotate(.5deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0px) rotate(.8deg)} 50%{transform:translateY(-18px) rotate(-.4deg)} }
        @keyframes float3 { 0%,100%{transform:translateY(-6px) rotate(-.3deg)} 50%{transform:translateY(8px) rotate(.6deg)} }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        @keyframes billPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes revealUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        .cs-reveal { animation: revealUp .75s cubic-bezier(.4,0,.2,1) forwards; opacity:0; }
        .cs-card { background:rgba(15,17,30,.78); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,.09); border-radius:18px; padding:1.2rem 1.4rem; box-shadow:0 8px 40px rgba(0,0,0,.5); }
        .cs-feat:hover { border-color:rgba(59,130,246,.32)!important; transform:translateY(-6px); box-shadow:0 20px 60px rgba(0,0,0,.4),0 0 30px rgba(59,130,246,.1)!important; }
        .cs-trust:hover { border-color:rgba(45,212,191,.25)!important; transform:translateY(-4px); box-shadow:0 16px 50px rgba(0,0,0,.3),0 0 24px rgba(45,212,191,.07)!important; }
        .cs-pricing:hover { transform:translateY(-6px); box-shadow:0 24px 70px rgba(0,0,0,.4)!important; }
        .shine-btn { position:relative; overflow:hidden; }
        .shine-btn::after { content:''; position:absolute; top:-50%; left:-75%; width:50%; height:200%; background:rgba(255,255,255,.08); transform:skewX(-20deg); transition:left .5s ease; pointer-events:none; }
        .shine-btn:hover::after { left:125%; }
        .bill-pulse { animation: billPulse 1.5s ease-in-out infinite; }
        .dot-pulse { animation: pulseDot 2s ease-in-out infinite; }
        .float-a { animation: float1 6s ease-in-out infinite; }
        .float-b { animation: float2 7s ease-in-out infinite; }
        .float-c { animation: float3 8s ease-in-out infinite; }
        .float-d { animation: float1 5.5s ease-in-out infinite .5s; }
      ` }} />

      {/* NAV */}
      <LandingNav />

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center overflow-hidden" style={{ paddingTop: 100 }}>
        <ParticleCanvas />

        {/* bg pattern */}
        <div className="absolute inset-0" style={{ zIndex: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.025'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        {/* gradient */}
        <div className="absolute inset-0" style={{ zIndex: 0, animation: 'gradientDrift 12s ease-in-out infinite alternate', background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(59,130,246,.12) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 20%, rgba(45,212,191,.08) 0%, transparent 55%), radial-gradient(ellipse 100% 100% at 50% 100%, #09090f 40%, transparent 100%)' }} />

        <div className="relative w-full max-w-[1240px] mx-auto px-8 py-16 grid lg:grid-cols-2 gap-16 items-center" style={{ zIndex: 2 }}>

          {/* Copy */}
          <div className="cs-reveal" style={{ animationDelay: '.1s' }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold tracking-widest uppercase" style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: '#60a5fa' }}>
              <span className="dot-pulse w-2 h-2 rounded-full inline-block" style={{ background: '#2dd4bf', width: 7, height: 7 }} />
              Now in early access
            </div>

            <h1 style={{ fontSize: 'clamp(2.4rem,4.5vw,3.8rem)', fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1.1, marginBottom: '1.5rem', background: 'linear-gradient(135deg,#f8fafc 0%,rgba(248,250,252,.7) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Civic Social — Where Conversations Meet Context.
            </h1>

            <p style={{ fontSize: 'clamp(1rem,1.6vw,1.2rem)', color: 'rgba(248,250,252,.55)', maxWidth: 480, marginBottom: '2.5rem', lineHeight: 1.7 }}>
              Post freely. Stay informed. Track real legislation in real time—without the noise.
            </p>

            <div className="flex gap-4 flex-wrap mb-5">
              <Link href="/register" className="shine-btn inline-flex items-center px-8 py-3.5 font-semibold text-white rounded-xl transition-all" style={{ background: '#3b82f6', borderRadius: 14, boxShadow: '0 0 24px rgba(59,130,246,.35)', fontSize: '1rem' }}>
                Create Account
              </Link>
              <Link href="/login" className="shine-btn inline-flex items-center px-8 py-3.5 font-semibold rounded-xl transition-all" style={{ border: '1.5px solid rgba(255,255,255,.12)', color: '#f8fafc', background: 'transparent', borderRadius: 14, fontSize: '1rem' }}>
                Sign In
              </Link>
            </div>

            <p style={{ fontSize: '.8rem', color: '#64748b' }}>Free to join &bull; No credit card required</p>
          </div>

          {/* Floating Cards */}
          <div className="relative hidden lg:block" style={{ height: 560 }}>

            {/* Feed card */}
            <div className="cs-card float-a absolute" style={{ width: 280, top: 20, left: 0, boxShadow: '0 8px 40px rgba(0,0,0,.5),0 0 30px rgba(59,130,246,.08)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.82rem' }}>Sarah Chen <span style={{ color: '#d4a847' }}>✦</span></div>
                  <div style={{ fontSize: '.72rem', color: '#64748b' }}>Policy Analyst · 2m ago</div>
                </div>
              </div>
              <p style={{ fontSize: '.82rem', color: 'rgba(248,250,252,.8)', lineHeight: 1.5, marginBottom: '.75rem' }}>The infrastructure bill just passed committee — here&apos;s what it actually means for broadband access in rural counties...</p>
              <div className="flex gap-4" style={{ color: '#64748b', fontSize: '.78rem' }}><span>◯ 214</span><span>↗ 88</span><span>♡ 1.2k</span></div>
            </div>

            {/* Context card */}
            <div className="cs-card float-b absolute" style={{ width: 240, top: 80, right: 0, boxShadow: '0 8px 40px rgba(0,0,0,.5),0 0 30px rgba(45,212,191,.08)' }}>
              <div className="flex items-center gap-2 mb-3" style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
                <span className="rounded-full" style={{ width: 6, height: 6, background: '#2dd4bf', boxShadow: '0 0 8px #2dd4bf', flexShrink: 0, display: 'inline-block' }} />
                Context Panel
              </div>
              <div className="flex gap-2 mb-2"><span>📄</span><div><div style={{ fontWeight: 600, fontSize: '.8rem' }}>S.1234 Infrastructure Act</div><div style={{ fontSize: '.72rem', color: '#64748b' }}>Passed Senate 67–32 · Nov 2025</div></div></div>
              <div className="flex gap-2"><span>🔗</span><div><div style={{ fontWeight: 600, fontSize: '.8rem' }}>3 Primary Sources</div><div style={{ fontSize: '.72rem', color: '#64748b' }}>CBO · Congress.gov · Reuters</div></div></div>
            </div>

            {/* Bill card */}
            <div className="cs-card float-c absolute" style={{ width: 260, bottom: 100, left: 30, boxShadow: '0 8px 40px rgba(0,0,0,.5),0 0 30px rgba(212,168,71,.08)' }}>
              <div className="flex items-center gap-2 mb-3" style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
                <span className="rounded-full bill-pulse" style={{ width: 6, height: 6, background: '#d4a847', boxShadow: '0 0 8px #d4a847', flexShrink: 0, display: 'inline-block' }} />
                Live Bill Update
              </div>
              <div style={{ fontWeight: 700, fontSize: '.82rem', marginBottom: '.75rem', lineHeight: 1.3 }}>H.R. 5892 — Clean Energy Transition</div>
              <div className="flex gap-1 mb-3">
                {['Introduced', 'Committee', 'Floor Vote', 'Enacted'].map((s, i) => (
                  <div key={s} className={i < 2 ? 'bill-pulse' : ''} style={{ flex: 1, textAlign: 'center', padding: '.25rem .15rem', borderRadius: 6, fontSize: '.6rem', fontWeight: 600, ...(i < 2 ? { background: 'rgba(45,212,191,.12)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,.2)' } : i === 2 ? { background: 'rgba(212,168,71,.15)', color: '#f0c96a', border: '1px solid rgba(212,168,71,.3)' } : { background: 'rgba(255,255,255,.04)', color: '#64748b', border: '1px solid rgba(255,255,255,.07)' }) }}>
                    {s}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '.74rem', color: '#f0c96a' }}>🔔 Vote expected this week</div>
            </div>

            {/* Trending card */}
            <div className="cs-card float-d absolute" style={{ width: 200, bottom: 80, right: 20, boxShadow: '0 8px 40px rgba(0,0,0,.5),0 0 16px rgba(59,130,246,.06)' }}>
              <div className="flex items-center gap-2 mb-3" style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b' }}>
                <span className="rounded-full" style={{ width: 6, height: 6, background: '#3b82f6', boxShadow: '0 0 8px #3b82f6', flexShrink: 0, display: 'inline-block' }} />
                Trending
              </div>
              {[['#ClimatePolicy', '42.1k'], ['#HealthcareReform', '31.8k'], ['#HousingAct', '19.4k']].map(([tag, cnt]) => (
                <div key={tag} className="flex justify-between mb-1" style={{ fontSize: '.78rem' }}>
                  <span style={{ color: '#60a5fa', fontWeight: 600 }}>{tag}</span>
                  <span style={{ color: '#64748b' }}>{cnt}</span>
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ zIndex: 2 }}>
          <span style={{ fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#64748b' }}>Scroll</span>
          <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, #64748b, transparent)' }} />
        </div>
      </section>

      {/* ── PROOF STRIP ─────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', borderBottom: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.015)', padding: '1.5rem 0' }}>
        <div className="flex flex-wrap justify-center items-center gap-0 max-w-6xl mx-auto px-8">
          {[['◎', 'Built for civil discourse'], ['◈', 'Context-first design'], ['⊙', 'Real-time policy tracking'], ['◐', 'Community moderation tools']].map(([icon, txt], i, arr) => (
            <div key={txt} className="flex items-center">
              <div className="flex items-center gap-2 px-6 py-2" style={{ fontSize: '.85rem', fontWeight: 500, color: 'rgba(248,250,252,.55)', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#3b82f6' }}>{icon}</span>{txt}
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.07)' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ────────────────────────────────────────── */}
      <section className="py-24 px-8 max-w-6xl mx-auto">
        <div style={{ color: '#3b82f6', fontSize: '.75rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>Core Features</div>
        <h2 style={{ fontSize: 'clamp(2rem,3.5vw,3rem)', fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>Built different.<br />Because the stakes are different.</h2>
        <p style={{ color: 'rgba(248,250,252,.5)', maxWidth: 560, fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '3.5rem' }}>Every feature is designed to surface signal, reduce noise, and keep discourse grounded in fact.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            ['◈', 'Context Panels', 'Context that follows the conversation. Every post can surface sources, summaries, and linked legislation automatically.'],
            ['⊙', 'Live Legislation Tracker', 'Legislation updates, not headlines. Track bill status, amendments, votes, and committee actions in real time.'],
            ['◎', 'Transparent Feeds', 'Feeds you can understand. Choose chronological or ranked and see exactly why a post appears in your feed.'],
            ['◐', 'Civility Controls', 'Tools that keep discourse human. Conversation health scores, auto de-escalation nudges, and cooling-off features.'],
            ['✦', 'Verified Profiles', 'A trust layer that means something. Human verification tied to professional credentials, not just payment.'],
            ['◧', 'Community Notes', 'Citation-based, community-driven corrections. Neutral, source-first, and visible to all — not buried.'],
          ].map(([icon, title, desc], i) => (
            <div key={title} className="cs-feat transition-all duration-300 cursor-default" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 20, padding: '2rem 1.75rem', animationDelay: `${i * .07}s` }}>
              <div style={{ fontSize: '1.6rem', color: icon === '✦' ? '#d4a847' : '#3b82f6', marginBottom: '1.25rem' }}>{icon}</div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '.6rem', letterSpacing: '-.02em' }}>{title}</h3>
              <p style={{ fontSize: '.9rem', color: 'rgba(248,250,252,.5)', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className="py-24 px-8 max-w-6xl mx-auto" style={{ background: 'linear-gradient(180deg,transparent,rgba(59,130,246,.03) 50%,transparent)' }} id="how-it-works">
        <div style={{ color: '#3b82f6', fontSize: '.75rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>How It Works</div>
        <h2 style={{ fontSize: 'clamp(2rem,3.5vw,3rem)', fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1.1, marginBottom: '3.5rem' }}>Three steps.<br />Infinite clarity.</h2>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            ['01', 'Pick topics you care about', 'Select policy areas, committees, and communities. Your feed builds itself around what matters to you — not what drives engagement.'],
            ['02', 'Follow people & communities', 'Follow verified experts, journalists, legislators, and citizens. Community circles let you filter signal from noise.'],
            ['03', 'Track posts & policy updates', 'One feed. Posts, bill alerts, context panels, and community notes — unified and chronologically honest.'],
          ].map(([num, title, desc]) => (
            <div key={num} className="relative">
              <div style={{ fontSize: '3.5rem', fontWeight: 900, letterSpacing: '-.06em', color: 'rgba(59,130,246,.15)', lineHeight: 1, marginBottom: '1rem' }}>{num}</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '.75rem', letterSpacing: '-.02em' }}>{title}</h3>
              <p style={{ fontSize: '.9rem', color: 'rgba(248,250,252,.5)', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRUST ───────────────────────────────────────────── */}
      <section className="py-24 px-8 max-w-6xl mx-auto">
        <div style={{ color: '#3b82f6', fontSize: '.75rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>Trust &amp; Safety</div>
        <h2 style={{ fontSize: 'clamp(2rem,3.5vw,3rem)', fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1.1, marginBottom: '1.25rem' }}>Neutral by design.<br />Safe by default.</h2>
        <p style={{ color: 'rgba(248,250,252,.5)', maxWidth: 560, fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '3.5rem' }}>We built the principles before we built the product. That&apos;s not a tagline — it&apos;s the architecture.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {[
            ['◎', 'Neutral by Design', 'No algorithmic amplification of outrage. No partisan weighting. Feed ranking is documented and auditable.'],
            ['◈', 'Transparent Ranking', 'Every ranking signal is published. You choose what drives your feed — not a black box.'],
            ['◐', 'Anti-Harassment', 'Proactive protections, not reactive bans. Conversation health monitoring and tiered reporting tools.'],
            ['⊙', 'Source-First Info', 'Primary sources surface before opinions. Context panels link to the original document, not a summary of a summary.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="cs-trust transition-all duration-300" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 20, padding: '2rem 1.5rem' }}>
              <div style={{ fontSize: '1.5rem', color: '#2dd4bf', marginBottom: '1rem' }}>{icon}</div>
              <h3 style={{ fontSize: '.95rem', fontWeight: 700, marginBottom: '.5rem', letterSpacing: '-.02em' }}>{title}</h3>
              <p style={{ fontSize: '.85rem', color: 'rgba(248,250,252,.45)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <Link href="/safety" style={{ fontSize: '.9rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid rgba(255,255,255,.07)', paddingBottom: 2, transition: 'all .2s' }}>
            Read our Principles →
          </Link>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────── */}
      <section className="py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div style={{ color: '#3b82f6', fontSize: '.75rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>Plans</div>
          <h2 style={{ fontSize: 'clamp(2rem,3.5vw,3rem)', fontWeight: 900, letterSpacing: '-.04em', lineHeight: 1.1, marginBottom: '3.5rem' }}>Start free.<br />Go deeper with Pro.</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {/* Free */}
            <div className="cs-pricing transition-all duration-300" style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, padding: '2.5rem 2rem', background: 'rgba(255,255,255,.04)' }}>
              <div className="inline-block px-3 py-1 rounded-full mb-5" style={{ background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.2)', color: '#60a5fa', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Free</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-.04em', marginBottom: '.35rem' }}>Civic</div>
              <div style={{ fontSize: '.9rem', color: '#64748b', marginBottom: '1.75rem' }}>Always free</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '.65rem', marginBottom: '2rem' }}>
                {['Full posting & reading', 'Context panels (basic)', 'Follow people & communities', 'Live feed & trending', 'Community notes'].map(f => (
                  <li key={f} style={{ fontSize: '.9rem', color: 'rgba(248,250,252,.65)' }}>✓ {f}</li>
                ))}
              </ul>
              <Link href="/register" className="shine-btn block text-center py-3 rounded-xl font-semibold transition-all" style={{ border: '1.5px solid rgba(255,255,255,.12)', color: '#f8fafc', borderRadius: 12 }}>
                Join Free
              </Link>
            </div>

            {/* Pro */}
            <div className="cs-pricing transition-all duration-300" style={{ border: '1px solid rgba(212,168,71,.25)', borderRadius: 24, padding: '2.5rem 2rem', background: 'rgba(212,168,71,.04)', boxShadow: '0 0 60px rgba(212,168,71,.06)' }}>
              <div className="inline-block px-3 py-1 rounded-full mb-5" style={{ background: 'rgba(212,168,71,.12)', border: '1px solid rgba(212,168,71,.25)', color: '#f0c96a', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>✦ Pro</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-.04em', marginBottom: '.35rem' }}>Civic Pro</div>
              <div style={{ fontSize: '.9rem', color: '#64748b', marginBottom: '1.75rem' }}>Coming soon</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '.65rem', marginBottom: '2rem' }}>
                {['Everything in Free', 'Bill alerts & push notifications', 'Deeper AI-powered summaries', 'Advanced feed filters', 'Creator & analyst tools', 'Verified profile badge'].map(f => (
                  <li key={f} style={{ fontSize: '.9rem', color: 'rgba(248,250,252,.75)' }}>✦ {f}</li>
                ))}
              </ul>
              <Link href="/register" className="shine-btn block text-center py-3 font-bold transition-all" style={{ background: 'linear-gradient(135deg,#d4a847,#f0c96a)', color: '#0a0a0a', borderRadius: 12, boxShadow: '0 0 24px rgba(212,168,71,.3)' }}>
                Get Early Pro Access
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section className="py-28 px-8 text-center" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%,rgba(59,130,246,.08) 0%,transparent 70%)' }}>
        <h2 style={{ fontSize: 'clamp(2.8rem,5vw,5rem)', fontWeight: 900, letterSpacing: '-.05em', lineHeight: 1, marginBottom: '1.25rem', background: 'linear-gradient(135deg,#f8fafc,rgba(248,250,252,.6))', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Build better conversations.
        </h2>
        <p style={{ fontSize: '1.05rem', color: 'rgba(248,250,252,.45)', marginBottom: '2.5rem' }}>
          Join thousands waiting for a civic platform that takes the public seriously.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/register" className="shine-btn inline-flex items-center px-10 py-4 font-semibold text-white rounded-xl" style={{ background: '#3b82f6', borderRadius: 14, boxShadow: '0 0 24px rgba(59,130,246,.35)', fontSize: '1rem' }}>
            Create Account
          </Link>
          <Link href="/login" className="shine-btn inline-flex items-center px-10 py-4 font-semibold rounded-xl" style={{ border: '1.5px solid rgba(255,255,255,.12)', color: '#f8fafc', background: 'transparent', borderRadius: 14, fontSize: '1rem' }}>
            Sign In
          </Link>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.07)', padding: '2.5rem 0' }}>
        <div className="max-w-6xl mx-auto px-8 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 mr-auto" style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-.02em' }}>
            <span style={{ color: '#3b82f6', fontSize: '1.2rem' }}>◈</span> Civic Social
          </div>
          <nav className="flex gap-7 flex-wrap">
            {[['Privacy', '/safety'], ['Terms', '/safety'], ['Principles', '/how-it-works'], ['Contact', '/contact']].map(([label, href]) => (
              <Link key={label} href={href} style={{ fontSize: '.83rem', color: '#64748b' }}>{label}</Link>
            ))}
          </nav>
          <p className="w-full text-right" style={{ fontSize: '.78rem', color: 'rgba(100,116,139,.5)' }}>&copy; 2026 Civic Social. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

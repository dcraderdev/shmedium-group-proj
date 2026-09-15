import { useEffect, useRef, useState } from 'react';
import './PortfolioTopHeader.css';

const HOST_GATE = /\.vercel\.app$|\.dcrader\.dev$|^localhost$|^127\.0\.0\.1$/;

const INDUSTRIES = [
  ['Restaurants',   'https://restaurants.templates.dcrader.dev'],
  ['Pet services',  'https://pets.templates.dcrader.dev'],
  ['Trades',        'https://trades.templates.dcrader.dev'],
  ['Dental',        'https://dentists.templates.dcrader.dev'],
  ['Chiropractors', 'https://chiropractors.templates.dcrader.dev'],
  ['Photographers', 'https://photographers.templates.dcrader.dev'],
  ['Auto',          'https://auto.templates.dcrader.dev'],
  ['Salons',        'https://salons.templates.dcrader.dev'],
  ['Landscape',     'https://landscape.templates.dcrader.dev'],
  ['Real estate',   'https://realestate.templates.dcrader.dev'],
  ['Tattoo',        'https://tattoo.templates.dcrader.dev'],
  ['Trainers',      'https://trainers.templates.dcrader.dev'],
];

export default function PortfolioTopHeader() {
  const [show, setShow] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (HOST_GATE.test(window.location.hostname)) setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const root = document.documentElement;
    root.classList.add('dt-th-mounted');
    const shiftHostNavs = () => {
      const els = document.body.querySelectorAll('*');
      const vw = window.innerWidth;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (el === barRef.current || (barRef.current && barRef.current.contains(el))) continue;
        if (el.hasAttribute('data-dt-shifted')) continue;
        const cs = getComputedStyle(el);
        if ((cs.position !== 'fixed' && cs.position !== 'sticky') || parseFloat(cs.top) > 2) continue;
        const r = el.getBoundingClientRect();
        if (r.width < vw * 0.5) continue;
        el.setAttribute('data-dt-shifted', '');
      }
    };
    shiftHostNavs();

    // The host app mounts its own nav after this bar does, and swaps it again
    // when auth resolves or the route changes. A single scan at mount therefore
    // misses it: the nav keeps top:0 and renders underneath this bar, clipping
    // the logo and icons. Re-scan when the DOM changes so any nav that appears
    // later still gets offset.
    //
    // Debounced rather than run per mutation — the scan walks every element and
    // reads computed styles, which is far too heavy to repeat on each batch
    // during a render.
    let rescanTimer = 0;
    const scheduleRescan = () => {
      if (rescanTimer) return;
      rescanTimer = window.setTimeout(() => {
        rescanTimer = 0;
        shiftHostNavs();
      }, 300);
    };

    const observer = new MutationObserver(scheduleRescan);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', shiftHostNavs);
    return () => {
      observer.disconnect();
      if (rescanTimer) window.clearTimeout(rescanTimer);
      window.removeEventListener('resize', shiftHostNavs);
      root.classList.remove('dt-th-mounted');
      root.classList.remove('dt-th-hidden');
    };
  }, [show]);

  useEffect(() => {
    if (!show) return;
    document.documentElement.classList.toggle('dt-th-hidden', hidden);
  }, [show, hidden]);

  useEffect(() => {
    if (!show) return;
    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 6) { ticking = false; return; }
      setHidden(y > lastY && y > 60);
      lastY = y;
      ticking = false;
    };
    const handler = () => {
      if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [show]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (!show) return null;

  return (
    <div
      id="dcrader-th"
      ref={barRef}
      role="navigation"
      aria-label="dcrader portfolio"
      className={hidden ? 'dt-hidden' : ''}
    >
      <div className="dt-inner">
        <a className="dt-home dt-pri" href="https://dcrader.dev">&larr; dcrader.dev</a>
        <nav>
          <a href="https://dcrader.dev/pricing">Pricing</a>
          <a href="https://dcrader.dev/contact">Contact</a>
          <div className="dt-dd">
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            >
              Browse templates &#9662;
            </button>
            <div className="dt-menu" hidden={!menuOpen}>
              <div className="dt-sec">Industries</div>
              {INDUSTRIES.map(([label, href]) => (
                <a key={href} href={href}>{label}</a>
              ))}
              <div className="dt-sec">Portfolio</div>
              <a href="https://dcrader.dev">&larr; Back to dcrader.dev</a>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

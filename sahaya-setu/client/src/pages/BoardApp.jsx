import React, { useEffect, useState, useRef } from 'react';
import ComplaintImage from '../components/ComplaintImage';

const CAT = {
  ELEC: 'Power pole or wires',
  TREE: 'Fallen tree',
  ROAD: 'Road damage',
  FLOOD: 'Flooding',
  HOUSE: 'House damage',
  HEALTH: 'Medical help',
  TRANSPORT: 'Evacuation',
  OTHER: 'Other',
};

const COLOR = {
  closed: '#1f7a4a',
  resolved: '#1f7a4a',
  assigned: '#e8780c',
  in_progress: '#e8780c',
  review: '#5e4fa2',
};

function took(h) {
  if (h === null || h === undefined) return '';
  return h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h} h`;
}

export default function BoardApp() {
  const [summary, setSummary] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [fixes, setFixes] = useState([]);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layerGroup = useRef(null);
  const fittedRef = useRef(false);

  async function loadData() {
    try {
      const [sumRes, incRes, fixRes] = await Promise.all([
        fetch('/public/summary').then((r) => (r.ok ? r.json() : null)),
        fetch('/public/incidents').then((r) => (r.ok ? r.json() : [])),
        fetch('/public/fixes').then((r) => (r.ok ? r.json() : [])),
      ]);
      if (sumRes) setSummary(sumRes);
      if (incRes) setIncidents(incRes);
      if (fixRes) setFixes(fixRes);
    } catch (e) {
      console.warn('Board load failed:', e);
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapRef.current) return;
    if (typeof window.L === 'undefined') return;

    if (!mapInstance.current) {
      const map = window.L.map(mapRef.current).setView([16.6, 82.0], 9);
      const offlineTileUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="%23f8fafc" stroke="%23e2e8f0" stroke-width="1"/><circle cx="128" cy="128" r="4" fill="%23cbd5e1"/></svg>`;
      const tl = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors',
        errorTileUrl: offlineTileUrl,
      });
      tl.on('tileerror', () => {});
      tl.addTo(map);
      layerGroup.current = window.L.layerGroup().addTo(map);
      mapInstance.current = map;
    }

    if (layerGroup.current) {
      layerGroup.current.clearLayers();
      const pts = [];
      incidents
        .filter((i) => i.lat != null && i.lon != null)
        .forEach((i) => {
          pts.push([i.lat, i.lon]);
          window.L.circleMarker([i.lat, i.lon], {
            radius: 6 + Math.min(8, (i.report_count || 1) * 2),
            color: '#fff',
            weight: 2,
            fillColor: COLOR[i.status] || '#1b4f9c',
            fillOpacity: 0.9,
          })
            .bindTooltip(`${i.ticket_code}: ${CAT[i.category] || i.category} (${i.department})`)
            .addTo(layerGroup.current);
        });

      if (!fittedRef.current && pts.length > 0 && mapInstance.current) {
        mapInstance.current.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
        fittedRef.current = true;
      }
    }
  }, [incidents]);

  return (
    <div style={{ fontFamily: 'inherit', color: 'var(--ink)' }}>
      <style>{`
        .board-header { background: var(--tarp-deep); color: #fff; padding: 2rem 1.25rem 1.5rem; }
        .board-header .in, .board-main { max-width: 1180px; margin: 0 auto; }
        .board-header h1 { font-size: var(--s3); max-width: 22ch; margin-bottom: .4rem; }
        .board-header p { opacity: .85; margin: 0; }
        .tally { display: flex; flex-wrap: wrap; gap: 2.5rem; margin-top: 1.5rem; }
        .tally div { display: grid; }
        .tally b { font-size: var(--s4); line-height: 1; font-weight: 700; }
        .tally b.fixed { color: #8fd3a6; }
        .board-main { padding: 1.5rem 1.25rem 3rem; display: grid; gap: 2rem; }
        .two-col { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 2rem; align-items: start; }
        .dept-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem; }
        .dept-list li { display: grid; gap: .3rem; }
        .dept-list .name { display: flex; justify-content: space-between; gap: 1rem; font-weight: 600; }
        .dept-list .name span { font-weight: 400; color: var(--ink-soft); font-size: var(--s-1); }
        .prog-bar { display: flex; height: 14px; border-radius: 3px; overflow: hidden; background: var(--line); }
        .prog-bar i { display: block; height: 100%; }
        .prog-bar .f { background: var(--leaf); }
        .prog-bar .o { background: var(--orange); }
        .key { display: flex; gap: 1rem; font-size: var(--s-1); color: var(--ink-soft); margin-bottom: .6rem; }
        .key i { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: .3rem; vertical-align: -.1em; }
        #board-map { height: 420px; border-radius: var(--edge); }
        .fixes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
        .fix-card { background: var(--paper); border-radius: var(--edge); overflow: hidden; border: 1px solid var(--line); }
        .fix-card .pics { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; background: #0a1424; }
        .fix-card .pics figure { margin: 0; position: relative; }
        .fix-card img { width: 100%; height: 130px; object-fit: cover; }
        .fix-card figcaption { position: absolute; left: .4rem; top: .4rem; background: rgba(15,49,102,.85); color: #fff; font-size: .75rem; padding: .05rem .4rem; border-radius: 3px; }
        .fix-card .txt { padding: .7rem .8rem; display: grid; gap: .2rem; font-size: var(--s-1); }
        .fix-card .txt b { font-size: var(--s0); }
        .ok { color: var(--leaf); font-weight: 600; }
        .note { color: var(--ink-soft); font-size: var(--s-1); margin-top: .4rem; }
        @media (max-width: 820px) { .two-col { grid-template-columns: 1fr; } .tally b { font-size: var(--s3); } }
      `}</style>

      <header className="board-header">
        <div className="in">
          <h1 lang="te">ఏమి తెలిపారు, ఏమి పరిష్కరించారు</h1>
          <p>What citizens reported, which department has it, and how fast it was fixed. Updated every 30 seconds.</p>
          <div className="tally">
            <div>
              <b>{summary ? summary.reports_received : 0}</b>
              <span>reports received</span>
            </div>
            <div>
              <b className="fixed">{summary ? summary.fixed : 0}</b>
              <span>problems fixed</span>
            </div>
            <div>
              <b>{summary ? summary.open_tickets - summary.open_sos : 0}</b>
              <span>still open</span>
            </div>
          </div>
        </div>
      </header>

      <main className="board-main">
        <div className="two-col">
          <section>
            <h2>By department</h2>
            <div className="key">
              <span><i style={{ background: 'var(--leaf)' }}></i>Fixed</span>
              <span><i style={{ background: 'var(--orange)' }}></i>Still open</span>
            </div>
            <ul className="dept-list">
              {summary && summary.by_department && Object.entries(summary.by_department).length > 0 ? (
                Object.entries(summary.by_department).map(([name, d]) => {
                  const total = d.open + d.fixed || 1;
                  return (
                    <li key={name}>
                      <span className="name">
                        {name}
                        <span>
                          {d.fixed} fixed, {d.open} open
                          {d.avg_fix_hours != null ? `, average ${took(d.avg_fix_hours)} to fix` : ''}
                        </span>
                      </span>
                      <span className="prog-bar" aria-hidden="true">
                        <i className="f" style={{ width: `${(d.fixed / total) * 100}%` }}></i>
                        <i className="o" style={{ width: `${(d.open / total) * 100}%` }}></i>
                      </span>
                    </li>
                  );
                })
              ) : (
                <li>No reports yet.</li>
              )}
            </ul>
          </section>

          <section>
            <h2>Where problems were reported</h2>
            <div id="board-map" ref={mapRef} role="region" aria-label="Map of reported problems"></div>
            <p className="note">
              Locations are rounded to about 100 m. Emergency SOS calls and phone numbers are never shown here.
            </p>
          </section>
        </div>

        <section>
          <h2>Recently fixed, with the field team's photo</h2>
          <div className="fixes-grid">
            {fixes && fixes.length > 0 ? (
              fixes.map((f, idx) => (
                <article className="fix-card" key={f.ticket_code || idx}>
                  <div className="pics">
                    <figure>
                      {f.before_photo_url ? (
                        <ComplaintImage src={f.before_photo_url} alt="Before" folder="reports" />
                      ) : (
                        <div style={{ height: 130, background: '#111' }} />
                      )}
                      <figcaption>Reported</figcaption>
                    </figure>
                    <figure>
                      {f.proof_photo_url ? (
                        <ComplaintImage src={f.proof_photo_url} alt="After" folder="resolutions" />
                      ) : (
                        <div style={{ height: 130, background: '#111' }} />
                      )}
                      <figcaption>Fixed</figcaption>
                    </figure>
                  </div>
                  <div className="txt">
                    <b>{CAT[f.category] || f.category}</b>
                    <span>{f.address || ''}</span>
                    <span>
                      {f.department} fixed it in {took(f.hours_to_fix)}. {f.report_count === 1 ? 'One person' : `${f.report_count} people`} reported it.
                    </span>
                    {f.confirmed_by_citizen ? (
                      <span className="ok">Citizen confirmed the fix</span>
                    ) : (
                      <span>Waiting for the citizen to confirm</span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <p>Nothing fixed yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

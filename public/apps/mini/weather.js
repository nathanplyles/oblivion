function launchWeather() {
  if (window.shouldReuseAppWindow?.('weather') && window.focusAnyAppWindow?.('weather')) return;
  const html = `<div style="display:flex;flex-direction:column;height:100%;padding:20px;gap:14px">
    <div style="display:flex;gap:8px;align-items:center">
      <input id="wx-city" class="inp" style="margin:0;flex:1" placeholder="city name..." autocomplete="off" spellcheck="false" value="London">
      <button id="wx-search" class="btn" style="flex-shrink:0;padding:9px 16px">search</button>
    </div>
    <div id="wx-output" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px">
      <div style="font-size:11px;color:var(--text3);letter-spacing:.1em">enter a city to get weather</div>
    </div>
  </div>`;

  createWin('weather', 'weather', 360, 300, html);
  setTimeout(() => {
    const ICONS = {
      0: 'SUN', 1: 'PARTLY', 2: 'PARTLY', 3: 'CLOUD',
      45: 'FOG', 48: 'FOG', 51: 'DRIZZLE', 61: 'RAIN',
      71: 'SNOW', 80: 'SHOWERS', 95: 'STORM',
    };

    const search = () => {
      const cityInput = document.getElementById('wx-city');
      const out = document.getElementById('wx-output');
      const city = String(cityInput?.value || '').trim();
      if (!city || !out) return;

      out.innerHTML = '<div style="font-size:10px;color:var(--text3);letter-spacing:.08em">fetching...</div>';
      fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
        .then((r) => r.json())
        .then((geo) => {
          if (!geo.results?.length) {
            out.innerHTML = '<div style="color:#7a3838;font-size:11px">city not found</div>';
            return null;
          }
          const loc = geo.results[0];
          return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`)
            .then((r) => r.json())
            .then((wx) => ({ loc, wx }));
        })
        .then((payload) => {
          if (!payload) return;
          const { loc, wx } = payload;
          const w = wx.current_weather;
          const icon = ICONS[Number(w.weathercode)] || 'CLEAR';
          out.innerHTML = `
            <div style="font-family:var(--font-m);font-size:12px;color:var(--accent);letter-spacing:.16em;text-transform:uppercase">${icon}</div>
            <div style="font-family:var(--font-d);font-size:2.6rem;color:#ccc;line-height:1">${Math.round(w.temperature)}C</div>
            <div style="font-size:11px;color:var(--text3);letter-spacing:.1em;text-transform:uppercase">${loc.name}, ${loc.country_code}</div>
            <div style="font-size:10px;color:var(--text3);letter-spacing:.06em;margin-top:6px">wind ${w.windspeed} km/h</div>`;
        })
        .catch(() => {
          out.innerHTML = '<div style="color:#7a3838;font-size:11px">network error</div>';
        });
    };

    document.getElementById('wx-search')?.addEventListener('click', search);
    document.getElementById('wx-city')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') search();
    });
    search();
  }, 50);
}

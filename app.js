const app = document.querySelector("#app");
const trips = window.TRIPS || [];

const esc = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function tripCard(trip, index) {
  return `
    <a class="trip-card ${esc(trip.accent)}" href="#/trip/${encodeURIComponent(trip.id)}" style="--delay:${index * 80}ms" data-world-kind="trip" data-trip-id="${esc(trip.id)}">
      <img src="${esc(trip.hero)}" alt="${esc(trip.destination)}" loading="${index ? "lazy" : "eager"}">
      <div class="card-shade"></div>
      <div class="card-top"><span class="status">${esc(trip.status)}</span><span class="arrow">↗</span></div>
      <div class="card-copy">
        <div class="eyebrow">${esc(trip.country)} · ${esc(trip.dates)}</div>
        <h2>${esc(trip.destination)} <span>${esc(trip.flag)}</span></h2>
        <p>${esc(trip.subtitle)}</p>
        <div class="card-meta"><span>${esc(trip.duration)}</span><span>查看详细行程 →</span></div>
      </div>
    </a>`;
}

function renderHome() {
  document.title = "Exis Travel Journal";
  app.innerHTML = `
    <section class="home-hero">
      <div class="kicker">TRAVEL JOURNAL · 2026</div>
      <h1>下一站，<em>一起出发。</em></h1>
      <p>所有旅行的日期、目的地和回忆，都收在这里。</p>
      <div class="trip-count"><strong>${trips.length}</strong><span>段旅程</span></div>
    </section>
    <section class="trip-grid" aria-label="旅行列表">
      ${trips.map(tripCard).join("")}
    </section>`;
}

function renderDetail(id) {
  const trip = trips.find(t => t.id === id);
  if (!trip) return renderNotFound();
  document.title = `${trip.destination} · Exis Travel`;
  app.innerHTML = `
    <section class="detail-hero ${esc(trip.accent)}">
      <img src="${esc(trip.hero)}" alt="${esc(trip.destination)}">
      <div class="detail-shade"></div>
      <a class="back" href="#/">← 所有旅行</a>
      <div class="detail-title">
        <span class="status">${esc(trip.status)}</span>
        <div class="eyebrow">${esc(trip.country)} · ${esc(trip.dates)}</div>
        <h1>${esc(trip.destination)} <span>${esc(trip.flag)}</span></h1>
        <p>${esc(trip.summary)}</p>
      </div>
    </section>
    <section class="detail-body">
      <div class="facts">
        ${trip.facts.map(f => `<div><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></div>`).join("")}
      </div>
      <div class="section-heading"><span>DAILY PLAN</span><h2>详细行程</h2></div>
      <div class="timeline">
        ${trip.days.map((day, i) => `
          <article class="day" style="--delay:${i * 60}ms" data-world-kind="day" data-trip-id="${esc(trip.id)}" data-day-index="${i}">
            <div class="day-date"><strong>${esc(day.date)}</strong><span>${esc(day.weekday)}</span></div>
            <div class="day-content">
              <h3>${esc(day.title)}</h3>
              ${day.items.map(item => `
                <div class="event">
                  <div class="event-time">${esc(item.time)}</div>
                  <div class="event-copy"><span class="event-type">${esc(item.type)}</span><h4>${esc(item.title)}</h4><p>${esc(item.detail)}</p></div>
                  ${item.badge ? `<span class="event-badge">${esc(item.badge)}</span>` : ""}
                </div>`).join("")}
            </div>
          </article>`).join("")}
      </div>
      <a class="home-link" href="#/">← 返回旅行首页</a>
    </section>`;
  window.scrollTo(0, 0);
}

function renderNotFound() {
  app.innerHTML = `<section class="not-found"><h1>这段旅程还没启程</h1><a href="#/">返回旅行首页</a></section>`;
}

function route() {
  const match = location.hash.match(/^#\/trip\/([^/]+)$/);
  match ? renderDetail(decodeURIComponent(match[1])) : renderHome();
  window.scrollTo(0, 0);
  window.dispatchEvent(new CustomEvent("travel:rendered"));
}

window.addEventListener("hashchange", route);
route();

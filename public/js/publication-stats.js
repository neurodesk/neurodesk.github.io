// Summarises the publications list by year, population and method, and lets
// each bar filter the list. Counts come from the data-population and
// data-methods attributes on each .cite card, so tagging a new entry is enough
// to keep the charts current.

const root = document.getElementById('pub-stats');
const cards = [...document.querySelectorAll('.cite')];

const yearOf = (card) =>
  card.querySelector('.cite__meta')?.textContent.match(/(\d{4})\.\s*$/)?.[1] ?? '';
const split = (value) =>
  (value ?? '').split(';').map((s) => s.trim()).filter(Boolean);

const entries = cards.map((card) => ({
  card,
  year: [yearOf(card)].filter(Boolean),
  population: split(card.dataset.population),
  method: split(card.dataset.methods),
}));

function tally(field) {
  const counts = new Map();
  for (const entry of entries) {
    for (const value of entry[field]) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

const byCount = (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]);
const byLabel = (a, b) => a[0].localeCompare(b[0]);

const panels = [
  { field: 'population', title: 'Population studied', sort: byCount },
  { field: 'method', title: 'Method', sort: byCount },
  { field: 'year', title: 'By year', sort: byLabel },
];

let active = null;
const status = document.createElement('p');
status.className = 'pub-stats__status';
status.setAttribute('aria-live', 'polite');

function applyFilter() {
  let shown = 0;
  for (const entry of entries) {
    const match = !active || entry[active.field].includes(active.value);
    entry.card.hidden = !match;
    if (match) shown += 1;
  }
  root.querySelectorAll('.pub-bar').forEach((bar) => {
    const on = active && bar.dataset.field === active.field && bar.dataset.value === active.value;
    bar.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  status.replaceChildren();
  if (active) {
    status.append(`Showing ${shown} of ${entries.length} publications: ${active.value}. `);
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'pub-stats__clear';
    clear.textContent = 'Show all';
    clear.addEventListener('click', () => {
      active = null;
      applyFilter();
    });
    status.append(clear);
  }
}

function renderPanel({ field, title, sort }) {
  const rows = [...tally(field)].sort(sort);
  const max = Math.max(...rows.map(([, n]) => n));

  const panel = document.createElement('section');
  panel.className = 'pub-stats__panel';
  const heading = document.createElement('p');
  heading.className = 'pub-stats__title';
  heading.textContent = title;
  panel.append(heading);

  for (const [value, n] of rows) {
    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'pub-bar';
    bar.dataset.field = field;
    bar.dataset.value = value;
    bar.setAttribute('aria-pressed', 'false');
    bar.setAttribute('aria-label', `${value}: ${n} publication${n === 1 ? '' : 's'}. Filter the list.`);
    bar.innerHTML = `
      <span class="pub-bar__label"></span>
      <span class="pub-bar__track"><span class="pub-bar__fill" style="width:${(n / max) * 100}%"></span></span>
      <span class="pub-bar__count">${n}</span>`;
    bar.querySelector('.pub-bar__label').textContent = value;
    bar.addEventListener('click', () => {
      const same = active && active.field === field && active.value === value;
      active = same ? null : { field, value };
      applyFilter();
    });
    panel.append(bar);
  }

  if (field === 'population') {
    const untagged = entries.filter((e) => e.population.length === 0).length;
    const note = document.createElement('p');
    note.className = 'pub-stats__note';
    note.textContent = `${untagged} methods, software or healthy-participant papers are not counted here.`;
    panel.append(note);
  }
  return panel;
}

if (root && entries.length) {
  const years = tally('year');
  const latest = [...years.keys()].sort().at(-1);

  const headline = document.createElement('div');
  headline.className = 'pub-stats__headline';
  headline.innerHTML = `
    <div><span class="pub-stats__number">${entries.length}</span><span class="pub-stats__caption">publications</span></div>
    <div><span class="pub-stats__number">${years.get(latest)}</span><span class="pub-stats__caption">in ${latest}</span></div>
    <div><span class="pub-stats__number">${tally('population').size}</span><span class="pub-stats__caption">clinical and research populations</span></div>`;

  const grid = document.createElement('div');
  grid.className = 'pub-stats__grid';
  grid.append(...panels.map(renderPanel));

  root.append(headline, grid, status);
}

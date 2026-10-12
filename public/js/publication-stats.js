// Summarises the publications list by population, method and year, adds topic
// tags to each card, and lets bars and tags filter the list. Everything comes
// from the data-population and data-methods attributes on each .cite card, so
// tagging a new entry is enough to keep the page current.

const root = document.getElementById('pub-stats');
const cards = [...document.querySelectorAll('.cite')];

const PREPRINT = /\b(bioRxiv|medRxiv|arXiv|PsyArXiv|protocols\.io|Reviewed Preprint)\b/;

const metaOf = (card) => card.querySelector('.cite__meta')?.textContent ?? '';
const yearOf = (card) => metaOf(card).match(/(\d{4})\.\s*$/)?.[1] ?? '';
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

// Group the cards under their h2/h3 headings so empty sections can be hidden
// while a filter is active.
function headingGroups() {
  const container = root.closest('.sl-markdown-content') ?? root.parentElement;
  const groups = [];
  let h2 = null;
  let h3 = null;
  for (const el of container.children) {
    if (el.matches('.sl-heading-wrapper.level-h2')) {
      h2 = { els: [el], cards: [] };
      h3 = null;
      groups.push(h2);
    } else if (el.matches('.sl-heading-wrapper.level-h3')) {
      h3 = { els: [el], cards: [] };
      groups.push(h3);
    } else if (el.classList.contains('cite')) {
      h2?.cards.push(el);
      h3?.cards.push(el);
    } else if (el.tagName === 'HR') {
      h2 = h3 = null;
    } else if (el.tagName === 'P') {
      const group = h3 ?? h2;
      if (group && group.cards.length === 0) group.els.push(el);
    }
  }
  return groups.filter((g) => g.cards.length > 0);
}

let active = null;
let groups = [];
const status = document.createElement('p');
status.className = 'pub-stats__status';
status.setAttribute('aria-live', 'polite');

function setFilter(field, value, { scroll = false } = {}) {
  const same = active && active.field === field && active.value === value;
  active = same || !field ? null : { field, value };
  applyFilter();
  if (scroll) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function applyFilter() {
  let shown = 0;
  for (const entry of entries) {
    const match = !active || entry[active.field].includes(active.value);
    entry.card.hidden = !match;
    if (match) shown += 1;
  }
  for (const group of groups) {
    const empty = group.cards.every((card) => card.hidden);
    group.els.forEach((el) => { el.hidden = empty; });
  }
  document.querySelectorAll('.pub-bar, .cite-tag[data-field]').forEach((el) => {
    const on = active && el.dataset.field === active.field && el.dataset.value === active.value;
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  status.replaceChildren();
  if (active) {
    status.append(`Showing ${shown} of ${entries.length} publications: ${active.value}. `);
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'pub-stats__clear';
    clear.textContent = 'Show all';
    clear.addEventListener('click', () => setFilter(null));
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
  if (field === 'population') {
    const tagged = entries.filter((e) => e.population.length > 0).length;
    const detail = document.createElement('span');
    detail.className = 'pub-stats__detail';
    detail.textContent = ` (${tagged} studies, excludes software papers)`;
    heading.append(detail);
  }
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
    bar.addEventListener('click', () => setFilter(field, value));
    panel.append(bar);
  }

  return panel;
}

function renderTags(entry) {
  const tags = document.createElement('div');
  tags.className = 'cite__tags not-content';

  if (PREPRINT.test(metaOf(entry.card))) {
    const badge = document.createElement('span');
    badge.className = 'cite-tag cite-tag--preprint';
    badge.textContent = 'Preprint';
    tags.append(badge);
  }

  const chips = [
    ...entry.population.map((value) => ['population', value]),
    ...entry.method.map((value) => ['method', value]),
  ];
  for (const [field, value] of chips) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `cite-tag cite-tag--${field}`;
    chip.dataset.field = field;
    chip.dataset.value = value;
    chip.setAttribute('aria-pressed', 'false');
    chip.title = `Show only ${value} publications`;
    chip.textContent = value;
    chip.addEventListener('click', () => setFilter(field, value, { scroll: true }));
    tags.append(chip);
  }

  if (tags.childElementCount) entry.card.append(tags);
}

function tile(number, caption) {
  const el = document.createElement('div');
  el.className = 'pub-stats__tile';
  el.innerHTML = '<span class="pub-stats__number"></span><span class="pub-stats__caption"></span>';
  el.firstElementChild.textContent = number;
  el.lastElementChild.textContent = caption;
  return el;
}

if (root && entries.length) {
  const years = tally('year');
  const sortedYears = [...years.keys()].sort();
  const latest = sortedYears.at(-1);

  const headline = document.createElement('div');
  headline.className = 'pub-stats__headline';
  headline.append(
    tile(entries.length, `publications since ${sortedYears[0]}`),
    tile(years.get(latest), `published in ${latest}`),
    tile(tally('population').size, 'populations studied'),
    tile(tally('method').size, 'methods and modalities used'),
  );

  const grid = document.createElement('div');
  grid.className = 'pub-stats__grid';
  grid.append(...panels.map(renderPanel));

  root.append(headline, grid, status);
  entries.forEach(renderTags);
  groups = headingGroups();
}

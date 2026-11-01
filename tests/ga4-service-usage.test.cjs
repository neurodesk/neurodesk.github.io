const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.textContent = '';
  }
  append(child) {
    this.children.push(child);
  }
}

async function render(data, dataset) {
  const block = new Element('div');
  block.dataset = { ga4ServiceUsageUrl: '/data/user-metrics.json', ...dataset };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/js/ga4-service-usage.js'), 'utf8'), {
    document: {
      readyState: 'complete',
      querySelectorAll: () => [block],
      createElement: (tag) => new Element(tag)
    },
    fetch: async () => ({ ok: true, json: async () => data })
  });
  await new Promise(setImmediate);
  return block;
}

function descendants(element, tag) {
  return element.children.flatMap((child) => [
    ...(child.tag === tag ? [child] : []),
    ...descendants(child, tag)
  ]);
}

const segments = [
  { id: 'play-america', name: 'Play US', totalUsers: 25 },
  { id: 'webapp-sct', name: 'Spinal Cord Toolbox', totalUsers: 42 },
  { id: 'webapp-new-tool', name: 'New tool', totalUsers: 0 },
  { id: 'neurodeskedu', name: 'NeurodeskEDU', totalUsers: 55 }
];

test('webapp prefix renders every app including new zero-usage entries', async () => {
  const block = await render({ segments }, { ga4ServiceUsageIdPrefix: 'webapp-' });
  const rows = descendants(descendants(block, 'tbody')[0], 'tr');
  assert.deepEqual(rows.map((row) => row.children[0].textContent), ['Spinal Cord Toolbox', 'New tool']);
  assert.deepEqual(rows.map((row) => row.children[1].textContent), ['42', '0']);
});

test('explicit service ids preserve EDU and Play selection order', async () => {
  const block = await render({ segments }, { ga4ServiceUsageIds: 'neurodeskedu,play-america' });
  const rows = descendants(descendants(block, 'tbody')[0], 'tr');
  assert.deepEqual(rows.map((row) => row.children[0].textContent), ['NeurodeskEDU', 'Play US']);
});

test('unavailable and missing webapp data have explicit status', async () => {
  for (const data of [{ unavailable: true, segments }, { segments: [segments[0]] }]) {
    const block = await render(data, { ga4ServiceUsageIdPrefix: 'webapp-' });
    assert.equal(descendants(block, 'table').length, 0);
    assert.match(descendants(block, 'span')[0].textContent, /not available|not configured/);
  }
});

test('metrics page selects catalog apps by prefix', () => {
  const page = fs.readFileSync(path.join(__dirname, '../src/content/docs/overview/metrics.mdx'), 'utf8');
  assert.match(page, /data-ga4-service-usage-id-prefix="webapp-"/);
  assert.doesNotMatch(page, /data-ga4-service-usage-ids="webapp-/);
});

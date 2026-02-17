/**
 * Run Newman (Postman CLI) with collection and environment.
 * Supports: --ci (bail on first failure), --folder "name" (repeatable).
 * Outputs: reports/newman/report.html, junit.xml, coverage-summary.txt
 */
const path = require('path');
const fs = require('fs');
const newman = require('newman');

const rootDir = path.resolve(__dirname, '..');
const collectionPath = path.join(rootDir, 'postman', 'FakeRESTAPI-Users.postman_collection.json');
const envPath = path.join(rootDir, 'postman', 'postman_environment.json');
const reportDir = path.join(rootDir, 'reports', 'newman');

const argv = process.argv.slice(2);
const isCi = argv.includes('--ci');

// Collect all --folder values (supports multiple)
const folders = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--folder' && argv[i + 1]) {
    folders.push(argv[++i]);
  }
}

if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const newmanOptions = {
  collection: collectionPath,
  environment: envPath,
  reporters: ['cli', 'htmlextra', 'junit'],
  reporter: {
    htmlextra: {
      export: path.join(reportDir, 'report.html'),
      title: 'Fake REST API - Users',
      darkTheme: true
    },
    junit: {
      export: path.join(reportDir, 'junit.xml')
    }
  },
  bail: isCi
};

if (folders.length === 1) {
  newmanOptions.folder = folders[0];
  console.log('Running folder:', folders[0]);
} else if (folders.length > 1) {
  newmanOptions.folder = folders;
  console.log('Running folders:', folders.join(', '));
}

newman.run(newmanOptions, (err, summary) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  const run = summary.run;
  const stats = run.stats;
  const assertions = stats.assertions || { total: 0, failed: 0 };
  const tests = stats.tests || { total: 0, failed: 0 };
  const requests = stats.requests || { total: 0, failed: 0 };

  // Count unique API endpoints hit from executed requests
  const API_ENDPOINTS = [
    { method: 'GET',    pattern: /\/api\/v1\/Users$/ },
    { method: 'POST',   pattern: /\/api\/v1\/Users$/ },
    { method: 'GET',    pattern: /\/api\/v1\/Users\/.+/ },
    { method: 'PUT',    pattern: /\/api\/v1\/Users\/.+/ },
    { method: 'DELETE', pattern: /\/api\/v1\/Users\/.+/ }
  ];
  const endpointsTotal = API_ENDPOINTS.length;
  const hitSet = new Set();
  (run.executions || []).forEach(exec => {
    if (!exec.request) return;
    const method = exec.request.method;
    const urlPath = exec.request.url.getPath();
    API_ENDPOINTS.forEach((ep, idx) => {
      if (method === ep.method && ep.pattern.test(urlPath)) {
        hitSet.add(idx);
      }
    });
  });
  const endpointsHit = hitSet.size;

  const scenariosPassed = (assertions.total || 0) - (assertions.failed || 0);
  const scenariosTotal = assertions.total || 0;

  const lines = [
    'Fake REST API - Users (Newman)',
    '================================',
    `Folders:      ${folders.length > 0 ? folders.join(', ') : 'all'}`,
    `Requests:     ${requests.total} total, ${requests.failed} failed`,
    `Tests:        ${tests.total} total, ${tests.failed} failed`,
    `Assertions:   ${scenariosTotal} total, ${assertions.failed || 0} failed`,
    `Endpoints:    ${endpointsHit}/${endpointsTotal} hit`,
    `Scenarios:    ${scenariosPassed}/${scenariosTotal} passed`,
    ''
  ];

  const summaryPath = path.join(reportDir, 'coverage-summary.txt');
  fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8');
  console.log('\nCoverage summary written to:', summaryPath);

  if (run.failures && run.failures.length > 0) {
    process.exit(1);
  }
});

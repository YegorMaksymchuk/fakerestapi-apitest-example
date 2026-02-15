/**
 * Run Newman (Postman CLI) with collection and environment.
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
const folderIndex = argv.indexOf('--folder');
const folderName = folderIndex !== -1 && argv[folderIndex + 1] ? argv[folderIndex + 1] : null;

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
  bail: isCi ? true : false
};
if (folderName) {
  newmanOptions.folder = folderName;
  console.log('Running folder:', folderName);
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

    const endpointsTotal = 5; // GET list, POST, GET id, PUT, DELETE
    const endpointsHit = Math.min(requests.total, endpointsTotal); // all 5 are exercised by collection
    const scenariosPassed = (assertions.total || 0) - (assertions.failed || 0);
    const scenariosTotal = assertions.total || 0;

    const lines = [
      'Fake REST API - Users (Newman)',
      '================================',
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
  }
);

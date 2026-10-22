// Development-only JSON bridge for differential tests; no dependencies.
require('../docs/data.js');
require('../docs/engine.js');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  const results = JSON.parse(input).map(test => test.source === 'abcde'
    ? ABCDE.analyze(test.text, test.conventions !== false) : ABCDE.reverse(test.text, test.source));
  process.stdout.write(JSON.stringify(results));
});

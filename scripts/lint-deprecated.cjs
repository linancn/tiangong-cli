const path = require('path');
const ts = require('typescript');

const projectRoot = process.cwd();
const scanTargets = process.argv.slice(2);
const normalizedTargets = scanTargets.length
  ? scanTargets.map((target) => path.resolve(projectRoot, target + path.sep))
  : [
      path.resolve(projectRoot, 'src') + path.sep,
      path.resolve(projectRoot, 'test') + path.sep,
      path.resolve(projectRoot, 'scripts') + path.sep,
    ];

const ignoredSegments = [`${path.sep}node_modules${path.sep}`, `${path.sep}coverage${path.sep}`];

function shouldCheckFile(fileName) {
  if (fileName.endsWith('.d.ts')) {
    return false;
  }

  if (ignoredSegments.some((segment) => fileName.includes(segment))) {
    return false;
  }

  return normalizedTargets.some((target) => fileName.startsWith(target));
}

function formatLocation(diagnostic) {
  if (!diagnostic.file || typeof diagnostic.start !== 'number') {
    return '';
  }

  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  const relativePath = path.relative(projectRoot, diagnostic.file.fileName);
  return `${relativePath}:${line + 1}:${character + 1}`;
}

function loadProgram() {
  const configPath = ts.findConfigFile(projectRoot, ts.sys.fileExists, 'tsconfig.json');

  if (!configPath) {
    throw new Error('Unable to find tsconfig.json');
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.formatDiagnostic(configFile.error, ts.createCompilerHost({})));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );

  return ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });
}

function main() {
  const program = loadProgram();
  const diagnostics = [];

  for (const sourceFile of program.getSourceFiles()) {
    if (!shouldCheckFile(sourceFile.fileName)) {
      continue;
    }

    diagnostics.push(
      ...program
        .getSuggestionDiagnostics(sourceFile)
        .filter((diagnostic) => diagnostic.reportsDeprecated),
    );
  }

  const seen = new Set();
  const uniqueDiagnostics = diagnostics.filter((diagnostic) => {
    const key = [
      diagnostic.file?.fileName,
      diagnostic.start,
      diagnostic.code,
      ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    ].join('|');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });

  if (!uniqueDiagnostics.length) {
    return;
  }

  console.error('Deprecated API usage found:');
  for (const diagnostic of uniqueDiagnostics) {
    const location = formatLocation(diagnostic);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    console.error(`  ${location} TS${diagnostic.code}: ${message}`);
  }

  console.error(`Found ${uniqueDiagnostics.length} deprecated API warning(s).`);
  process.exit(1);
}

main();

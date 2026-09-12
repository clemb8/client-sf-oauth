/**
 * NFR3 — every TypeScript sample in the consumer documentation type-checks
 * against the library as it is declared in `src/index.ts`.
 *
 * Each fenced ```ts / ```typescript block of `README.md`, `llms.txt`, and
 * `AGENTS.md` is compiled in memory as its own module with `strict` on,
 * `client-sf-oauth` mapped to `src/index.ts`, and `@types/node` available.
 * Other fences (`javascript`, `bash`, `text`, ...) are not samples and are
 * ignored. No file is written and no network is used.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');

/** Compiling lib.d.ts plus @types/node per block takes well under a second; allow slow CI. */
const COMPILE_TIMEOUT_MS = 30_000;

const COMPILER_OPTIONS: ts.CompilerOptions = {
  baseUrl: ROOT,
  paths: { 'client-sf-oauth': ['src/index.ts'] },
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2016,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  noEmit: true,
};

interface Sample {
  /** Zero-based index among the TypeScript fences of the file. */
  index: number;
  /** One-based line of the opening fence, for a readable failure. */
  line: number;
  source: string;
}

interface SampleFailure {
  index: number;
  line: number;
  message: string;
}

/** Extract the ```ts / ```typescript fences of a Markdown-shaped file. */
function extractSamples(markdown: string): Sample[] {
  const samples: Sample[] = [];
  const fence = /^```(?:ts|typescript)[^\n]*\n([\s\S]*?)^```/gm;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(markdown)) !== null) {
    const line = markdown.slice(0, match.index).split('\n').length;
    samples.push({ index: samples.length, line, source: match[1] });
  }
  return samples;
}

/**
 * A compiler host that serves one in-memory snippet and delegates everything
 * else (lib files, `@types`, `src/`) to the real filesystem.
 */
function createSnippetHost(snippetPath: string, source: string): ts.CompilerHost {
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const delegateGetSourceFile = host.getSourceFile;
  const delegateFileExists = host.fileExists;
  const delegateReadFile = host.readFile;

  return {
    ...host,
    getSourceFile: (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
      fileName === snippetPath
        ? ts.createSourceFile(fileName, source, languageVersion, true)
        : delegateGetSourceFile.call(host, fileName, languageVersion, onError, shouldCreateNewSourceFile),
    fileExists: (fileName) => fileName === snippetPath || delegateFileExists.call(host, fileName),
    readFile: (fileName) => (fileName === snippetPath ? source : delegateReadFile.call(host, fileName)),
  };
}

/** Compile one snippet; return its diagnostics rendered as one string each. */
function compileSample(sample: Sample, documentName: string): string[] {
  const snippetPath = path.join(ROOT, `docs-sample-${documentName.replace(/\W/g, '_')}-${sample.index}.ts`);
  const host = createSnippetHost(snippetPath, sample.source);
  const program = ts.createProgram([snippetPath], COMPILER_OPTIONS, host);

  return ts.getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === snippetPath)
    .map((diagnostic) => {
      const position = diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : undefined;
      const where = position ? `snippet line ${position.line + 1}: ` : '';
      return `${where}${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`;
    });
}

/** Compile every sample of a document; return the failures with their location. */
function compileDocument(relativePath: string): { samples: Sample[]; failures: SampleFailure[] } {
  const samples = extractSamples(readFileSync(path.join(ROOT, relativePath), 'utf8'));
  const failures: SampleFailure[] = [];
  for (const sample of samples) {
    const diagnostics = compileSample(sample, relativePath);
    if (diagnostics.length > 0) {
      failures.push({ index: sample.index, line: sample.line, message: diagnostics[0] });
    }
  }
  return { samples, failures };
}

function describeFailures(relativePath: string, failures: SampleFailure[]): string {
  return failures
    .map((failure) => `${relativePath} block ${failure.index} (line ${failure.line}): ${failure.message}`)
    .join('\n');
}

describe('documentation samples type-check against src/index.ts (NFR3)', () => {
  it('README.md: every TypeScript sample compiles', () => {
    const { samples, failures } = compileDocument('README.md');
    expect(samples.length, 'the README must carry TypeScript samples').toBeGreaterThan(0);
    expect(failures, describeFailures('README.md', failures)).toEqual([]);
  }, COMPILE_TIMEOUT_MS);

  it('llms.txt: every TypeScript sample compiles', () => {
    const { failures } = compileDocument('llms.txt');
    expect(failures, describeFailures('llms.txt', failures)).toEqual([]);
  }, COMPILE_TIMEOUT_MS);

  it('AGENTS.md: every TypeScript sample compiles', () => {
    const { samples, failures } = compileDocument('AGENTS.md');
    expect(samples.length, 'AGENTS.md must carry TypeScript samples').toBeGreaterThan(0);
    expect(failures, describeFailures('AGENTS.md', failures)).toEqual([]);
  }, COMPILE_TIMEOUT_MS);

  // Guard against a vacuous harness: a sample that misuses the API must fail.
  it('rejects a sample that does not match the declarations', () => {
    const broken: Sample = {
      index: 0,
      line: 1,
      source: [
        "import { SF_JWTConnect } from 'client-sf-oauth';",
        'const client = new SF_JWTConnect({ clientId: 1 });',
        'client.requestAccessTokenWithCode();',
      ].join('\n'),
    };
    const diagnostics = compileSample(broken, 'self-check');
    expect(diagnostics.length).toBeGreaterThanOrEqual(2);
    expect(diagnostics.join('\n')).toContain("'number' is not assignable to type 'string'");
  }, COMPILE_TIMEOUT_MS);

  // Guard against silently skipping: only ts/typescript fences are samples.
  it('extracts ts and typescript fences only', () => {
    const markdown = [
      '```ts', 'const a: number = 1;', '```',
      '```javascript', 'const b = 2;', '```',
      '```typescript title="x"', 'const c: string = "c";', '```',
      '```bash', 'npm install client-sf-oauth', '```',
    ].join('\n');
    const samples = extractSamples(markdown);
    expect(samples.map((sample) => sample.source.trim())).toEqual(['const a: number = 1;', 'const c: string = "c";']);
    expect(samples.map((sample) => sample.line)).toEqual([1, 7]);
  });
});

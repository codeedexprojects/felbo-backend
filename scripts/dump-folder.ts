import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'output.txt');

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

const ALLOWED_EXTENSIONS = new Set(['.ts', '.js', '.json', '.env', '.md']);

function walk(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
        walk(fullPath, fileList);
      }
    } else {
      const ext = path.extname(entry.name);
      if (ALLOWED_EXTENSIONS.has(ext)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

function dumpFolder(targetRelativePath: string) {
  const targetPath = path.resolve(PROJECT_ROOT, targetRelativePath);

  if (!fs.existsSync(targetPath)) {
    console.error(`Folder does not exist: ${targetRelativePath}`);
    process.exit(1);
  }

  if (!fs.statSync(targetPath).isDirectory()) {
    console.error(`Not a directory: ${targetRelativePath}`);
    process.exit(1);
  }

  const files = walk(targetPath).sort();

  const output: string[] = [];

  for (const file of files) {
    const relativePath = path.relative(PROJECT_ROOT, file);

    output.push(`// ========================================`);
    output.push(`// File: ${relativePath}`);
    output.push(`// ========================================`);
    output.push(fs.readFileSync(file, 'utf8'));
    output.push('\n');
  }

  fs.writeFileSync(OUTPUT_FILE, output.join('\n'), 'utf8');

  console.log(`Dump complete.`);
  console.log(`Output written to: ${OUTPUT_FILE}`);
}

const targetFolder = process.argv[2];

if (!targetFolder) {
  console.error('Please provide a folder path.');
  console.error('Example: npm run dump -- ./src/modules/auth');
  process.exit(1);
}

dumpFolder(targetFolder);

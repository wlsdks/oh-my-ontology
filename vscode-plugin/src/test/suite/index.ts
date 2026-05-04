import * as path from 'path';
import { glob } from 'glob';
import Mocha from 'mocha';

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 20000 });

  const testsRoot = path.resolve(__dirname);
  const files = await glob('**/*.test.js', {
    cwd: testsRoot,
    ignore: '**/index.js',
  });
  for (const file of files) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  return new Promise<void>((resolve, reject) => {
    try {
      mocha.run((failures) => {
        if (failures > 0) reject(new Error(`${failures} tests failed`));
        else resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

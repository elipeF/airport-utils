import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeSharedMapping(name, value) {
  const sharedDirectory = path.join(projectRoot, 'dist/shared');
  fs.mkdirSync(sharedDirectory, { recursive: true });
  fs.writeFileSync(path.join(sharedDirectory, `${name}.json`), `${JSON.stringify(value)}\n`);

  fs.writeFileSync(
    path.join(projectRoot, `dist/esm/mapping/${name}.js`),
    `import ${name} from '../../shared/${name}.json' with { type: 'json' };\nexport { ${name} };\n`
  );
  fs.writeFileSync(
    path.join(projectRoot, `dist/cjs/mapping/${name}.cjs`),
    `const ${name} = require('../../shared/${name}.json');\nexports.${name} = ${name};\n`
  );
}

const { timezones } = await import(
  pathToFileURL(path.join(projectRoot, 'src/mapping/timezones.ts')).href
);
const { geo } = await import(pathToFileURL(path.join(projectRoot, 'src/mapping/geo.ts')).href);

writeSharedMapping('timezones', timezones);
writeSharedMapping('geo', geo);

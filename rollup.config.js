import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import pkg from './package.json' assert { type: 'json' };


const dependencies = Object.keys(pkg.dependencies || {});
const peerDependencies = Object.keys(pkg.peerDependencies || {});
const externalBase = [...dependencies, ...peerDependencies];

// ESM build: bundle Day.js & its plugins by excluding them from external
const externalEsm = externalBase.filter(dep => dep !== 'dayjs');

// CJS build: externalize everything
const externalCjs = externalBase;

export default [
  // ESM build
  {
    input: 'src/index.ts',
    external: externalEsm,
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        compilerOptions: { outDir: undefined }
      })
    ],
    output: {
      dir: 'dist/esm',
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js'
    }
  },

  // CJS build
  {
    input: 'src/index.ts',
    external: externalCjs,
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        compilerOptions: { outDir: undefined }
      })
    ],
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].js'
    }
  }
];

import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import pkg from './package.json' with { type: 'json' };


const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const sharedPlugins = () => [
  resolve(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: false,
    compilerOptions: { outDir: undefined }
  })
];

export default [
  // ESM build
  {
    input: 'src/index.ts',
    external,
    plugins: sharedPlugins(),
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
    external,
    plugins: sharedPlugins(),
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: '[name].cjs'
    }
  }
];

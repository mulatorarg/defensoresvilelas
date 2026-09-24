import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-plugin-react no puede autodetectar la versión con ESLint 10
    // (usa context.getFilename, eliminado): se fija a mano.
    settings: { react: { version: '19.3' } },
    rules: {
      // Los datos se cargan con TanStack Query (lib/queries.ts), no con fetch +
      // setState dentro de useEffect: la regla queda como error.
      'react-hooks/set-state-in-effect': 'error',
    },
  },
  {
    // Archivo de configuración CommonJS que Next carga con require()
    files: ['next.config.js', 'postcss.config.js'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  globalIgnores(['.next/**', 'dist/**', 'out/**', 'next-env.d.ts']),
]);

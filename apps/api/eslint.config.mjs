import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // errores reales — bloquean el CI
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['error', { allow: ['error', 'warn'] }],

      // advertencias — no bloquean pero aparecen en el output
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // los tests tienen reglas más relajadas
    files: ['src/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
  {
    // ignorar archivos generados
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  }
);
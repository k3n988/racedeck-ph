import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

export default defineConfig(({ mode }) => { Object.assign(process.env, loadEnv(mode, path.resolve(__dirname), '')); return { envDir: path.resolve(__dirname), resolve: { alias: { '@': path.resolve(__dirname) } }, test: { pool: 'threads', poolOptions: { threads: { singleThread: true } } } }; });

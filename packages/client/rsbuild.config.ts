import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';
import { pluginNodePolyfill } from '@rsbuild/plugin-node-polyfill';
import type { Rspack, RsbuildConfig } from '@rsbuild/core';
import { pluginSass } from '@rsbuild/plugin-sass';
import serve from 'serve-static';
import path from 'path';
import fs from 'fs';
import {
  ClientEntry,
  DistPath,
  PortForCLI,
  PortForWeb,
  WebpackRsdoctorDirPath,
  WebpackStatsFilePath,
} from './config/constants';

const {
  ENABLE_DEVTOOLS_PLUGIN,
  OFFICAL_PREVIEW_PUBLIC_PATH,
  OFFICAL_DEMO_MANIFEST_PATH,
  ENABLE_CLIENT_SERVER,
} = process.env;

export default defineConfig(({ env }) => {
  const IS_PRODUCTION = env === 'production';

  const config: RsbuildConfig = {
    plugins: [
      pluginReact(),
      pluginNodePolyfill(),
      pluginSass(),
      pluginTypeCheck({ enable: IS_PRODUCTION }),
    ],

    source: {
      entry: {
        index: ClientEntry,
      },
      define: {
        'process.env.NODE_DEBUG': JSON.stringify(false),
        'process.env.NODE_ENV': JSON.stringify(env),
        'process.env.OFFICAL_DEMO_MANIFEST_PATH': JSON.stringify(
          OFFICAL_DEMO_MANIFEST_PATH,
        ),
        'process.env.LOCAL_CLI_PORT': JSON.stringify(PortForCLI),
      },
    },

    output: {
      externals: {
        lz4: 'window.lz4',
      },
      distPath: {
        root: path.basename(DistPath),
        js: 'resource/js',
        css: 'resource/css',
        svg: 'resource/svg',
        font: 'resource/font',
        image: 'resource/image',
        media: 'resource/media',
      },
      assetPrefix: IS_PRODUCTION
        ? OFFICAL_PREVIEW_PUBLIC_PATH?.replace(/\/resource$/, '') || '/'
        : '/',
      cleanDistPath: IS_PRODUCTION,
      sourceMap: {
        js: false,
        css: false,
      },
      legalComments: 'none',
      minify: false,
    },
    html: {
      title: 'Rsdoctor',
      tags: [
        {
          tag: 'script',
          attrs: {
            src: 'https://cdn.jsdelivr.net/npm/lz4@0.6.5/build/lz4.min.js',
          },
          head: false,
          publicPath: false,
        },
        {
          tag: 'script',
          children: "window.lz4 = require('lz4')",
          head: false,
        },
      ],
    },

    performance: {
      buildCache: false,
      chunkSplit: {
        strategy: 'custom',
        splitChunks: {
          cacheGroups: {
            monaco: {
              test: /node_modules\/monaco-editor\/*/,
              name: 'monaco',
              chunks: 'all',
              maxSize: 1000000,
              minSize: 500000,
            },
          },
        },
      },
    },

    tools: {
      bundlerChain: (chainConfig) => {
        if (ENABLE_DEVTOOLS_PLUGIN) {
          const { RsdoctorRspackPlugin } =
            require('../rspack-plugin/dist') as typeof import('../rspack-plugin/dist');

          class StatsWriter {
            apply(compiler: Rspack.Compiler) {
              compiler.hooks.done.tapPromise(
                { name: 'webpack-stats-json-writer', stage: 99999 },
                async (stats) => {
                  const json = stats.toJson({
                    all: false,
                    assets: true,
                    chunks: true,
                    modules: true,
                    builtAt: true,
                    hash: true,
                    ids: true,
                    version: true,
                    entrypoints: true,
                  });
                  await fs.promises.writeFile(
                    WebpackStatsFilePath,
                    JSON.stringify(json, null, 2),
                    'utf-8',
                  );
                },
              );
            }
          }

          chainConfig.plugin('stats-writer').use(StatsWriter);
          chainConfig.plugin('rsdoctor').use(RsdoctorRspackPlugin, [
            {
              disableClientServer: !ENABLE_CLIENT_SERVER,
              features: {
                loader: true,
                plugins: true,
                resolver: true,
                bundle: true,
                treeShaking: true,
              },
            },
          ]);
        }
      },
    },

    server: {
      port: PortForWeb,
      historyApiFallback: true,
    },

    dev: {
      startUrl: ENABLE_CLIENT_SERVER ? undefined : true,
      setupMiddlewares: [
        (middlewares) => {
          if (fs.existsSync(WebpackRsdoctorDirPath)) {
            const fn = serve(WebpackRsdoctorDirPath, {
              index: false,
              setHeaders(res) {
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              },
            });
            middlewares.push(fn);
          }
        },
      ],
    },
  };

  return config;
});

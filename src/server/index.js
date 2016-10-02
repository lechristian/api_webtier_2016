/* ==========================================================================
 * ./src/server/index.js
 *
 * Server
 * ========================================================================== */

process.env.BROWSER = null;

const logger = require('+/logger')('server:index');

import bootstrapClient from '@/bootstrapClient';
import inert from 'inert';
import good from 'good';
import hapiWebpackPlugin from 'hapi-webpack-plugin';
import path from 'path';
import routes from '@/routes';
import webpack from 'webpack';
import webpackConfig from '&/webpack.config';
import { Server } from 'hapi';

const env = process.env.NODE_ENV;
const serveDir = env === 'development' ? 'src' : 'dist';

const server = new Server();
server.connection({
  port: 3000
});


const hapiPlugins = [
  {
    register: good,
    options: {
      reporters: {
        consoleReporter: [
          {
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{
              log: '*',
              response: '*'
            }]
          },
          {
            module: 'good-console',
            args: [{
              format: 'M/DD/YY - HH:mm:ss'
            }]
          },
          'stdout'
        ]
      }
    }
  },
  inert
];

if (process.env.NODE_ENV === 'development') {
  const compiler = webpack(webpackConfig);
  const assets = require('&/devConfig');

  const hot = {};

  hapiPlugins.push({
    register: hapiWebpackPlugin,
    options: { compiler, assets, hot }
  });
}

try {
  server.register(hapiPlugins, (err) => {
    if (err) {
      throw new Error(err);
    }
  });
} catch (error) {
  logger.error(error);
  process.exit(1); // eslint-disable-line no-process-exit
}

// API Routes
server.route(routes);

// Catch dynamic requests and bootstrap React
server.ext('onPreResponse', (request, reply) => {
  const response = request.response;

  if (response.statusCode) {
    if (response.source.error) {
      const boomMethod = response.source.boom;
      const message = response.source.message;
      const data = response.source.data;
      const error = boomMethod(message);
      error.output.payload.data = data;

      return reply(error);
    }

    return reply.continue();
  }

  return bootstrapClient(request, reply);
});

// Watch and notify when server stops
server.on('close', () => {
  logger.info('==!> App as been closed.');
});

// Server Control
export function start() {
  server.start(() => {
    const portUsed = server.info.port;
    const notice = `--> App listening at port: ${portUsed}`;
    logger.info(notice);
  });
}

export function close() {
  if (server) {
    server.stop();
  }
}


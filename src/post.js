'use strict';

import * as subscriber from './subscriber';

const debug = require('debug')('wb:post');
debug('required');

/**
 * Корневой обработчик post-запросов
 * @param ctx
 * @param next
 * @return {Promise.<*>}
 */
export default async (ctx, next) => {
  // проверяем загрузку подписчиков
  if (!subscriber.isLoaded()) {
    return subscriber.loadingSubscribers(ctx, next);
  }

  try {
    switch (ctx.params.action) {
    case 'subscribe':
      return await subscriber.addSubscribe(ctx, next);
    case 'unsubscribe':
      return await subscriber.delSubscribe(ctx, next);
    default:
      ctx.status = 404;
      ctx.body = {
        error: true,
        message: `Неизвестная ссылка ${ctx.params.action}`,
      };
    }
  }
  catch (err) {
    ctx.status = 500;
    ctx.body = {
      error: true,
      message: err.stack || err.message,
    };
    debug(err);
  }
};

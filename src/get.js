'use strict';

import * as subscriber from './subscriber';

const debug = require('debug')('wb:get');
debug('required');

/**
 * Возвращает в body лог отдела за нужный день
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
async function log(ctx, next) {
  // данные авторизации получаем из контекста
  const {_auth, params} = ctx;
  const _id = `_local/log.subscriber.${_auth.suffix}.${params.id}`;
  ctx.body = await subscriber.pouch_doc.get(_id)
    .catch((err) => ({error: true, message: `Объект ${_id} не найден\n${err.message}`}));
}

/**
 * Корневой обработчик get-запросов
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
    case 'status':
      return await subscriber.status(ctx, next);
    case 'log':
      return await log(ctx, next);
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

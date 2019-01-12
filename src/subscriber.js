/**
 * ### Модуль подписания на события баз данных
 *
 * @module  subscriber
 *
 * Created 14.12.2018
 */

'use strict';

import moment from 'moment';

const PouchDB = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-http'))
  .plugin(require('pouchdb-find'));

// параметры сеанса
import settings from '../config/subscriber.settings';

const debug = require('debug')('wb:subscriber');
debug('required');

const exchange = require('./exchange');

const { couch_local, zone, user_node } = settings();
const class_name = 'subscribers';
// прослушиваемые базы данных
const dbs = new Map();
// активные подписчики
const subscribers = new Map();
// признак загрузки подписчиков в память
let loaded = false;
// нулевой guid
const blank_guid = "00000000-0000-0000-0000-000000000000";

// подключаемся к центральной БД, где хранятся документы подписчиков и логи сервиса
export const pouch_doc = new PouchDB(`${couch_local}${zone}_doc`, {
  adapter: 'http',
  auth: user_node
});

/**
 * Возвращает сгенерированный guid
 * @return {String}
 */
function generate_guid() {
  var d = new Date().getTime();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = (d + Math.random()*16)%16 | 0;
    d = Math.floor(d/16);
    return (c=='x' ? r : (r&0x7|0x8)).toString(16);
  });
};

/**
 * Возвращает экземпляр подписки на прослушивание изменений в БД
 * @param {Object}
 * @return {Promise.<Object>}
 */
function addListener({suffix, filter, service, body}) {
  if (!dbs.has(suffix)) {
    dbs.set(suffix, new PouchDB(`${couch_local}${zone}_doc${suffix === '0000' ? '' : '_' + suffix}`, {
      adapter: 'http',
      auth: user_node
    }));
  }

  return dbs.get(suffix).changes(Object.assign({
    since: 'now',
    live: true
  }, filter)).on('change', change => {
    const ref = change.id.replace('|', '/');

    // оповещаем сервис об изменениях в базе данных
    switch (service) {
      case 'wb-exchange':
        // отправляем запрос сервису обмена
        exchange({
          ref,
          suffix,
          body: JSON.stringify(body)
        })
          .then(res => {
            if (res.error) {
              debug(`error: sent to exchange service with ref=${ref}: ${res.message}`);
            }
          });
        break;
      default:
        debug(`error: bad service for ref=${ref}`);
        break;
    }

  }).on('error', err => {
    debug(`change error ${err}`);
  });
}

/**
 * Подписывает всех подписчиков
 * @param {Object}
 * @return {Promise.<Object>}
 */
function signSubscribers({ subscribers, skip, limit }) {
  const obj = { selector: { class_name }, skip, limit };

  return pouch_doc.find(obj).then(res => {
    for (const doc of res.docs) {
      // подписываем подписчиков
      for (const { id, filter, service, recipient } of doc.subscribers) {
        // подписываемся на рассылку
        const listener = addListener({
          suffix: doc.suffix,
          filter,
          service,
          body: recipient
        });
        // добавляем прослушиватель подписчика
        subscribers.set(`${doc.suffix}-${id}`, listener);
      }
    }
    const processed = skip + limit;
    return !res.total_rows || res.total_rows < processed
      ? subscribers
      : signSubscribers({ subscribers, skip: processed, limit });
  }).catch(err => {
    debug(`sign to ${obj} error: ${err}`);
  });
}

// подписываем подписчиков на прослушивание
signSubscribers({subscribers, skip: 0, limit: 100})
  .then(res => {
    // выставляем флаг окончания загрузки подписчиков
    loaded = true;

    debug(`sign READY`);
  })
  .catch(err => {
    debug(`sign error: ${err}`);
  });

/**
 * Возвращает идентификатор документа с подписками
 * @param ctx
 * @return {String}
 */
function idDoc(ctx) {
  return `${class_name}.${(ctx._auth && ctx._auth.suffix) || '0000'}`;
}

/**
 * Возвращает в body результат добавления подписки
 * 
 * Пример подписки на изменение документа заказа с последующей передачей запроса
 * сервису обмена, для сбора данных заказа и отправки через транспорт запрос на
 * удаленный ресурс полученных данных
 * 
 * {
 *     "filter": {
 *         "selector": {
 *             "class_name": "doc.calc_order"
 *         }
 *     },
 *     "service": "wb-exchange",
 *     "recipient": {
 *         "transport": "request",
 *         "url": "http://localhost:3025/api",
 *         "headers": {
 *             "accept": "application/json"
 *         },
 *         "data": {
 *             "document_id": {
 *                 "_owner": "wb-exchange",
 *                 "name": "ref"
 *             },
 *             "products": {
 *                 "_owner": "wb-exchange",
 *                 "name": "Продукция",
 *                 "fields": {
 *                     "name": {
 *                         "_owner": "wb-exchange",
 *                         "name": "Номенклатура"
 *                     },
 *                     "characteristic": {
 *                         "_owner": "wb-exchange",
 *                         "name": "Характеристика"
 *                     }
 *                 }
 *             },
 *             "production": {
 *                 "_owner": "wb-exchange",
 *                 "name": "production",
 *                 "fields": {
 *                     "nom": {
 *                         "_owner": "wb-exchange",
 *                         "name": [
 *                             "nom",
 *                             "name"
 *                         ]
 *                     }
 *                 }
 *             },
 *             "КонтрагентАдрес": {
 *                 "_owner": "wb-exchange",
 *                 "name": "КонтрагентАдрес"
 *             }
 *         }
 *     }
 * }
 * 
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
export async function addSubscribe(ctx, next) {
  // получаем идентификатор подписчика и суффикс
  let id = ctx.params.id || blank_guid;
  const suffix = (ctx._auth && ctx._auth.suffix) || '0000';

  ctx._id = idDoc(ctx);

  // собираем объект подписчика
  const subscriber = Object.assign({}, ctx._query, {
    date: moment().format('YYYYMMDD'),
  });

  // проверяем переданные данные
  if (!subscriber['selector'] || !subscriber.recipient || ['url', 'headers', 'data'].some(item => !subscriber.recipient[item])) {
    ctx.body = {
      error: true,
      message: `Отсутствуют необходимые поля для создания подписки.`
    };
    return;
  }

  ctx.body = await pouch_doc.get(ctx._id)
    .catch(err => {
      if (err.status === 404) {
        // создаем документ подписчиков, если не найден
        return {
          _id: ctx._id,
          class_name,
          suffix,
          subscribers: []
        };
      }

      return {
        error: true,
        message: `Объект ${ctx._id} не найден\n${err.message}`
      };
    })
    .then(rev => {
      if (rev.subscribers) {
        // проверяем id на пустой guid
        if (id === blank_guid) {
          // генерируем id подписки
          while (true) {
            id = generate_guid();
            if (!rev.subscribers.find(subscr => subscr.id === id)) {
              break;
            }
          }
        } else {
          // проверяем на существование подписчика
          if (rev.subscribers.find(subscr => subscr.id === id)) {
            return {
              error: true,
              message: `Подписка на ${id} уже существует.`,
            }
          }
        }

        // задаем переданный/сгенерированный id
        subscriber.id = id;

        // добавляем подписчика к текущей версии документа
        rev.subscribers.push(subscriber);
        // передаем в БД
        return pouch_doc.put(rev)
          .then(rev => {
            const { filter, service, recipient } = subscriber;

            // подписываемся на рассылку
            const listener = addListener({
              suffix,
              filter,
              service,
              body: recipient
            });
            // добавляем прослушиватель подписчика
            subscribers.set(`${suffix}-${id}`, listener);

            return {
              id,
              message: `Запрос на добавление подписчика успешно выполнен!`,
            }
          })
          .catch(err => {
            return {
              error: true,
              message: `Объект ${ctx._id} не создан\n${err.message}`,
            }
          });
      }
    });
}

/**
 * Возвращает в body результат удаления подписки
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
export async function delSubscribe(ctx, next) {
  // получаем идентификатор подписчика и суффикс
  const { id } = ctx.params;
  const suffix = (ctx._auth && ctx._auth.suffix) || '0000';

  ctx._id = idDoc(ctx);

   ctx.body = await pouch_doc.get(ctx._id)
    .catch(err => {
      return {
        error: true,
        message: `Объект ${ctx._id} не найден\n${err.message}`
      };
    })
    .then(rev => {
      if (rev.subscribers) {
        // проверяем на существование подписчика
        const found = rev.subscribers.findIndex(subscr => subscr.id === id);
        if (found === -1) {
          return {
            message: `Подписчик ${id} не существует.`,
          }
        }

        // удаляем подписчика из документа
        rev.subscribers.splice(found, 1);

        // передаем в БД
        return pouch_doc.put(rev)
          .then(rev => {
            const subid = `${suffix}-${id}`;
            // отменяем прослушиватель подписчика
            const listener = subscribers.get(subid);
            listener && listener.cancel();
            // удаляем подписчика из памяти
            subscribers.delete(subid);

            return {
              message: `Запрос на удаление подписчика успешно выполнен!`,
            }
          })
          .catch(err => {
            return {
              error: true,
              message: `Объект ${ctx._id} не создан\n${err.message}`,
            }
          });
      }
    });
}

/**
 * Возвращает в body статус подписчика
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
export async function status(ctx, next) {
  const { params } = ctx;
  //const suffix = (ctx._auth && ctx._auth.suffix) || '0000';

  ctx._id = idDoc(ctx);

  if (params.id !== 'all') {
    ctx.body = {
      error: true,
      message: `Статус отдельной подписки временно не поддерживается.`,
    }
  }

  /*const res = await pouch_doc.find({
    selector: {
      '$and': [
        { class_name },
        { suffix }
      ]
    }
  })*/

  const res = await pouch_doc.get(ctx._id)
    .catch(err => {
      return {
        error: true,
        message: `Объект ${ctx._id} не создан\n${err.message}`,
      }
    });

  ctx.body = res.subscribers && res.subscribers.length > 0 ? res.subscribers : {
    message: `Подписчики не найдены!`
  };
}

/**
 * Возвращает в body статус загрузки подписчиков
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
export function isLoaded() {
  return loaded;
}

/**
 * Возвращает в body статус загрузки подписчиков
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
export function loadingSubscribers(ctx, next) {
  ctx.status = 500;
  ctx.body = {
    error: true,
    message: `Подписчики загружаются в память, повторите запрос позже!`,
  };
}

module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 4);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = require("debug");

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


// конфигурация подключения к CouchDB
const config = __webpack_require__(7);

/**
 * ### При установке параметров сеанса
 * Процедура устанавливает параметры работы программы по умолчанию из package.json
 *
 * @param prm {Object} - в свойствах этого объекта определяем параметры работы программы
 */

module.exports = prm => {

  const base = config(prm);
  return Object.assign(base, {

    // расположение сервиса обмена
    exchange_url: process.env.EXCHANGE_URL || `http://localhost:3021/exchange`

  });
};

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/**
 *
 *
 * @module subscriber
 *
 */



Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.pouch_doc = undefined;
exports.addSubscribe = addSubscribe;
exports.delSubscribe = delSubscribe;
exports.status = status;
exports.isLoaded = isLoaded;
exports.loadingSubscribers = loadingSubscribers;

var _moment = __webpack_require__(3);

var _moment2 = _interopRequireDefault(_moment);

var _subscriber = __webpack_require__(1);

var _subscriber2 = _interopRequireDefault(_subscriber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const PouchDB = __webpack_require__(8).plugin(__webpack_require__(9)).plugin(__webpack_require__(10));

// параметры сеанса


const debug = __webpack_require__(0)('wb:subscriber');
debug('required');

const exchange = __webpack_require__(11);

const { couch_local, zone, user_node } = (0, _subscriber2.default)();
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
const pouch_doc = exports.pouch_doc = new PouchDB(`${couch_local}${zone}_doc`, {
  adapter: 'http',
  auth: user_node
});

/**
 * Возвращает сгенерированный guid
 * @return {String}
 */
function generate_guid() {
  var d = new Date().getTime();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : r & 0x7 | 0x8).toString(16);
  });
};

/**
 * Возвращает экземпляр подписки на прослушивание изменений в БД
 * @param {Object}
 * @return {Promise.<Object>}
 */
function addListener({ suffix, filter, service, body }) {
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
        }).then(res => {
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

// подписываем всех подписчиков
function signSubscribers({ subscribers, skip, limit }) {
  const obj = { selector: { class_name }, skip, limit };

  return pouch_doc.find(obj).then(res => {
    for (const doc of res.docs) {
      // подписываем подписчиков
      for (const _ref of doc.subscribers) {
        const { id, filter, service, recipient } = _ref;

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
    return !res.total_rows || res.total_rows < processed ? subscribers : signSubscribers({ subscribers, skip: processed, limit });
  }).catch(err => {
    debug(`sign to ${obj} error: ${err}`);
  });
}

// подписываем подписчиков на прослушивание
signSubscribers({ subscribers, skip: 0, limit: 100 }).then(res => {
  // выставляем флаг окончания загрузки подписчиков
  loaded = true;

  debug(`READY`);
}).catch(err => {
  debug(`sign error: ${err}`);
});

/**
 * Возвращает идентификатор документа с подписками
 * @param ctx
 * @return {String}
 */
function idDoc(ctx) {
  return `${class_name}.${ctx._auth && ctx._auth.suffix || '0000'}`;
}

/**
 * Возвращает в body результат добавления подписки
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
async function addSubscribe(ctx, next) {
  // получаем идентификатор подписчика и суффикс
  let id = ctx.params.id || blank_guid;
  const suffix = ctx._auth && ctx._auth.suffix || '0000';

  ctx._id = idDoc(ctx);

  // собираем объект подписчика
  const subscriber = Object.assign({}, ctx._query, {
    date: (0, _moment2.default)().format('YYYYMMDD')
  });

  // проверяем переданные данные
  if (!subscriber['selector'] || !subscriber.recipient || ['url', 'headers', 'data'].some(item => !subscriber.recipient[item])) {
    ctx.body = {
      error: true,
      message: `Отсутствуют необходимые поля для создания подписки.`
    };
    return;
  }

  ctx.body = await pouch_doc.get(ctx._id).catch(err => {
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
  }).then(rev => {
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
            message: `Подписка на ${id} уже существует.`
          };
        }
      }

      // задаем переданный/сгенерированный id
      subscriber.id = id;

      // добавляем подписчика к текущей версии документа
      rev.subscribers.push(subscriber);
      // передаем в БД
      return pouch_doc.put(rev).then(rev => {
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
          message: `Запрос на добавление подписчика успешно выполнен!`
        };
      }).catch(err => {
        return {
          error: true,
          message: `Объект ${ctx._id} не создан\n${err.message}`
        };
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
async function delSubscribe(ctx, next) {
  // получаем идентификатор подписчика и суффикс
  const { id } = ctx.params;
  const suffix = ctx._auth && ctx._auth.suffix || '0000';

  ctx._id = idDoc(ctx);

  ctx.body = await pouch_doc.get(ctx._id).catch(err => {
    return {
      error: true,
      message: `Объект ${ctx._id} не найден\n${err.message}`
    };
  }).then(rev => {
    if (rev.subscribers) {
      // проверяем на существование подписчика
      const found = rev.subscribers.findIndex(subscr => subscr.id === id);
      if (found === -1) {
        return {
          message: `Подписчик ${id} не существует.`
        };
      }

      // удаляем подписчика из документа
      rev.subscribers.splice(found, 1);

      // передаем в БД
      return pouch_doc.put(rev).then(rev => {
        const subid = `${suffix}-${id}`;
        // отменяем прослушиватель подписчика
        const listener = subscribers.get(subid);
        listener && listener.cancel();
        // удаляем подписчика из памяти
        subscribers.delete(subid);

        return {
          message: `Запрос на удаление подписчика успешно выполнен!`
        };
      }).catch(err => {
        return {
          error: true,
          message: `Объект ${ctx._id} не создан\n${err.message}`
        };
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
async function status(ctx, next) {
  const { params } = ctx;
  //const suffix = (ctx._auth && ctx._auth.suffix) || '0000';

  ctx._id = idDoc(ctx);

  if (params.id !== 'all') {
    ctx.body = {
      error: true,
      message: `Статус отдельной подписки временно не поддерживается.`
    };
  }

  /*const res = await pouch_doc.find({
    selector: {
      '$and': [
        { class_name },
        { suffix }
      ]
    }
  })*/

  const res = await pouch_doc.get(ctx._id).catch(err => {
    return {
      error: true,
      message: `Объект ${ctx._id} не создан\n${err.message}`
    };
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
function isLoaded() {
  return loaded;
}

/**
 * Возвращает в body статус загрузки подписчиков
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
function loadingSubscribers(ctx, next) {
  ctx.status = 500;
  ctx.body = {
    error: true,
    message: `Подписчики загружаются в память, повторите запрос позже!`
  };
}

/***/ }),
/* 3 */
/***/ (function(module, exports) {

module.exports = require("moment");

/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(5);


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _log = __webpack_require__(6);

var _log2 = _interopRequireDefault(_log);

var _router = __webpack_require__(15);

var _router2 = _interopRequireDefault(_router);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

process.env.DEBUG = 'wb:,-not_this';

const Koa = __webpack_require__(19);
const app = new Koa();

// Register the cors as Koa middleware
const cors = __webpack_require__(20);
app.use(cors({ credentials: true, maxAge: 600 }));

// Register the logger as Koa middleware

app.use(_log2.default);

// Register the router as Koa middleware

app.use(_router2.default.middleware());

app.listen(process.env.PORT || 3021);
app.restrict_ips = process.env.IPS ? process.env.IPS.split(',') : [];

exports.default = app;

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _moment = __webpack_require__(3);

var _moment2 = _interopRequireDefault(_moment);

var _subscriber = __webpack_require__(1);

var _subscriber2 = _interopRequireDefault(_subscriber);

var _subscriber3 = __webpack_require__(2);

var _auth = __webpack_require__(13);

var _auth2 = _interopRequireDefault(_auth);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 *
 *
 * @module log
 *
 * Created by Evgeniy Malyarov on 23.09.2017.
 */

function getBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', chunk => {
      if (data.length > 0 && data.charCodeAt(0) == 65279) {
        data = data.substr(1);
      }
      resolve(data);
    });
  });
}

async function saveLog({ _id, log, start, body }) {
  return _subscriber3.pouch_doc.get(_id).catch(err => {
    if (err.status == 404) {
      return { _id, rows: [] };
    }
  }).then(rev => {
    if (rev) {
      log.response = body || '';
      log.duration = Date.now() - parseInt(start.format('x'), 10);
      if (rev.events) {
        rev.rows = rev.events;
        delete rev.events;
      }
      rev.rows.push(log);
      return _subscriber3.pouch_doc.put(rev);
    }
  });
}

exports.default = async (ctx, next) => {

  if (ctx.method !== 'GET' && ctx.method !== 'POST') {
    return next();
  }

  // request
  const start = (0, _moment2.default)();

  // проверяем ограничение по ip и авторизацию
  ctx._auth = await (0, _auth2.default)(ctx, (0, _subscriber2.default)());
  const _id = `_local/log.subscriber.${ctx._auth && ctx._auth.suffix || '0000'}.${start.format('YYYYMMDD')}`;

  // собираем объект лога
  const log = {
    start: start.format('HH:mm:ss'),
    url: ctx.originalUrl,
    method: ctx.method,
    ip: ctx.req.headers['x-real-ip'] || ctx.ip,
    //headers: Object.keys(ctx.req.headers).map((key) => [key, ctx.req.headers[key]]),
    headers: ctx.req.headers
  };

  if (ctx._auth) {
    try {
      // тело запроса анализируем только для авторизованных пользователей
      log.post_data = await getBody(ctx.req);
      ctx._query = log.post_data.length > 0 ? JSON.parse(log.post_data) : {};
      // передаём управление основной задаче
      await next();
      // по завершению, записываем лог
      saveLog({ _id, log, start, body: log.url.indexOf('/log') === -1 ? ctx.body : 'log information before this request' });
    } catch (err) {
      // в случае ошибки, так же, записываем лог
      log.error = err.message;
      saveLog({ _id, log, start });
      throw err;
    }
  } else {
    // для неавторизованных пользователей записываем лог
    log.error = 'unauthorized';
    saveLog({ _id, log, start, body: ctx.body });
  }
};

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * ### При установке параметров сеанса
 * Процедура устанавливает параметры работы программы при старте веб-приложения
 *
 * @param prm {Object} - в свойствах этого объекта определяем параметры работы программы
 */
module.exports = function settings(prm) {

    return Object.assign(prm || {}, {

        // разделитель для localStorage
        local_storage_prefix: "wb_",

        // гостевые пользователи для демо-режима
        guests: [],

        // расположение couchdb
        couch_path: process.env.COUCHPATH || process.env.COUCHLOCAL || "http://localhost:5984/wb_",

        // расположение couchdb для nodejs
        couch_local: process.env.COUCHLOCAL || "http://localhost:5984/wb_",

        couch_direct: true,

        // авторизация couchdb
        user_node: {
            username: process.env.DBUSER || 'admin',
            password: process.env.DBPWD || 'admin'
        },

        pouch_filter: {
            meta: "auth/meta"
        },

        // по умолчанию, обращаемся к зоне 21
        zone: process.env.ZONE || 21,

        // объявляем номер демо-зоны
        zone_demo: 1,

        // если use_meta === false, не используем базу meta в рантайме
        // см.: https://github.com/oknosoft/metadata.js/issues/255
        use_meta: false,

        // размер вложений
        attachment_max_size: 10000000

    });
};

/***/ }),
/* 8 */
/***/ (function(module, exports) {

module.exports = require("pouchdb-core");

/***/ }),
/* 9 */
/***/ (function(module, exports) {

module.exports = require("pouchdb-adapter-http");

/***/ }),
/* 10 */
/***/ (function(module, exports) {

module.exports = require("pouchdb-find");

/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _subscriber = __webpack_require__(1);

var _subscriber2 = _interopRequireDefault(_subscriber);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const fetch = __webpack_require__(12); /**
                                      * Отправляет запрос сервису обмена
                                      *
                                      * @module exchange
                                      *
                                      * Created by Rostislav Poddorogin on 06.01.2019.
                                      */

// параметры сеанса

const { user_node: { username, password }, exchange_url } = (0, _subscriber2.default)();

module.exports = function ({ ref, suffix, body }) {
  const url = `${exchange_url}/${ref}`;

  return fetch(url, {
    method: "POST",
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + Buffer.from(username + ":" + password).toString('base64'),
      suffix
    },
    body
  }).then(({ status }) => {
    if (status > 200) {
      return {
        error: true,
        message: `Запрос к сервису ${exchange_url} на ссылку ${ref} завершился кодом ${status}`
      };
    }
    return {
      message: `Запрос к сервису ${exchange_url} на ссылку ${ref} завершился успешно`
    };
  }).catch(err => {
    return {
      error: true,
      message: `Запрос к сервису ${exchange_url} со ссылкой ${ref} завершился ошибкой ${err.message}`
    };
  });
};

/***/ }),
/* 12 */
/***/ (function(module, exports) {

module.exports = require("node-fetch");

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _request = __webpack_require__(14);

var _request2 = _interopRequireDefault(_request);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = async (ctx, settings) => {

  // если указано ограничение по ip - проверяем
  const { restrict_ips } = ctx.app;
  if (restrict_ips.length && restrict_ips.indexOf(ctx.req.headers['x-real-ip'] || ctx.ip) == -1) {
    ctx.status = 403;
    ctx.body = 'ip restricted:' + ctx.ip;
    return;
  }

  let { authorization, suffix } = ctx.req.headers;
  if (!authorization) {
    ctx.status = 403;
    ctx.body = 'access denied';
    return;
  }

  const { couch_local, zone } = settings;
  let user;
  const resp = await new Promise((resolve, reject) => {

    try {
      const auth = new Buffer(authorization.substr(6), 'base64').toString();
      const sep = auth.indexOf(':');
      const pass = auth.substr(sep + 1);
      user = auth.substr(0, sep);

      if (!suffix) {
        suffix = '';
      }
      //else{
      while (suffix.length < 4) {
        suffix = '0' + suffix;
      }
      //}

      (0, _request2.default)({
        url: couch_local + zone + (suffix !== '0000' ? '_doc_' + suffix : '_doc'),
        auth: { user, pass, sendImmediately: true }
      }, (e, r, body) => {
        if (r && r.statusCode < 201) {
          resolve(true);
        } else {
          ctx.status = r && r.statusCode || 500;
          ctx.body = body || e && e.message;
          resolve(false);
        }
      });
    } catch (e) {
      ctx.status = 500;
      ctx.body = e.message;
      resolve(false);
    }
  });

  return resp && { user, suffix };
};

/***/ }),
/* 14 */
/***/ (function(module, exports) {

module.exports = require("request");

/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _koaBetterRouter = __webpack_require__(16);

var _koaBetterRouter2 = _interopRequireDefault(_koaBetterRouter);

var _get = __webpack_require__(17);

var _get2 = _interopRequireDefault(_get);

var _post = __webpack_require__(18);

var _post2 = _interopRequireDefault(_post);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = __webpack_require__(0)('wb:router');
debug('start');

const router = (0, _koaBetterRouter2.default)({ prefix: '/subscriber' });

router.loadMethods().get('/:action/:id', _get2.default).post('/:action/:id', _post2.default);

exports.default = router;

/***/ }),
/* 16 */
/***/ (function(module, exports) {

module.exports = require("koa-better-router");

/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _subscriber = __webpack_require__(2);

var subscriber = _interopRequireWildcard(_subscriber);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const debug = __webpack_require__(0)('wb:get');
debug('required');

/**
 * Возвращает в body лог отдела за нужный день
 * @param ctx
 * @param next
 * @return {Promise.<void>}
 */
async function log(ctx, next) {
  // данные авторизации получаем из контекста
  const { _auth, params } = ctx;
  const _id = `_local/log.subscriber.${_auth.suffix}.${params.id}`;
  ctx.body = await subscriber.pouch_doc.get(_id).catch(err => ({ error: true, message: `Объект ${_id} не найден\n${err.message}` }));
}

/**
 * Корневой обработчик get-запросов
 * @param ctx
 * @param next
 * @return {Promise.<*>}
 */

exports.default = async (ctx, next) => {
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
          message: `Неизвестная ссылка ${ctx.params.action}`
        };
    }
  } catch (err) {
    ctx.status = 500;
    ctx.body = {
      error: true,
      message: err.stack || err.message
    };
    debug(err);
  }
};

/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var _subscriber = __webpack_require__(2);

var subscriber = _interopRequireWildcard(_subscriber);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

const debug = __webpack_require__(0)('wb:post');
debug('required');

/**
 * Корневой обработчик post-запросов
 * @param ctx
 * @param next
 * @return {Promise.<*>}
 */

exports.default = async (ctx, next) => {
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
          message: `Неизвестная ссылка ${ctx.params.action}`
        };
    }
  } catch (err) {
    ctx.status = 500;
    ctx.body = {
      error: true,
      message: err.stack || err.message
    };
    debug(err);
  }
};

/***/ }),
/* 19 */
/***/ (function(module, exports) {

module.exports = require("koa");

/***/ }),
/* 20 */
/***/ (function(module, exports) {

module.exports = require("@koa/cors");

/***/ })
/******/ ]);
//# sourceMappingURL=index.js.map
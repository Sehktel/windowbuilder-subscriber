/**
 *
 *
 * @module log
 *
 * Created by Evgeniy Malyarov on 23.09.2017.
 */

import moment from 'moment';
import settings from '../config/subscriber.settings';
import { pouch_doc } from './subscriber';
import auth from './auth';

function getBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => data += chunk);
    req.on('end', (chunk) => {
      if(data.length > 0 && data.charCodeAt(0) == 65279) {
        data = data.substr(1);
      }
      resolve(data);
    });
  });
}

async function saveLog({_id, log, start, body}) {
  return pouch_doc.get(_id)
    .catch((err) => {
      if(err.status == 404) {
        return {_id, rows: []};
      }
    })
    .then((rev) => {
      if(rev){
        log.response = body || '';
        log.duration = Date.now() - parseInt(start.format('x'), 10);
        if(rev.events){
          rev.rows = rev.events;
          delete rev.events;
        }
        rev.rows.push(log);
        return pouch_doc.put(rev);
      }
    });
}

export default async (ctx, next) => {

  if(ctx.method !== 'GET' && ctx.method !== 'POST'){
    return next();
  }

  // request
  const start = moment();

  // проверяем ограничение по ip и авторизацию
  ctx._auth = await auth(ctx, settings());
  const _id = `_local/log.subscriber.${(ctx._auth && ctx._auth.suffix) || '0000'}.${start.format('YYYYMMDD')}`;

  // собираем объект лога
  const log = {
    start: start.format('HH:mm:ss'),
    url: ctx.originalUrl,
    method: ctx.method,
    ip: ctx.req.headers['x-real-ip'] || ctx.ip,
    //headers: Object.keys(ctx.req.headers).map((key) => [key, ctx.req.headers[key]]),
    headers: ctx.req.headers,
  };

  if(ctx._auth) {
    try {
      // тело запроса анализируем только для авторизованных пользователей
      log.post_data = await getBody(ctx.req);
      ctx._query = log.post_data.length > 0 ? JSON.parse(log.post_data) : {};
      // передаём управление основной задаче
      await next();
      // по завершению, записываем лог
      saveLog({_id, log, start, body: log.url.indexOf('/log') === -1 ? ctx.body : 'log information before this request'});
    }
    catch (err) {
      // в случае ошибки, так же, записываем лог
      log.error = err.message;
      saveLog({_id, log, start});
      throw err;
    }
  }
  else{
    // для неавторизованных пользователей записываем лог
    log.error = 'unauthorized';
    saveLog({_id, log, start, body: ctx.body});
  }

};

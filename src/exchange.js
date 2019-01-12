/**
 * Отправляет запрос сервису обмена
 *
 * @module exchange
 *
 * Created by Rostislav Poddorogin on 06.01.2019.
 */

// параметры сеанса
import settings from '../config/subscriber.settings';

const fetch = require('node-fetch');
const { user_node: { username, password }, exchange_url } = settings();

module.exports = function ({ref, suffix, body}) {
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
  })
    .then(({ status }) => {
      if (status > 200) {
        return {
          error: true,
          message: `Запрос к сервису ${exchange_url} на ссылку ${ref} завершился кодом ${status}`,
        }
      }
      return {
        message: `Запрос к сервису ${exchange_url} на ссылку ${ref} завершился успешно`,
      };
    })
    .catch(err => {
      return {
        error: true,
        message: `Запрос к сервису ${exchange_url} со ссылкой ${ref} завершился ошибкой ${err.message}`,
      }
    });
};


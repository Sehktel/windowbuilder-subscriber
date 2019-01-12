
// конфигурация подключения к CouchDB
const config = require('./app.settings');

/**
 * ### При установке параметров сеанса
 * Процедура устанавливает параметры работы программы по умолчанию из package.json
 *
 * @param prm {Object} - в свойствах этого объекта определяем параметры работы программы
 */

module.exports = (prm) => {

  const base = config(prm);
  return Object.assign(base, {

    // расположение сервиса обмена
    exchange_url: process.env.EXCHANGE_URL || `http://localhost:3021/exchange`,

  })
}

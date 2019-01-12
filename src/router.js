'use strict';

const debug = require('debug')('wb:router');
debug('start');

import Router from 'koa-better-router';
import get from './get';
import post from './post';
const router = Router({prefix: '/subscriber'});

router.loadMethods()
  .get('/:action/:id', get)
  .post('/:action/:id', post);

export default router;

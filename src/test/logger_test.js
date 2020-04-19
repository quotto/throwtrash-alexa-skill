const assert = require('assert');
const logger = require('../logger.js');

describe('logger test',()=>{
    it('change level',()=>{
        logger.LEVEL = logger.WARN;
        assert.equal(logger.LEVEL,logger.WARN)

        logger.LEVEL = logger.DEBUG;
        assert.equal(logger.LEVEL,logger.DEBUG)

        logger.LEVEL = logger.ERROR;
        assert.equal(logger.LEVEL,logger.ERROR)
    })
    it('error level',()=>{
        logger.LEVEL = logger.ERROR;
        assert.ok(logger.error('test'));
        assert.ok(!logger.warn('test'));
    });
    it('warn level',()=>{
        logger.LEVEL = logger.WARN;
        assert.ok(logger.error('test'));
        assert.ok(logger.warn('test'));
        assert.ok(!logger.info('info'));
    });
    it('info level',()=>{
        logger.LEVEL = logger.INFO;
        assert.ok(logger.error('test'));
        assert.ok(logger.warn('test'));
        assert.ok(logger.info('info'));
        assert.ok(!logger.debug('debug'));
    });
    it('debug level',()=>{
        logger.LEVEL = logger.DEBUG;
        assert.ok(logger.error('test'));
        assert.ok(logger.warn('test'));
        assert.ok(logger.info('info'));
        assert.ok(logger.debug('debug'));
    });
})
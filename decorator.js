const router = require('express').Router();
const { execute } = require('../utils/database');
// const { getRepository } = require('typeorm');

export const Controller = path => {
    function _setPrototype(tar, _path) {
        tar.prototype.basePath = _path;
        tar.prototype.isRoute = true;
        tar.prototype.identity = 'controller';
        return new tar();
    }
    if (typeof path == 'function') { return _setPrototype(path, '/'); }
    return target => _setPrototype(target, path || '/');
}

/**
 * 单路由，不需要验证
 */
export const NoInterceptors = () => {
    return target => {
        if (typeof target == 'function') {
            target.prototype.noInterceptors = true;
        }
        target.NoInterceptors = true;
        return target;
    }
}

/**
 * 
 * @param {*} service   如果service为空或者undefined， 则标记当前class为service，controller使用时谨慎
 * @param {*} serviceName 
 */
export const Service = (target) => {
    return target => {
        target.prototype.identity = 'service';
        target.prototype.execute = execute;
        // target.prototype.repository = getRepository;
        return new target();
    }
}


const methods = ['Get', 'Post', 'All'];
methods.forEach(method => {
    exports[method] = (paths = '/') => {
        return (target, name, descriptor) => {
            let src_method = descriptor.value;
            descriptor.value = ((req, res, next) => {
                src_method.apply(target, [req, res, next])
                    .then(results => {
                        if (results) {
                            res.send(results);
                            res.end();
                        }
                    })
                    .catch(err => {
                        // 接入logger
                        logger.info(`@common - decorator - ${method} err ${err.message}`);
                        res.send({ status: 0, errmsg: '接口返回异常' });
                        res.end();
                    });
            })

            descriptor.value.paths = paths;
            descriptor.value.method = method.toLocaleLowerCase();
            descriptor.enumerable = true;
            return descriptor;
        };
    }
});
export const Render = (paths = '/') => {
    return (target, name, descriptor) => {
        let src_method = descriptor.value;
        descriptor.value = ((req, res, next) => {
            src_method.apply(target, [req, res, next])
                .then(results => {
                    // if (results) {
                    //     res.render('nodata.ejs', { promise: true, stylesheet: '', dataJsScript: [] });
                    //     res.end();
                    // }
                })
                .catch(err => {
                    // 接入logger
                    logger.info(`@common - decorator - ${method} err ${err.message}`);
                    res.render('error.ejs', { promise: true, stylesheet: '', dataJsScript: [] });
                    res.end();
                });
        })
        descriptor.value.paths = paths;
        descriptor.value.method = 'get'.toLocaleLowerCase();
        descriptor.enumerable = true;
        return descriptor;
    };
}

// 未使用
export const Catch = () => {
    return (target, name, descriptor) => {
        let src_method = descriptor.value;
        descriptor.value = (...arg) => {
            src_method.apply(target, arg).catch(err => { throw new Error(err) });;
        }
        return descriptor
    }
}

// 未使用
export const Readonly = (...arg) => {
    if (arg.length == 1) {
        return (target, name, descriptor) => {
            arg = arg[0];
            descriptor.writable = typeof arg == 'boolean' ? arg : false;
            descriptor.configurable = false;
            return descriptor;
        }
    } else if (arg.length == 3) {
        let descriptor = arg[2];
        descriptor.writable = false;
        descriptor.configurable = false;
        return descriptor
    }
}

// 未使用
export const Enumerable = (...arg) => {
    if (arg.length == 1) {
        return (target, name, descriptor) => {
            arg = arg[0];
            descriptor.enumerable = typeof arg == 'boolean' ? arg : false;
            return descriptor;
        }
    } else if (arg.length == 3) {
        let descriptor = arg[2];
        descriptor.enumerable = false;
        return descriptor
    }
}
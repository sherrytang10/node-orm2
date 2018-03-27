import fs from 'fs';
import path from 'path';
import express from 'express';
import { isUndefined, isNotUndefined } from '../utils/validate';
import { formatMenuMap } from '../../lib/utils/formatArray'; //格式化二维数组
import extend from 'node.extend';

export const DefineRoute = controllersPath => {
    let router = express.Router();
    if (!Array.isArray(controllersPath)) {
        controllersPath = [controllersPath];
    }
    let controllers = [];
    // 遍历文件获取controller对象
    controllersPath.forEach(cpaths => {
        controllers.push(...__explorer(cpaths))
    });
    // 遍历controller对象
    controllers.forEach(controller => {
        if (typeof controller == 'function') {
            isNotUndefined(controller) && _defineMetadata(controller, router);
        } else {
            for (let ckey in controller) {
                if (controller[ckey] && controller[ckey].isRoute) {
                    _defineMetadata(controller[ckey], router);
                }
            }
        }
    });
    return router;
}


/**
 * 补齐path
 *
 * @param {any} path
 * @returns
 */
function _validatePath(path) {
    if (isUndefined(path)) return '/';
    if (path.indexOf('/') !== 0) return `/${path}`;
    return path;
}
/**
 * 填充router
 *
 * @param {any} controller
 */
function _defineMetadata(controller, router) {
    try {
        let { basePath, isRoute } = controller;
        if (!isRoute) return;
        basePath = _validatePath(basePath);
        if (basePath == '/') basePath = '';
        for (let key in controller) {
            let handler = controller[key];
            // noInterceptors 例外，不需要验证
            let { method, paths, noInterceptors } = handler;
            if (paths) {
                if (!Array.isArray(paths)) {
                    paths = [paths];
                }
                paths.forEach(path => {
                    path = basePath + _validatePath(path);
                    // 去掉最后面的“多余”的/
                    //      /path/ => /path
                    //      / => /
                    path = path.replace(/(\w+)\/$/, '$1');
                    // if (path == '/') path = '';
                    if (method) {
                        router[method](path, function(req, res, next) {
                            if (!noInterceptors) {
                                // 验证不通过
                                if (!_Interceptors(req, res)) {
                                    return next();
                                }
                            }
                            // 异常返回json
                            res.sendError = (errmsg = '接口返回异常', status = 0) => {
                                res.send({
                                    status,
                                    errmsg
                                });
                                res.end();
                            };
                            // 正常返回json
                            res.sendSuccess = (results = '操作成功', status = 1) => {
                                res.send({
                                    status,
                                    results
                                });
                                res.end();
                            };
                            // 返回模板渲染
                            res.sendSuccessRender = (ejsTemplate, basicData = {}) => {
                                    res.render(ejsTemplate, extend({}, { menuLeftData: formatMenuMap(req.session.menuList), loginName: req.__loginUM }, basicData));
                                    res.end();
                                }
                                // 返回异常模板渲染
                            res.sendErrorRender = (e, basicData = {}) => {
                                res.render('error.ejs', extend({}, { menuLeftData: formatMenuMap(req.session.menuList), loginName: req.__loginUM, data: e }, basicData));
                                res.end();
                            }
                            handler(req, res, next)
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.log(`@common - connect - _defineMetadata 有controller注入失败 ${e.message}`);
        // logger.info(`@common - connect - _defineMetadata 有controller注入失败 ${e.message}`);
    }
}

/* 验证 */
function _Interceptors(req, res) {

    try {
        let { url, baseUrl, session } = req;
        let interUrl = baseUrl + req.route.path;
        let { menuInterceptors, menuList, interfaceInterceptors, interfaceList } = session;
        if (menuInterceptors) {
            let _interceptor = menuList.some(item => interUrl == item.menuUri);
            // url不在menu列表中
            if (!_interceptor) {
                _renderFn(req, res, '无菜单权限： ' + 　interUrl)
                return false;
            }
        } else if (interfaceInterceptors) {
            let _interceptor = interfaceList.some(item => interUrl == item.interfaceUri);
            // url不在menu列表中
            if (!_interceptor) {
                _renderFn(req, res, '无接口权限： ' + 　interUrl);
                // 接入日志
                return false;
            }
        }
    } catch (e) {
        // 加入日志
        // logger.info(e.message);
        logger.info(`@common - connect - _Interceptors err ${e.message}`);
        return false;
    }
    return true;
}

/** */
function _renderFn(req, res, msg) {
    if (req.get('x-requested-with') != null) {
        res.send({
            status: 996,
            errmsg: msg || '暂无访问权限'
        });
        res.end();
    } else {
        res.render('forbidden.ejs', { menuLeftData: formatMenuMap(req.session.menuList), loginName: req.__loginUM });
        res.end();
    }
    // 记录日志
    logger.info('_renderFn: ' + msg)
}

function __explorer(cpaths) {
    let fileArr = [];
    try {
        let files = fs.readdirSync(cpaths);
        files.forEach(function(file) {
            let _path = path.join(cpaths, file);
            try {
                let statInfo = fs.statSync(_path);
                if (statInfo.isDirectory()) {
                    fileArr.push(...__explorer(_path))
                } else {
                    fileArr.push(require(_path));
                }

            } catch (e) {
                console.log(`有路由:${path.basename(_path)}挂载失败啦~err:${e.message}`);
                // logger.info(`有路由:${path.basename(_path)}挂载失败啦~err:${e.message}`);
            }
        });
    } catch (e) {
        console.log(`获取路由地址失败啦~err:${e.message}`);
        // logger.info(`获取路由地址失败啦~err:${e.message}`);
    }

    return fileArr;
}
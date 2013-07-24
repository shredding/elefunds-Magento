
/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.6 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.6',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && navigator && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
    //PS3 indicates loaded and complete, but need to wait for complete
    //specifically. Sequence is 'loading', 'loaded', execution,
    // then 'complete'. The UA check is unfortunate, but not sure how
    //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
            /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
    //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value !== 'string') {
                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite and existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
        //registry of just enabled modules, to speed
        //cycle breaking code when lots of modules
        //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part;
            for (i = 0; ary[i]; i += 1) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                        //End of the line. Keep at least one non-dot
                        //path segment at the front so it can be mapped
                        //correctly to disk. Otherwise, there is likely
                        //no path mapping for a path starting with '..'.
                        //This can still fail, but catches the most reasonable
                        //uses of ..
                        break;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgName, pkgConfig, mapValue, nameParts, i, j, nameSegment,
                foundMap, foundI, foundStarMap, starI,
                baseParts = baseName && baseName.split('/'),
                normalizedBaseParts = baseParts,
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name && name.charAt(0) === '.') {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    if (getOwn(config.pkgs, baseName)) {
                        //If the baseName is a package name, then just treat it as one
                        //name to concat the name with.
                        normalizedBaseParts = baseParts = [baseName];
                    } else {
                        //Convert baseName to array, and lop off the last part,
                        //so that . matches that 'directory' and not name of the baseName's
                        //module. For instance, baseName of 'one/two/three', maps to
                        //'one/two/three.js', but we want the directory, 'one/two' for
                        //this normalization.
                        normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    }

                    name = normalizedBaseParts.concat(name.split('/'));
                    trimDots(name);

                    //Some use of packages may use a . path to reference the
                    //'main' module name, so normalize for that.
                    pkgConfig = getOwn(config.pkgs, (pkgName = name[0]));
                    name = name.join('/');
                    if (pkgConfig && name === pkgName + '/' + pkgConfig.main) {
                        name = pkgName;
                    }
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundMap) {
                        break;
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            return name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                        scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                removeScript(id);
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);
                context.require([id]);
                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        normalizedName = normalize(name, parentName, applyMap);
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                '_unnormalized' + (unnormalizedCounter += 1) :
                '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                    prefix + '!' + normalizedName :
                    normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                    [defQueue.length - 1, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return mod.exports;
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            var c,
                                pkg = getOwn(config.pkgs, mod.map.id);
                            // For packages, only support config targeted
                            // at the main module.
                            c = pkg ? getOwn(config.config, mod.map.id + '/' + pkg.main) :
                                getOwn(config.config, mod.map.id);
                            return  c || {};
                        },
                        exports: defined[mod.map.id]
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var map, modId, err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
            //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                map = mod.map;
                modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
             this.depMaps = [],
             this.enabled, this.fetched
             */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                            return map.prefix ? this.callPlugin() : this.load();
                        }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            if (this.map.isDefine) {
                                //If setting exports via 'module' is in play,
                                //favor that over return value and exports. After that,
                                //favor a non-undefined return value over exports use.
                                cjsModule = this.module;
                                if (cjsModule &&
                                    cjsModule.exports !== undefined &&
                                    //Make sure it is not already the exports value
                                    cjsModule.exports !== this.exports) {
                                    exports = cjsModule.exports;
                                } else if (exports === undefined && this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                            this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                'fromText eval for ' + id +
                                    ' failed: ' + e,
                                e,
                                [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                            (this.map.isDefine ? this.map : this.map.parentMap),
                            false,
                            !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths and packages since they require special processing,
                //they are additive.
                var pkgs = config.pkgs,
                    shim = config.shim,
                    objs = {
                        paths: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (prop === 'map') {
                            if (!config.map) {
                                config.map = {};
                            }
                            mixin(config[prop], value, true, true);
                        } else {
                            mixin(config[prop], value, true);
                        }
                    } else {
                        config[prop] = value;
                    }
                });

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;
                        location = pkgObj.location;

                        //Create a brand new object on pkgs, since currentPackages can
                        //be passed in again, and config.pkgs is the internal transformed
                        //state for all package configs.
                        pkgs[pkgObj.name] = {
                            name: pkgObj.name,
                            location: location || pkgObj.name,
                            //Remove leading dot in main, so main paths are normalized,
                            //and remove any trailing .js, since different package
                            //envs have different conventions: some use a module name,
                            //some use a file name.
                            main: (pkgObj.main || 'main')
                                .replace(currDirRegExp, '')
                                .replace(jsSuffixRegExp, '')
                        };
                    });

                    //Done with modifications, assing packages back to context config
                    config.pkgs = pkgs;
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                id +
                                '" has not been loaded yet for context: ' +
                                contextName +
                                (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                            relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overriden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                'No define call for ' + moduleName,
                                null,
                                [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, pkgs, pkg, pkgPath, syms, i, parentModule, url,
                    parentPath;

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;
                    pkgs = config.pkgs;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');
                        pkg = getOwn(pkgs, parentModule);
                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        } else if (pkg) {
                            //If module name is just the package name, then looking
                            //for the main module.
                            if (moduleName === pkg.name) {
                                pkgPath = pkg.location + '/' + pkg.main;
                            } else {
                                pkgPath = pkg.location;
                            }
                            syms.splice(0, i, pkgPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                    ((url.indexOf('?') === -1 ? '?' : '&') +
                        config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                    (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
            node.type = config.scriptType || 'text/javascript';
            node.charset = 'utf-8';
            node.async = true;

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                //Check if node.attachEvent is artificially added by custom script or
                //natively supported by browser
                //read https://github.com/jrburke/requirejs/issues/187
                //if we can NOT find [native code] then it must NOT natively supported.
                //in IE8, node.attachEvent does not have toString()
                //Note the test for "[native code" with no closing brace, see:
                //https://github.com/jrburke/requirejs/issues/273
                !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                    'importScripts failed for ' +
                        moduleName + ' at ' + url,
                    e,
                    [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));
define("../lib/require", function(){});

/* Zepto v1.0-1-ga3cab6c - polyfill zepto detect event ajax form fx - zeptojs.com/license */


;(function(undefined){
    if (String.prototype.trim === undefined) // fix for iOS 3.2
        String.prototype.trim = function(){ return this.replace(/^\s+|\s+$/g, '') }

    // For iOS 3.x
    // from https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/reduce
    if (Array.prototype.reduce === undefined)
        Array.prototype.reduce = function(fun){
            if(this === void 0 || this === null) throw new TypeError()
            var t = Object(this), len = t.length >>> 0, k = 0, accumulator
            if(typeof fun != 'function') throw new TypeError()
            if(len == 0 && arguments.length == 1) throw new TypeError()

            if(arguments.length >= 2)
                accumulator = arguments[1]
            else
                do{
                    if(k in t){
                        accumulator = t[k++]
                        break
                    }
                    if(++k >= len) throw new TypeError()
                } while (true)

            while (k < len){
                if(k in t) accumulator = fun.call(undefined, accumulator, t[k], k, t)
                k++
            }
            return accumulator
        }

})()

var Zepto = (function() {
    var undefined, key, $, classList, emptyArray = [], slice = emptyArray.slice, filter = emptyArray.filter,
        document = window.document,
        elementDisplay = {}, classCache = {},
        getComputedStyle = document.defaultView.getComputedStyle,
        cssNumber = { 'column-count': 1, 'columns': 1, 'font-weight': 1, 'line-height': 1,'opacity': 1, 'z-index': 1, 'zoom': 1 },
        fragmentRE = /^\s*<(\w+|!)[^>]*>/,
        tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,
        rootNodeRE = /^(?:body|html)$/i,

    // special attributes that should be get/set via method calls
        methodAttributes = ['val', 'css', 'html', 'text', 'data', 'width', 'height', 'offset'],

        adjacencyOperators = [ 'after', 'prepend', 'before', 'append' ],
        table = document.createElement('table'),
        tableRow = document.createElement('tr'),
        containers = {
            'tr': document.createElement('tbody'),
            'tbody': table, 'thead': table, 'tfoot': table,
            'td': tableRow, 'th': tableRow,
            '*': document.createElement('div')
        },
        readyRE = /complete|loaded|interactive/,
        classSelectorRE = /^\.([\w-]+)$/,
        idSelectorRE = /^#([\w-]*)$/,
        tagSelectorRE = /^[\w-]+$/,
        class2type = {},
        toString = class2type.toString,
        zepto = {},
        camelize, uniq,
        tempParent = document.createElement('div')

    zepto.matches = function(element, selector) {
        if (!element || element.nodeType !== 1) return false
        var matchesSelector = element.webkitMatchesSelector || element.mozMatchesSelector ||
            element.oMatchesSelector || element.matchesSelector
        if (matchesSelector) return matchesSelector.call(element, selector)
        // fall back to performing a selector:
        var match, parent = element.parentNode, temp = !parent
        if (temp) (parent = tempParent).appendChild(element)
        match = ~zepto.qsa(parent, selector).indexOf(element)
        temp && tempParent.removeChild(element)
        return match
    }

    function type(obj) {
        return obj == null ? String(obj) :
            class2type[toString.call(obj)] || "object"
    }

    function isFunction(value) { return type(value) == "function" }
    function isWindow(obj)     { return obj != null && obj == obj.window }
    function isDocument(obj)   { return obj != null && obj.nodeType == obj.DOCUMENT_NODE }
    function isObject(obj)     { return type(obj) == "object" }
    function isPlainObject(obj) {
        return isObject(obj) && !isWindow(obj) && obj.__proto__ == Object.prototype
    }
    function isArray(value) { return value instanceof Array }
    function likeArray(obj) { return typeof obj.length == 'number' }

    function compact(array) { return filter.call(array, function(item){ return item != null }) }
    function flatten(array) { return array.length > 0 ? $.fn.concat.apply([], array) : array }
    camelize = function(str){ return str.replace(/-+(.)?/g, function(match, chr){ return chr ? chr.toUpperCase() : '' }) }
    function dasherize(str) {
        return str.replace(/::/g, '/')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
            .replace(/([a-z\d])([A-Z])/g, '$1_$2')
            .replace(/_/g, '-')
            .toLowerCase()
    }
    uniq = function(array){ return filter.call(array, function(item, idx){ return array.indexOf(item) == idx }) }

    function classRE(name) {
        return name in classCache ?
            classCache[name] : (classCache[name] = new RegExp('(^|\\s)' + name + '(\\s|$)'))
    }

    function maybeAddPx(name, value) {
        return (typeof value == "number" && !cssNumber[dasherize(name)]) ? value + "px" : value
    }

    function defaultDisplay(nodeName) {
        var element, display
        if (!elementDisplay[nodeName]) {
            element = document.createElement(nodeName)
            document.body.appendChild(element)
            display = getComputedStyle(element, '').getPropertyValue("display")
            element.parentNode.removeChild(element)
            display == "none" && (display = "block")
            elementDisplay[nodeName] = display
        }
        return elementDisplay[nodeName]
    }

    function children(element) {
        return 'children' in element ?
            slice.call(element.children) :
            $.map(element.childNodes, function(node){ if (node.nodeType == 1) return node })
    }

    // `$.zepto.fragment` takes a html string and an optional tag name
    // to generate DOM nodes nodes from the given html string.
    // The generated DOM nodes are returned as an array.
    // This function can be overriden in plugins for example to make
    // it compatible with browsers that don't support the DOM fully.
    zepto.fragment = function(html, name, properties) {
        if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>")
        if (name === undefined) name = fragmentRE.test(html) && RegExp.$1
        if (!(name in containers)) name = '*'

        var nodes, dom, container = containers[name]
        container.innerHTML = '' + html
        dom = $.each(slice.call(container.childNodes), function(){
            container.removeChild(this)
        })
        if (isPlainObject(properties)) {
            nodes = $(dom)
            $.each(properties, function(key, value) {
                if (methodAttributes.indexOf(key) > -1) nodes[key](value)
                else nodes.attr(key, value)
            })
        }
        return dom
    }

    // `$.zepto.Z` swaps out the prototype of the given `dom` array
    // of nodes with `$.fn` and thus supplying all the Zepto functions
    // to the array. Note that `__proto__` is not supported on Internet
    // Explorer. This method can be overriden in plugins.
    zepto.Z = function(dom, selector) {
        dom = dom || []
        dom.__proto__ = $.fn
        dom.selector = selector || ''
        return dom
    }

    // `$.zepto.isZ` should return `true` if the given object is a Zepto
    // collection. This method can be overriden in plugins.
    zepto.isZ = function(object) {
        return object instanceof zepto.Z
    }

    // `$.zepto.init` is Zepto's counterpart to jQuery's `$.fn.init` and
    // takes a CSS selector and an optional context (and handles various
    // special cases).
    // This method can be overriden in plugins.
    zepto.init = function(selector, context) {
        // If nothing given, return an empty Zepto collection
        if (!selector) return zepto.Z()
        // If a function is given, call it when the DOM is ready
        else if (isFunction(selector)) return $(document).ready(selector)
        // If a Zepto collection is given, juts return it
        else if (zepto.isZ(selector)) return selector
        else {
            var dom
            // normalize array if an array of nodes is given
            if (isArray(selector)) dom = compact(selector)
            // Wrap DOM nodes. If a plain object is given, duplicate it.
            else if (isObject(selector))
                dom = [isPlainObject(selector) ? $.extend({}, selector) : selector], selector = null
            // If it's a html fragment, create nodes from it
            else if (fragmentRE.test(selector))
                dom = zepto.fragment(selector.trim(), RegExp.$1, context), selector = null
            // If there's a context, create a collection on that context first, and select
            // nodes from there
            else if (context !== undefined) return $(context).find(selector)
            // And last but no least, if it's a CSS selector, use it to select nodes.
            else dom = zepto.qsa(document, selector)
            // create a new Zepto collection from the nodes found
            return zepto.Z(dom, selector)
        }
    }

    // `$` will be the base `Zepto` object. When calling this
    // function just call `$.zepto.init, which makes the implementation
    // details of selecting nodes and creating Zepto collections
    // patchable in plugins.
    $ = function(selector, context){
        return zepto.init(selector, context)
    }

    function extend(target, source, deep) {
        for (key in source)
            if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
                if (isPlainObject(source[key]) && !isPlainObject(target[key]))
                    target[key] = {}
                if (isArray(source[key]) && !isArray(target[key]))
                    target[key] = []
                extend(target[key], source[key], deep)
            }
            else if (source[key] !== undefined) target[key] = source[key]
    }

    // Copy all but undefined properties from one or more
    // objects to the `target` object.
    $.extend = function(target){
        var deep, args = slice.call(arguments, 1)
        if (typeof target == 'boolean') {
            deep = target
            target = args.shift()
        }
        args.forEach(function(arg){ extend(target, arg, deep) })
        return target
    }

    // `$.zepto.qsa` is Zepto's CSS selector implementation which
    // uses `document.querySelectorAll` and optimizes for some special cases, like `#id`.
    // This method can be overriden in plugins.
    zepto.qsa = function(element, selector){
        var found
        return (isDocument(element) && idSelectorRE.test(selector)) ?
            ( (found = element.getElementById(RegExp.$1)) ? [found] : [] ) :
            (element.nodeType !== 1 && element.nodeType !== 9) ? [] :
                slice.call(
                    classSelectorRE.test(selector) ? element.getElementsByClassName(RegExp.$1) :
                        tagSelectorRE.test(selector) ? element.getElementsByTagName(selector) :
                            element.querySelectorAll(selector)
                )
    }

    function filtered(nodes, selector) {
        return selector === undefined ? $(nodes) : $(nodes).filter(selector)
    }

    $.contains = function(parent, node) {
        return parent !== node && parent.contains(node)
    }

    function funcArg(context, arg, idx, payload) {
        return isFunction(arg) ? arg.call(context, idx, payload) : arg
    }

    function setAttribute(node, name, value) {
        value == null ? node.removeAttribute(name) : node.setAttribute(name, value)
    }

    // access className property while respecting SVGAnimatedString
    function className(node, value){
        var klass = node.className,
            svg   = klass && klass.baseVal !== undefined

        if (value === undefined) return svg ? klass.baseVal : klass
        svg ? (klass.baseVal = value) : (node.className = value)
    }

    // "true"  => true
    // "false" => false
    // "null"  => null
    // "42"    => 42
    // "42.5"  => 42.5
    // JSON    => parse if valid
    // String  => self
    function deserializeValue(value) {
        var num
        try {
            return value ?
                value == "true" ||
                    ( value == "false" ? false :
                        value == "null" ? null :
                            !isNaN(num = Number(value)) ? num :
                                /^[\[\{]/.test(value) ? $.parseJSON(value) :
                                    value )
                : value
        } catch(e) {
            return value
        }
    }

    $.type = type
    $.isFunction = isFunction
    $.isWindow = isWindow
    $.isArray = isArray
    $.isPlainObject = isPlainObject

    $.isEmptyObject = function(obj) {
        var name
        for (name in obj) return false
        return true
    }

    $.inArray = function(elem, array, i){
        return emptyArray.indexOf.call(array, elem, i)
    }

    $.camelCase = camelize
    $.trim = function(str) { return str.trim() }

    // plugin compatibility
    $.uuid = 0
    $.support = { }
    $.expr = { }

    $.map = function(elements, callback){
        var value, values = [], i, key
        if (likeArray(elements))
            for (i = 0; i < elements.length; i++) {
                value = callback(elements[i], i)
                if (value != null) values.push(value)
            }
        else
            for (key in elements) {
                value = callback(elements[key], key)
                if (value != null) values.push(value)
            }
        return flatten(values)
    }

    $.each = function(elements, callback){
        var i, key
        if (likeArray(elements)) {
            for (i = 0; i < elements.length; i++)
                if (callback.call(elements[i], i, elements[i]) === false) return elements
        } else {
            for (key in elements)
                if (callback.call(elements[key], key, elements[key]) === false) return elements
        }

        return elements
    }

    $.grep = function(elements, callback){
        return filter.call(elements, callback)
    }

    if (window.JSON) $.parseJSON = JSON.parse

    // Populate the class2type map
    $.each("Boolean Number String Function Array Date RegExp Object Error".split(" "), function(i, name) {
        class2type[ "[object " + name + "]" ] = name.toLowerCase()
    })

    // Define methods that will be available on all
    // Zepto collections
    $.fn = {
        // Because a collection acts like an array
        // copy over these useful array functions.
        forEach: emptyArray.forEach,
        reduce: emptyArray.reduce,
        push: emptyArray.push,
        sort: emptyArray.sort,
        indexOf: emptyArray.indexOf,
        concat: emptyArray.concat,

        // `map` and `slice` in the jQuery API work differently
        // from their array counterparts
        map: function(fn){
            return $($.map(this, function(el, i){ return fn.call(el, i, el) }))
        },
        slice: function(){
            return $(slice.apply(this, arguments))
        },

        ready: function(callback){
            if (readyRE.test(document.readyState)) callback($)
            else document.addEventListener('DOMContentLoaded', function(){ callback($) }, false)
            return this
        },
        get: function(idx){
            return idx === undefined ? slice.call(this) : this[idx >= 0 ? idx : idx + this.length]
        },
        toArray: function(){ return this.get() },
        size: function(){
            return this.length
        },
        remove: function(){
            return this.each(function(){
                if (this.parentNode != null)
                    this.parentNode.removeChild(this)
            })
        },
        each: function(callback){
            emptyArray.every.call(this, function(el, idx){
                return callback.call(el, idx, el) !== false
            })
            return this
        },
        filter: function(selector){
            if (isFunction(selector)) return this.not(this.not(selector))
            return $(filter.call(this, function(element){
                return zepto.matches(element, selector)
            }))
        },
        add: function(selector,context){
            return $(uniq(this.concat($(selector,context))))
        },
        is: function(selector){
            return this.length > 0 && zepto.matches(this[0], selector)
        },
        not: function(selector){
            var nodes=[]
            if (isFunction(selector) && selector.call !== undefined)
                this.each(function(idx){
                    if (!selector.call(this,idx)) nodes.push(this)
                })
            else {
                var excludes = typeof selector == 'string' ? this.filter(selector) :
                    (likeArray(selector) && isFunction(selector.item)) ? slice.call(selector) : $(selector)
                this.forEach(function(el){
                    if (excludes.indexOf(el) < 0) nodes.push(el)
                })
            }
            return $(nodes)
        },
        has: function(selector){
            return this.filter(function(){
                return isObject(selector) ?
                    $.contains(this, selector) :
                    $(this).find(selector).size()
            })
        },
        eq: function(idx){
            return idx === -1 ? this.slice(idx) : this.slice(idx, + idx + 1)
        },
        first: function(){
            var el = this[0]
            return el && !isObject(el) ? el : $(el)
        },
        last: function(){
            var el = this[this.length - 1]
            return el && !isObject(el) ? el : $(el)
        },
        find: function(selector){
            var result, $this = this
            if (typeof selector == 'object')
                result = $(selector).filter(function(){
                    var node = this
                    return emptyArray.some.call($this, function(parent){
                        return $.contains(parent, node)
                    })
                })
            else if (this.length == 1) result = $(zepto.qsa(this[0], selector))
            else result = this.map(function(){ return zepto.qsa(this, selector) })
            return result
        },
        closest: function(selector, context){
            var node = this[0], collection = false
            if (typeof selector == 'object') collection = $(selector)
            while (node && !(collection ? collection.indexOf(node) >= 0 : zepto.matches(node, selector)))
                node = node !== context && !isDocument(node) && node.parentNode
            return $(node)
        },
        parents: function(selector){
            var ancestors = [], nodes = this
            while (nodes.length > 0)
                nodes = $.map(nodes, function(node){
                    if ((node = node.parentNode) && !isDocument(node) && ancestors.indexOf(node) < 0) {
                        ancestors.push(node)
                        return node
                    }
                })
            return filtered(ancestors, selector)
        },
        parent: function(selector){
            return filtered(uniq(this.pluck('parentNode')), selector)
        },
        children: function(selector){
            return filtered(this.map(function(){ return children(this) }), selector)
        },
        contents: function() {
            return this.map(function() { return slice.call(this.childNodes) })
        },
        siblings: function(selector){
            return filtered(this.map(function(i, el){
                return filter.call(children(el.parentNode), function(child){ return child!==el })
            }), selector)
        },
        empty: function(){
            return this.each(function(){ this.innerHTML = '' })
        },
        // `pluck` is borrowed from Prototype.js
        pluck: function(property){
            return $.map(this, function(el){ return el[property] })
        },
        show: function(){
            return this.each(function(){
                this.style.display == "none" && (this.style.display = null)
                if (getComputedStyle(this, '').getPropertyValue("display") == "none")
                    this.style.display = defaultDisplay(this.nodeName)
            })
        },
        replaceWith: function(newContent){
            return this.before(newContent).remove()
        },
        wrap: function(structure){
            var func = isFunction(structure)
            if (this[0] && !func)
                var dom   = $(structure).get(0),
                    clone = dom.parentNode || this.length > 1

            return this.each(function(index){
                $(this).wrapAll(
                    func ? structure.call(this, index) :
                        clone ? dom.cloneNode(true) : dom
                )
            })
        },
        wrapAll: function(structure){
            if (this[0]) {
                $(this[0]).before(structure = $(structure))
                var children
                // drill down to the inmost element
                while ((children = structure.children()).length) structure = children.first()
                $(structure).append(this)
            }
            return this
        },
        wrapInner: function(structure){
            var func = isFunction(structure)
            return this.each(function(index){
                var self = $(this), contents = self.contents(),
                    dom  = func ? structure.call(this, index) : structure
                contents.length ? contents.wrapAll(dom) : self.append(dom)
            })
        },
        unwrap: function(){
            this.parent().each(function(){
                $(this).replaceWith($(this).children())
            })
            return this
        },
        clone: function(){
            return this.map(function(){ return this.cloneNode(true) })
        },
        hide: function(){
            return this.css("display", "none")
        },
        toggle: function(setting){
            return this.each(function(){
                var el = $(this)
                    ;(setting === undefined ? el.css("display") == "none" : setting) ? el.show() : el.hide()
            })
        },
        prev: function(selector){ return $(this.pluck('previousElementSibling')).filter(selector || '*') },
        next: function(selector){ return $(this.pluck('nextElementSibling')).filter(selector || '*') },
        html: function(html){
            return html === undefined ?
                (this.length > 0 ? this[0].innerHTML : null) :
                this.each(function(idx){
                    var originHtml = this.innerHTML
                    $(this).empty().append( funcArg(this, html, idx, originHtml) )
                })
        },
        text: function(text){
            return text === undefined ?
                (this.length > 0 ? this[0].textContent : null) :
                this.each(function(){ this.textContent = text })
        },
        attr: function(name, value){
            var result
            return (typeof name == 'string' && value === undefined) ?
                (this.length == 0 || this[0].nodeType !== 1 ? undefined :
                    (name == 'value' && this[0].nodeName == 'INPUT') ? this.val() :
                        (!(result = this[0].getAttribute(name)) && name in this[0]) ? this[0][name] : result
                    ) :
                this.each(function(idx){
                    if (this.nodeType !== 1) return
                    if (isObject(name)) for (key in name) setAttribute(this, key, name[key])
                    else setAttribute(this, name, funcArg(this, value, idx, this.getAttribute(name)))
                })
        },
        removeAttr: function(name){
            return this.each(function(){ this.nodeType === 1 && setAttribute(this, name) })
        },
        prop: function(name, value){
            return (value === undefined) ?
                (this[0] && this[0][name]) :
                this.each(function(idx){
                    this[name] = funcArg(this, value, idx, this[name])
                })
        },
        data: function(name, value){
            var data = this.attr('data-' + dasherize(name), value)
            return data !== null ? deserializeValue(data) : undefined
        },
        val: function(value){
            return (value === undefined) ?
                (this[0] && (this[0].multiple ?
                    $(this[0]).find('option').filter(function(o){ return this.selected }).pluck('value') :
                    this[0].value)
                    ) :
                this.each(function(idx){
                    this.value = funcArg(this, value, idx, this.value)
                })
        },
        offset: function(coordinates){
            if (coordinates) return this.each(function(index){
                var $this = $(this),
                    coords = funcArg(this, coordinates, index, $this.offset()),
                    parentOffset = $this.offsetParent().offset(),
                    props = {
                        top:  coords.top  - parentOffset.top,
                        left: coords.left - parentOffset.left
                    }

                if ($this.css('position') == 'static') props['position'] = 'relative'
                $this.css(props)
            })
            if (this.length==0) return null
            var obj = this[0].getBoundingClientRect()
            return {
                left: obj.left + window.pageXOffset,
                top: obj.top + window.pageYOffset,
                width: Math.round(obj.width),
                height: Math.round(obj.height)
            }
        },
        css: function(property, value){
            if (arguments.length < 2 && typeof property == 'string')
                return this[0] && (this[0].style[camelize(property)] || getComputedStyle(this[0], '').getPropertyValue(property))

            var css = ''
            if (type(property) == 'string') {
                if (!value && value !== 0)
                    this.each(function(){ this.style.removeProperty(dasherize(property)) })
                else
                    css = dasherize(property) + ":" + maybeAddPx(property, value)
            } else {
                for (key in property)
                    if (!property[key] && property[key] !== 0)
                        this.each(function(){ this.style.removeProperty(dasherize(key)) })
                    else
                        css += dasherize(key) + ':' + maybeAddPx(key, property[key]) + ';'
            }

            return this.each(function(){ this.style.cssText += ';' + css })
        },
        index: function(element){
            return element ? this.indexOf($(element)[0]) : this.parent().children().indexOf(this[0])
        },
        hasClass: function(name){
            return emptyArray.some.call(this, function(el){
                return this.test(className(el))
            }, classRE(name))
        },
        addClass: function(name){
            return this.each(function(idx){
                classList = []
                var cls = className(this), newName = funcArg(this, name, idx, cls)
                newName.split(/\s+/g).forEach(function(klass){
                    if (!$(this).hasClass(klass)) classList.push(klass)
                }, this)
                classList.length && className(this, cls + (cls ? " " : "") + classList.join(" "))
            })
        },
        removeClass: function(name){
            return this.each(function(idx){
                if (name === undefined) return className(this, '')
                classList = className(this)
                funcArg(this, name, idx, classList).split(/\s+/g).forEach(function(klass){
                    classList = classList.replace(classRE(klass), " ")
                })
                className(this, classList.trim())
            })
        },
        toggleClass: function(name, when){
            return this.each(function(idx){
                var $this = $(this), names = funcArg(this, name, idx, className(this))
                names.split(/\s+/g).forEach(function(klass){
                    (when === undefined ? !$this.hasClass(klass) : when) ?
                        $this.addClass(klass) : $this.removeClass(klass)
                })
            })
        },
        scrollTop: function(){
            if (!this.length) return
            return ('scrollTop' in this[0]) ? this[0].scrollTop : this[0].scrollY
        },
        position: function() {
            if (!this.length) return

            var elem = this[0],
            // Get *real* offsetParent
                offsetParent = this.offsetParent(),
            // Get correct offsets
                offset       = this.offset(),
                parentOffset = rootNodeRE.test(offsetParent[0].nodeName) ? { top: 0, left: 0 } : offsetParent.offset()

            // Subtract element margins
            // note: when an element has margin: auto the offsetLeft and marginLeft
            // are the same in Safari causing offset.left to incorrectly be 0
            offset.top  -= parseFloat( $(elem).css('margin-top') ) || 0
            offset.left -= parseFloat( $(elem).css('margin-left') ) || 0

            // Add offsetParent borders
            parentOffset.top  += parseFloat( $(offsetParent[0]).css('border-top-width') ) || 0
            parentOffset.left += parseFloat( $(offsetParent[0]).css('border-left-width') ) || 0

            // Subtract the two offsets
            return {
                top:  offset.top  - parentOffset.top,
                left: offset.left - parentOffset.left
            }
        },
        offsetParent: function() {
            return this.map(function(){
                var parent = this.offsetParent || document.body
                while (parent && !rootNodeRE.test(parent.nodeName) && $(parent).css("position") == "static")
                    parent = parent.offsetParent
                return parent
            })
        }
    }

    // for now
    $.fn.detach = $.fn.remove

        // Generate the `width` and `height` functions
    ;['width', 'height'].forEach(function(dimension){
        $.fn[dimension] = function(value){
            var offset, el = this[0],
                Dimension = dimension.replace(/./, function(m){ return m[0].toUpperCase() })
            if (value === undefined) return isWindow(el) ? el['inner' + Dimension] :
                isDocument(el) ? el.documentElement['offset' + Dimension] :
                    (offset = this.offset()) && offset[dimension]
            else return this.each(function(idx){
                el = $(this)
                el.css(dimension, funcArg(this, value, idx, el[dimension]()))
            })
        }
    })

    function traverseNode(node, fun) {
        fun(node)
        for (var key in node.childNodes) traverseNode(node.childNodes[key], fun)
    }

    // Generate the `after`, `prepend`, `before`, `append`,
    // `insertAfter`, `insertBefore`, `appendTo`, and `prependTo` methods.
    adjacencyOperators.forEach(function(operator, operatorIndex) {
        var inside = operatorIndex % 2 //=> prepend, append

        $.fn[operator] = function(){
            // arguments can be nodes, arrays of nodes, Zepto objects and HTML strings
            var argType, nodes = $.map(arguments, function(arg) {
                    argType = type(arg)
                    return argType == "object" || argType == "array" || arg == null ?
                        arg : zepto.fragment(arg)
                }),
                parent, copyByClone = this.length > 1
            if (nodes.length < 1) return this

            return this.each(function(_, target){
                parent = inside ? target : target.parentNode

                // convert all methods to a "before" operation
                target = operatorIndex == 0 ? target.nextSibling :
                    operatorIndex == 1 ? target.firstChild :
                        operatorIndex == 2 ? target :
                            null

                nodes.forEach(function(node){
                    if (copyByClone) node = node.cloneNode(true)
                    else if (!parent) return $(node).remove()

                    traverseNode(parent.insertBefore(node, target), function(el){
                        if (el.nodeName != null && el.nodeName.toUpperCase() === 'SCRIPT' &&
                            (!el.type || el.type === 'text/javascript') && !el.src)
                            window['eval'].call(window, el.innerHTML)
                    })
                })
            })
        }

        // after    => insertAfter
        // prepend  => prependTo
        // before   => insertBefore
        // append   => appendTo
        $.fn[inside ? operator+'To' : 'insert'+(operatorIndex ? 'Before' : 'After')] = function(html){
            $(html)[operator](this)
            return this
        }
    })

    zepto.Z.prototype = $.fn

    // Export internal API functions in the `$.zepto` namespace
    zepto.uniq = uniq
    zepto.deserializeValue = deserializeValue
    $.zepto = zepto

    return $
})()

window.Zepto = Zepto
'$' in window || (window.$ = Zepto)

;(function($){
    function detect(ua){
        var os = this.os = {}, browser = this.browser = {},
            webkit = ua.match(/WebKit\/([\d.]+)/),
            android = ua.match(/(Android)\s+([\d.]+)/),
            ipad = ua.match(/(iPad).*OS\s([\d_]+)/),
            iphone = !ipad && ua.match(/(iPhone\sOS)\s([\d_]+)/),
            webos = ua.match(/(webOS|hpwOS)[\s\/]([\d.]+)/),
            touchpad = webos && ua.match(/TouchPad/),
            kindle = ua.match(/Kindle\/([\d.]+)/),
            silk = ua.match(/Silk\/([\d._]+)/),
            blackberry = ua.match(/(BlackBerry).*Version\/([\d.]+)/),
            bb10 = ua.match(/(BB10).*Version\/([\d.]+)/),
            rimtabletos = ua.match(/(RIM\sTablet\sOS)\s([\d.]+)/),
            playbook = ua.match(/PlayBook/),
            chrome = ua.match(/Chrome\/([\d.]+)/) || ua.match(/CriOS\/([\d.]+)/),
            firefox = ua.match(/Firefox\/([\d.]+)/)

        // Todo: clean this up with a better OS/browser seperation:
        // - discern (more) between multiple browsers on android
        // - decide if kindle fire in silk mode is android or not
        // - Firefox on Android doesn't specify the Android version
        // - possibly devide in os, device and browser hashes

        if (browser.webkit = !!webkit) browser.version = webkit[1]

        if (android) os.android = true, os.version = android[2]
        if (iphone) os.ios = os.iphone = true, os.version = iphone[2].replace(/_/g, '.')
        if (ipad) os.ios = os.ipad = true, os.version = ipad[2].replace(/_/g, '.')
        if (webos) os.webos = true, os.version = webos[2]
        if (touchpad) os.touchpad = true
        if (blackberry) os.blackberry = true, os.version = blackberry[2]
        if (bb10) os.bb10 = true, os.version = bb10[2]
        if (rimtabletos) os.rimtabletos = true, os.version = rimtabletos[2]
        if (playbook) browser.playbook = true
        if (kindle) os.kindle = true, os.version = kindle[1]
        if (silk) browser.silk = true, browser.version = silk[1]
        if (!silk && os.android && ua.match(/Kindle Fire/)) browser.silk = true
        if (chrome) browser.chrome = true, browser.version = chrome[1]
        if (firefox) browser.firefox = true, browser.version = firefox[1]

        os.tablet = !!(ipad || playbook || (android && !ua.match(/Mobile/)) || (firefox && ua.match(/Tablet/)))
        os.phone  = !!(!os.tablet && (android || iphone || webos || blackberry || bb10 ||
            (chrome && ua.match(/Android/)) || (chrome && ua.match(/CriOS\/([\d.]+)/)) || (firefox && ua.match(/Mobile/))))
    }

    detect.call($, navigator.userAgent)
    // make available to unit tests
    $.__detect = detect

})(Zepto)

;(function($){
    var $$ = $.zepto.qsa, handlers = {}, _zid = 1, specialEvents={},
        hover = { mouseenter: 'mouseover', mouseleave: 'mouseout' }

    specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove = 'MouseEvents'

    function zid(element) {
        return element._zid || (element._zid = _zid++)
    }
    function findHandlers(element, event, fn, selector) {
        event = parse(event)
        if (event.ns) var matcher = matcherFor(event.ns)
        return (handlers[zid(element)] || []).filter(function(handler) {
            return handler
                && (!event.e  || handler.e == event.e)
                && (!event.ns || matcher.test(handler.ns))
                && (!fn       || zid(handler.fn) === zid(fn))
                && (!selector || handler.sel == selector)
        })
    }
    function parse(event) {
        var parts = ('' + event).split('.')
        return {e: parts[0], ns: parts.slice(1).sort().join(' ')}
    }
    function matcherFor(ns) {
        return new RegExp('(?:^| )' + ns.replace(' ', ' .* ?') + '(?: |$)')
    }

    function eachEvent(events, fn, iterator){
        if ($.type(events) != "string") $.each(events, iterator)
        else events.split(/\s/).forEach(function(type){ iterator(type, fn) })
    }

    function eventCapture(handler, captureSetting) {
        return handler.del &&
            (handler.e == 'focus' || handler.e == 'blur') ||
            !!captureSetting
    }

    function realEvent(type) {
        return hover[type] || type
    }

    function add(element, events, fn, selector, getDelegate, capture){
        var id = zid(element), set = (handlers[id] || (handlers[id] = []))
        eachEvent(events, fn, function(event, fn){
            var handler   = parse(event)
            handler.fn    = fn
            handler.sel   = selector
            // emulate mouseenter, mouseleave
            if (handler.e in hover) fn = function(e){
                var related = e.relatedTarget
                if (!related || (related !== this && !$.contains(this, related)))
                    return handler.fn.apply(this, arguments)
            }
            handler.del   = getDelegate && getDelegate(fn, event)
            var callback  = handler.del || fn
            handler.proxy = function (e) {
                var result = callback.apply(element, [e].concat(e.data))
                if (result === false) e.preventDefault(), e.stopPropagation()
                return result
            }
            handler.i = set.length
            set.push(handler)
            element.addEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
        })
    }
    function remove(element, events, fn, selector, capture){
        var id = zid(element)
        eachEvent(events || '', fn, function(event, fn){
            findHandlers(element, event, fn, selector).forEach(function(handler){
                delete handlers[id][handler.i]
                element.removeEventListener(realEvent(handler.e), handler.proxy, eventCapture(handler, capture))
            })
        })
    }

    $.event = { add: add, remove: remove }

    $.proxy = function(fn, context) {
        if ($.isFunction(fn)) {
            var proxyFn = function(){ return fn.apply(context, arguments) }
            proxyFn._zid = zid(fn)
            return proxyFn
        } else if (typeof context == 'string') {
            return $.proxy(fn[context], fn)
        } else {
            throw new TypeError("expected function")
        }
    }

    $.fn.bind = function(event, callback){
        return this.each(function(){
            add(this, event, callback)
        })
    }
    $.fn.unbind = function(event, callback){
        return this.each(function(){
            remove(this, event, callback)
        })
    }
    $.fn.one = function(event, callback){
        return this.each(function(i, element){
            add(this, event, callback, null, function(fn, type){
                return function(){
                    var result = fn.apply(element, arguments)
                    remove(element, type, fn)
                    return result
                }
            })
        })
    }

    var returnTrue = function(){return true},
        returnFalse = function(){return false},
        ignoreProperties = /^([A-Z]|layer[XY]$)/,
        eventMethods = {
            preventDefault: 'isDefaultPrevented',
            stopImmediatePropagation: 'isImmediatePropagationStopped',
            stopPropagation: 'isPropagationStopped'
        }
    function createProxy(event) {
        var key, proxy = { originalEvent: event }
        for (key in event)
            if (!ignoreProperties.test(key) && event[key] !== undefined) proxy[key] = event[key]

        $.each(eventMethods, function(name, predicate) {
            proxy[name] = function(){
                this[predicate] = returnTrue
                return event[name].apply(event, arguments)
            }
            proxy[predicate] = returnFalse
        })
        return proxy
    }

    // emulates the 'defaultPrevented' property for browsers that have none
    function fix(event) {
        if (!('defaultPrevented' in event)) {
            event.defaultPrevented = false
            var prevent = event.preventDefault
            event.preventDefault = function() {
                this.defaultPrevented = true
                prevent.call(this)
            }
        }
    }

    $.fn.delegate = function(selector, event, callback){
        return this.each(function(i, element){
            add(element, event, callback, selector, function(fn){
                return function(e){
                    var evt, match = $(e.target).closest(selector, element).get(0)
                    if (match) {
                        evt = $.extend(createProxy(e), {currentTarget: match, liveFired: element})
                        return fn.apply(match, [evt].concat([].slice.call(arguments, 1)))
                    }
                }
            })
        })
    }
    $.fn.undelegate = function(selector, event, callback){
        return this.each(function(){
            remove(this, event, callback, selector)
        })
    }

    $.fn.live = function(event, callback){
        $(document.body).delegate(this.selector, event, callback)
        return this
    }
    $.fn.die = function(event, callback){
        $(document.body).undelegate(this.selector, event, callback)
        return this
    }

    $.fn.on = function(event, selector, callback){
        return !selector || $.isFunction(selector) ?
            this.bind(event, selector || callback) : this.delegate(selector, event, callback)
    }
    $.fn.off = function(event, selector, callback){
        return !selector || $.isFunction(selector) ?
            this.unbind(event, selector || callback) : this.undelegate(selector, event, callback)
    }

    $.fn.trigger = function(event, data){
        if (typeof event == 'string' || $.isPlainObject(event)) event = $.Event(event)
        fix(event)
        event.data = data
        return this.each(function(){
            // items in the collection might not be DOM elements
            // (todo: possibly support events on plain old objects)
            if('dispatchEvent' in this) this.dispatchEvent(event)
        })
    }

    // triggers event handlers on current element just as if an event occurred,
    // doesn't trigger an actual event, doesn't bubble
    $.fn.triggerHandler = function(event, data){
        var e, result
        this.each(function(i, element){
            e = createProxy(typeof event == 'string' ? $.Event(event) : event)
            e.data = data
            e.target = element
            $.each(findHandlers(element, event.type || event), function(i, handler){
                result = handler.proxy(e)
                if (e.isImmediatePropagationStopped()) return false
            })
        })
        return result
    }

        // shortcut methods for `.bind(event, fn)` for each event type
    ;('focusin focusout load resize scroll unload click dblclick '+
        'mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave '+
        'change select keydown keypress keyup error').split(' ').forEach(function(event) {
            $.fn[event] = function(callback) {
                return callback ?
                    this.bind(event, callback) :
                    this.trigger(event)
            }
        })

    ;['focus', 'blur'].forEach(function(name) {
        $.fn[name] = function(callback) {
            if (callback) this.bind(name, callback)
            else this.each(function(){
                try { this[name]() }
                catch(e) {}
            })
            return this
        }
    })

    $.Event = function(type, props) {
        if (typeof type != 'string') props = type, type = props.type
        var event = document.createEvent(specialEvents[type] || 'Events'), bubbles = true
        if (props) for (var name in props) (name == 'bubbles') ? (bubbles = !!props[name]) : (event[name] = props[name])
        event.initEvent(type, bubbles, true, null, null, null, null, null, null, null, null, null, null, null, null)
        event.isDefaultPrevented = function(){ return this.defaultPrevented }
        return event
    }

})(Zepto)

;(function($){
    var jsonpID = 0,
        document = window.document,
        key,
        name,
        rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        scriptTypeRE = /^(?:text|application)\/javascript/i,
        xmlTypeRE = /^(?:text|application)\/xml/i,
        jsonType = 'application/json',
        htmlType = 'text/html',
        blankRE = /^\s*$/

    // trigger a custom event and return false if it was cancelled
    function triggerAndReturn(context, eventName, data) {
        var event = $.Event(eventName)
        $(context).trigger(event, data)
        return !event.defaultPrevented
    }

    // trigger an Ajax "global" event
    function triggerGlobal(settings, context, eventName, data) {
        if (settings.global) return triggerAndReturn(context || document, eventName, data)
    }

    // Number of active Ajax requests
    $.active = 0

    function ajaxStart(settings) {
        if (settings.global && $.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
    }
    function ajaxStop(settings) {
        if (settings.global && !(--$.active)) triggerGlobal(settings, null, 'ajaxStop')
    }

    // triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
    function ajaxBeforeSend(xhr, settings) {
        var context = settings.context
        if (settings.beforeSend.call(context, xhr, settings) === false ||
            triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
            return false

        triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
    }
    function ajaxSuccess(data, xhr, settings) {
        var context = settings.context, status = 'success'
        settings.success.call(context, data, status, xhr)
        triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
        ajaxComplete(status, xhr, settings)
    }
    // type: "timeout", "error", "abort", "parsererror"
    function ajaxError(error, type, xhr, settings) {
        var context = settings.context
        settings.error.call(context, xhr, type, error)
        triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error])
        ajaxComplete(type, xhr, settings)
    }
    // status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
    function ajaxComplete(status, xhr, settings) {
        var context = settings.context
        settings.complete.call(context, xhr, status)
        triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
        ajaxStop(settings)
    }

    // Empty function, used as default callback
    function empty() {}

    $.ajaxJSONP = function(options){
        if (!('type' in options)) return $.ajax(options)

        var callbackName = 'jsonp' + (++jsonpID),
            script = document.createElement('script'),
            cleanup = function() {
                clearTimeout(abortTimeout)
                $(script).remove()
                delete window[callbackName]
            },
            abort = function(type){
                cleanup()
                // In case of manual abort or timeout, keep an empty function as callback
                // so that the SCRIPT tag that eventually loads won't result in an error.
                if (!type || type == 'timeout') window[callbackName] = empty
                ajaxError(null, type || 'abort', xhr, options)
            },
            xhr = { abort: abort }, abortTimeout

        if (ajaxBeforeSend(xhr, options) === false) {
            abort('abort')
            return false
        }

        window[callbackName] = function(data){
            cleanup()
            ajaxSuccess(data, xhr, options)
        }

        script.onerror = function() { abort('error') }

        script.src = options.url.replace(/=\?/, '=' + callbackName)
        $('head').append(script)

        if (options.timeout > 0) abortTimeout = setTimeout(function(){
            abort('timeout')
        }, options.timeout)

        return xhr
    }

    $.ajaxSettings = {
        // Default type of request
        type: 'GET',
        // Callback that is executed before request
        beforeSend: empty,
        // Callback that is executed if the request succeeds
        success: empty,
        // Callback that is executed the the server drops error
        error: empty,
        // Callback that is executed on request complete (both: error and success)
        complete: empty,
        // The context for the callbacks
        context: null,
        // Whether to trigger "global" Ajax events
        global: true,
        // Transport
        xhr: function () {
            return new window.XMLHttpRequest()
        },
        // MIME types mapping
        accepts: {
            script: 'text/javascript, application/javascript',
            json:   jsonType,
            xml:    'application/xml, text/xml',
            html:   htmlType,
            text:   'text/plain'
        },
        // Whether the request is to another domain
        crossDomain: false,
        // Default timeout
        timeout: 0,
        // Whether data should be serialized to string
        processData: true,
        // Whether the browser should be allowed to cache GET responses
        cache: true,
    }

    function mimeToDataType(mime) {
        if (mime) mime = mime.split(';', 2)[0]
        return mime && ( mime == htmlType ? 'html' :
            mime == jsonType ? 'json' :
                scriptTypeRE.test(mime) ? 'script' :
                    xmlTypeRE.test(mime) && 'xml' ) || 'text'
    }

    function appendQuery(url, query) {
        return (url + '&' + query).replace(/[&?]{1,2}/, '?')
    }

    // serialize payload and append it to the URL for GET requests
    function serializeData(options) {
        if (options.processData && options.data && $.type(options.data) != "string")
            options.data = $.param(options.data, options.traditional)
        if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
            options.url = appendQuery(options.url, options.data)
    }

    $.ajax = function(options){
        var settings = $.extend({}, options || {})
        for (key in $.ajaxSettings) if (settings[key] === undefined) settings[key] = $.ajaxSettings[key]

        ajaxStart(settings)

        if (!settings.crossDomain) settings.crossDomain = /^([\w-]+:)?\/\/([^\/]+)/.test(settings.url) &&
            RegExp.$2 != window.location.host

        if (!settings.url) settings.url = window.location.toString()
        serializeData(settings)
        if (settings.cache === false) settings.url = appendQuery(settings.url, '_=' + Date.now())

        var dataType = settings.dataType, hasPlaceholder = /=\?/.test(settings.url)
        if (dataType == 'jsonp' || hasPlaceholder) {
            if (!hasPlaceholder) settings.url = appendQuery(settings.url, 'callback=?')
            return $.ajaxJSONP(settings)
        }

        var mime = settings.accepts[dataType],
            baseHeaders = { },
            protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
            xhr = settings.xhr(), abortTimeout

        if (!settings.crossDomain) baseHeaders['X-Requested-With'] = 'XMLHttpRequest'
        if (mime) {
            baseHeaders['Accept'] = mime
            if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
            xhr.overrideMimeType && xhr.overrideMimeType(mime)
        }
        if (settings.contentType || (settings.contentType !== false && settings.data && settings.type.toUpperCase() != 'GET'))
            baseHeaders['Content-Type'] = (settings.contentType || 'application/x-www-form-urlencoded')
        settings.headers = $.extend(baseHeaders, settings.headers || {})

        xhr.onreadystatechange = function(){
            if (xhr.readyState == 4) {
                xhr.onreadystatechange = empty;
                clearTimeout(abortTimeout)
                var result, error = false
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
                    dataType = dataType || mimeToDataType(xhr.getResponseHeader('content-type'))
                    result = xhr.responseText

                    try {
                        // http://perfectionkills.com/global-eval-what-are-the-options/
                        if (dataType == 'script')    (1,eval)(result)
                        else if (dataType == 'xml')  result = xhr.responseXML
                        else if (dataType == 'json') result = blankRE.test(result) ? null : $.parseJSON(result)
                    } catch (e) { error = e }

                    if (error) ajaxError(error, 'parsererror', xhr, settings)
                    else ajaxSuccess(result, xhr, settings)
                } else {
                    ajaxError(null, xhr.status ? 'error' : 'abort', xhr, settings)
                }
            }
        }

        var async = 'async' in settings ? settings.async : true
        xhr.open(settings.type, settings.url, async)

        for (name in settings.headers) xhr.setRequestHeader(name, settings.headers[name])

        if (ajaxBeforeSend(xhr, settings) === false) {
            xhr.abort()
            return false
        }

        if (settings.timeout > 0) abortTimeout = setTimeout(function(){
            xhr.onreadystatechange = empty
            xhr.abort()
            ajaxError(null, 'timeout', xhr, settings)
        }, settings.timeout)

        // avoid sending empty string (#319)
        xhr.send(settings.data ? settings.data : null)
        return xhr
    }

    // handle optional data/success arguments
    function parseArguments(url, data, success, dataType) {
        var hasData = !$.isFunction(data)
        return {
            url:      url,
            data:     hasData  ? data : undefined,
            success:  !hasData ? data : $.isFunction(success) ? success : undefined,
            dataType: hasData  ? dataType || success : success
        }
    }

    $.get = function(url, data, success, dataType){
        return $.ajax(parseArguments.apply(null, arguments))
    }

    $.post = function(url, data, success, dataType){
        var options = parseArguments.apply(null, arguments)
        options.type = 'POST'
        return $.ajax(options)
    }

    $.getJSON = function(url, data, success){
        var options = parseArguments.apply(null, arguments)
        options.dataType = 'json'
        return $.ajax(options)
    }

    $.fn.load = function(url, data, success){
        if (!this.length) return this
        var self = this, parts = url.split(/\s/), selector,
            options = parseArguments(url, data, success),
            callback = options.success
        if (parts.length > 1) options.url = parts[0], selector = parts[1]
        options.success = function(response){
            self.html(selector ?
                $('<div>').html(response.replace(rscript, "")).find(selector)
                : response)
            callback && callback.apply(self, arguments)
        }
        $.ajax(options)
        return this
    }

    var escape = encodeURIComponent

    function serialize(params, obj, traditional, scope){
        var type, array = $.isArray(obj)
        $.each(obj, function(key, value) {
            type = $.type(value)
            if (scope) key = traditional ? scope : scope + '[' + (array ? '' : key) + ']'
            // handle data in serializeArray() format
            if (!scope && array) params.add(value.name, value.value)
            // recurse into nested objects
            else if (type == "array" || (!traditional && type == "object"))
                serialize(params, value, traditional, key)
            else params.add(key, value)
        })
    }

    $.param = function(obj, traditional){
        var params = []
        params.add = function(k, v){ this.push(escape(k) + '=' + escape(v)) }
        serialize(params, obj, traditional)
        return params.join('&').replace(/%20/g, '+')
    }
})(Zepto)

;(function ($) {
    $.fn.serializeArray = function () {
        var result = [], el
        $( Array.prototype.slice.call(this.get(0).elements) ).each(function () {
            el = $(this)
            var type = el.attr('type')
            if (this.nodeName.toLowerCase() != 'fieldset' &&
                !this.disabled && type != 'submit' && type != 'reset' && type != 'button' &&
                ((type != 'radio' && type != 'checkbox') || this.checked))
                result.push({
                    name: el.attr('name'),
                    value: el.val()
                })
        })
        return result
    }

    $.fn.serialize = function () {
        var result = []
        this.serializeArray().forEach(function (elm) {
            result.push( encodeURIComponent(elm.name) + '=' + encodeURIComponent(elm.value) )
        })
        return result.join('&')
    }

    $.fn.submit = function (callback) {
        if (callback) this.bind('submit', callback)
        else if (this.length) {
            var event = $.Event('submit')
            this.eq(0).trigger(event)
            if (!event.defaultPrevented) this.get(0).submit()
        }
        return this
    }

})(Zepto)

;(function($, undefined){
    var prefix = '', eventPrefix, endEventName, endAnimationName,
        vendors = { Webkit: 'webkit', Moz: '', O: 'o', ms: 'MS' },
        document = window.document, testEl = document.createElement('div'),
        supportedTransforms = /^((translate|rotate|scale)(X|Y|Z|3d)?|matrix(3d)?|perspective|skew(X|Y)?)$/i,
        transform,
        transitionProperty, transitionDuration, transitionTiming,
        animationName, animationDuration, animationTiming,
        cssReset = {}

    function dasherize(str) { return downcase(str.replace(/([a-z])([A-Z])/, '$1-$2')) }
    function downcase(str) { return str.toLowerCase() }
    function normalizeEvent(name) { return eventPrefix ? eventPrefix + name : downcase(name) }

    $.each(vendors, function(vendor, event){
        if (testEl.style[vendor + 'TransitionProperty'] !== undefined) {
            prefix = '-' + downcase(vendor) + '-'
            eventPrefix = event
            return false
        }
    })

    transform = prefix + 'transform'
    cssReset[transitionProperty = prefix + 'transition-property'] =
        cssReset[transitionDuration = prefix + 'transition-duration'] =
            cssReset[transitionTiming   = prefix + 'transition-timing-function'] =
                cssReset[animationName      = prefix + 'animation-name'] =
                    cssReset[animationDuration  = prefix + 'animation-duration'] =
                        cssReset[animationTiming    = prefix + 'animation-timing-function'] = ''

    $.fx = {
        off: (eventPrefix === undefined && testEl.style.transitionProperty === undefined),
        speeds: { _default: 400, fast: 200, slow: 600 },
        cssPrefix: prefix,
        transitionEnd: normalizeEvent('TransitionEnd'),
        animationEnd: normalizeEvent('AnimationEnd')
    }

    $.fn.animate = function(properties, duration, ease, callback){
        if ($.isPlainObject(duration))
            ease = duration.easing, callback = duration.complete, duration = duration.duration
        if (duration) duration = (typeof duration == 'number' ? duration :
            ($.fx.speeds[duration] || $.fx.speeds._default)) / 1000
        return this.anim(properties, duration, ease, callback)
    }

    $.fn.anim = function(properties, duration, ease, callback){
        var key, cssValues = {}, cssProperties, transforms = '',
            that = this, wrappedCallback, endEvent = $.fx.transitionEnd

        if (duration === undefined) duration = 0.4
        if ($.fx.off) duration = 0

        if (typeof properties == 'string') {
            // keyframe animation
            cssValues[animationName] = properties
            cssValues[animationDuration] = duration + 's'
            cssValues[animationTiming] = (ease || 'linear')
            endEvent = $.fx.animationEnd
        } else {
            cssProperties = []
            // CSS transitions
            for (key in properties)
                if (supportedTransforms.test(key)) transforms += key + '(' + properties[key] + ') '
                else cssValues[key] = properties[key], cssProperties.push(dasherize(key))

            if (transforms) cssValues[transform] = transforms, cssProperties.push(transform)
            if (duration > 0 && typeof properties === 'object') {
                cssValues[transitionProperty] = cssProperties.join(', ')
                cssValues[transitionDuration] = duration + 's'
                cssValues[transitionTiming] = (ease || 'linear')
            }
        }

        wrappedCallback = function(event){
            if (typeof event !== 'undefined') {
                if (event.target !== event.currentTarget) return // makes sure the event didn't bubble from "below"
                $(event.target).unbind(endEvent, wrappedCallback)
            }
            $(this).css(cssReset)
            callback && callback.call(this)
        }
        if (duration > 0) this.bind(endEvent, wrappedCallback)

        // trigger page reflow so new elements can animate
        this.size() && this.get(0).clientLeft

        this.css(cssValues)

        if (duration <= 0) setTimeout(function() {
            that.each(function(){ wrappedCallback.call(this) })
        }, 0)

        return this
    }

    testEl = null
})(Zepto)

//     Zepto.js
//     (c) 2010-2012 Thomas Fuchs
//     Zepto.js may be freely distributed under the MIT license.

// The following code is heavily inspired by jQuery's $.fn.data()

;(function($) {
    var data = {}, dataAttr = $.fn.data, camelize = $.camelCase,
        exp = $.expando = 'Zepto' + (+new Date())

    // Get value from node:
    // 1. first try key as given,
    // 2. then try camelized key,
    // 3. fall back to reading "data-*" attribute.
    function getData(node, name) {
        var id = node[exp], store = id && data[id]
        if (name === undefined) return store || setData(node)
        else {
            if (store) {
                if (name in store) return store[name]
                var camelName = camelize(name)
                if (camelName in store) return store[camelName]
            }
            return dataAttr.call($(node), name)
        }
    }

    // Store value under camelized key on node
    function setData(node, name, value) {
        var id = node[exp] || (node[exp] = ++$.uuid),
            store = data[id] || (data[id] = attributeData(node))
        if (name !== undefined) store[camelize(name)] = value
        return store
    }

    // Read all "data-*" attributes from a node
    function attributeData(node) {
        var store = {}
        $.each(node.attributes, function(i, attr){
            if (attr.name.indexOf('data-') == 0)
                store[camelize(attr.name.replace('data-', ''))] =
                    $.zepto.deserializeValue(attr.value)
        })
        return store
    }

    $.fn.data = function(name, value) {
        return value === undefined ?
            // set multiple values via object
            $.isPlainObject(name) ?
                this.each(function(i, node){
                    $.each(name, function(key, value){ setData(node, key, value) })
                }) :
                // get value from first element
                this.length == 0 ? undefined : getData(this[0], name) :
            // set value on all elements
            this.each(function(){ setData(this, name, value) })
    }

    $.fn.removeData = function(names) {
        if (typeof names == 'string') names = names.split(/\s+/)
        return this.each(function(){
            var id = this[exp], store = id && data[id]
            if (store) $.each(names, function(){ delete store[camelize(this)] })
        })
    }
})(Zepto);
define("jquery", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.$;
    };
}(this)));

// Underscore.js 1.4.4
// ===================

// > http://underscorejs.org
// > (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
// > Underscore may be freely distributed under the MIT license.

// Baseline setup
// --------------
(function() {

    // Establish the root object, `window` in the browser, or `global` on the server.
    var root = this;

    // Save the previous value of the `_` variable.
    var previousUnderscore = root._;

    // Establish the object that gets returned to break out of a loop iteration.
    var breaker = {};

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var push             = ArrayProto.push,
        slice            = ArrayProto.slice,
        concat           = ArrayProto.concat,
        toString         = ObjProto.toString,
        hasOwnProperty   = ObjProto.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    var
        nativeForEach      = ArrayProto.forEach,
        nativeMap          = ArrayProto.map,
        nativeReduce       = ArrayProto.reduce,
        nativeReduceRight  = ArrayProto.reduceRight,
        nativeFilter       = ArrayProto.filter,
        nativeEvery        = ArrayProto.every,
        nativeSome         = ArrayProto.some,
        nativeIndexOf      = ArrayProto.indexOf,
        nativeLastIndexOf  = ArrayProto.lastIndexOf,
        nativeIsArray      = Array.isArray,
        nativeKeys         = Object.keys,
        nativeBind         = FuncProto.bind;

    // Create a safe reference to the Underscore object for use below.
    var _ = function(obj) {
        if (obj instanceof _) return obj;
        if (!(this instanceof _)) return new _(obj);
        this._wrapped = obj;
    };

    // Export the Underscore object for **Node.js**, with
    // backwards-compatibility for the old `require()` API. If we're in
    // the browser, add `_` as a global object via a string identifier,
    // for Closure Compiler "advanced" mode.
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = _;
        }
        exports._ = _;
    } else {
        root._ = _;
    }

    // Current version.
    _.VERSION = '1.4.4';

    // Collection Functions
    // --------------------

    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles objects with the built-in `forEach`, arrays, and raw objects.
    // Delegates to **ECMAScript 5**'s native `forEach` if available.
    var each = _.each = _.forEach = function(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, l = obj.length; i < l; i++) {
                if (iterator.call(context, obj[i], i, obj) === breaker) return;
            }
        } else {
            for (var key in obj) {
                if (_.has(obj, key)) {
                    if (iterator.call(context, obj[key], key, obj) === breaker) return;
                }
            }
        }
    };

    // Return the results of applying the iterator to each element.
    // Delegates to **ECMAScript 5**'s native `map` if available.
    _.map = _.collect = function(obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
        each(obj, function(value, index, list) {
            results[results.length] = iterator.call(context, value, index, list);
        });
        return results;
    };

    var reduceError = 'Reduce of empty array with no initial value';

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
    _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
        var initial = arguments.length > 2;
        if (obj == null) obj = [];
        if (nativeReduce && obj.reduce === nativeReduce) {
            if (context) iterator = _.bind(iterator, context);
            return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
        }
        each(obj, function(value, index, list) {
            if (!initial) {
                memo = value;
                initial = true;
            } else {
                memo = iterator.call(context, memo, value, index, list);
            }
        });
        if (!initial) throw new TypeError(reduceError);
        return memo;
    };

    // The right-associative version of reduce, also known as `foldr`.
    // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
    _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
        var initial = arguments.length > 2;
        if (obj == null) obj = [];
        if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
            if (context) iterator = _.bind(iterator, context);
            return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
        }
        var length = obj.length;
        if (length !== +length) {
            var keys = _.keys(obj);
            length = keys.length;
        }
        each(obj, function(value, index, list) {
            index = keys ? keys[--length] : --length;
            if (!initial) {
                memo = obj[index];
                initial = true;
            } else {
                memo = iterator.call(context, memo, obj[index], index, list);
            }
        });
        if (!initial) throw new TypeError(reduceError);
        return memo;
    };

    // Return the first value which passes a truth test. Aliased as `detect`.
    _.find = _.detect = function(obj, iterator, context) {
        var result;
        any(obj, function(value, index, list) {
            if (iterator.call(context, value, index, list)) {
                result = value;
                return true;
            }
        });
        return result;
    };

    // Return all the elements that pass a truth test.
    // Delegates to **ECMAScript 5**'s native `filter` if available.
    // Aliased as `select`.
    _.filter = _.select = function(obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
        each(obj, function(value, index, list) {
            if (iterator.call(context, value, index, list)) results[results.length] = value;
        });
        return results;
    };

    // Return all the elements for which a truth test fails.
    _.reject = function(obj, iterator, context) {
        return _.filter(obj, function(value, index, list) {
            return !iterator.call(context, value, index, list);
        }, context);
    };

    // Determine whether all of the elements match a truth test.
    // Delegates to **ECMAScript 5**'s native `every` if available.
    // Aliased as `all`.
    _.every = _.all = function(obj, iterator, context) {
        iterator || (iterator = _.identity);
        var result = true;
        if (obj == null) return result;
        if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
        each(obj, function(value, index, list) {
            if (!(result = result && iterator.call(context, value, index, list))) return breaker;
        });
        return !!result;
    };

    // Determine if at least one element in the object matches a truth test.
    // Delegates to **ECMAScript 5**'s native `some` if available.
    // Aliased as `any`.
    var any = _.some = _.any = function(obj, iterator, context) {
        iterator || (iterator = _.identity);
        var result = false;
        if (obj == null) return result;
        if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
        each(obj, function(value, index, list) {
            if (result || (result = iterator.call(context, value, index, list))) return breaker;
        });
        return !!result;
    };

    // Determine if the array or object contains a given value (using `===`).
    // Aliased as `include`.
    _.contains = _.include = function(obj, target) {
        if (obj == null) return false;
        if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
        return any(obj, function(value) {
            return value === target;
        });
    };

    // Invoke a method (with arguments) on every item in a collection.
    _.invoke = function(obj, method) {
        var args = slice.call(arguments, 2);
        var isFunc = _.isFunction(method);
        return _.map(obj, function(value) {
            return (isFunc ? method : value[method]).apply(value, args);
        });
    };

    // Convenience version of a common use case of `map`: fetching a property.
    _.pluck = function(obj, key) {
        return _.map(obj, function(value){ return value[key]; });
    };

    // Convenience version of a common use case of `filter`: selecting only objects
    // containing specific `key:value` pairs.
    _.where = function(obj, attrs, first) {
        if (_.isEmpty(attrs)) return first ? null : [];
        return _[first ? 'find' : 'filter'](obj, function(value) {
            for (var key in attrs) {
                if (attrs[key] !== value[key]) return false;
            }
            return true;
        });
    };

    // Convenience version of a common use case of `find`: getting the first object
    // containing specific `key:value` pairs.
    _.findWhere = function(obj, attrs) {
        return _.where(obj, attrs, true);
    };

    // Return the maximum element or (element-based computation).
    // Can't optimize arrays of integers longer than 65,535 elements.
    // See: https://bugs.webkit.org/show_bug.cgi?id=80797
    _.max = function(obj, iterator, context) {
        if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
            return Math.max.apply(Math, obj);
        }
        if (!iterator && _.isEmpty(obj)) return -Infinity;
        var result = {computed : -Infinity, value: -Infinity};
        each(obj, function(value, index, list) {
            var computed = iterator ? iterator.call(context, value, index, list) : value;
            computed >= result.computed && (result = {value : value, computed : computed});
        });
        return result.value;
    };

    // Return the minimum element (or element-based computation).
    _.min = function(obj, iterator, context) {
        if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
            return Math.min.apply(Math, obj);
        }
        if (!iterator && _.isEmpty(obj)) return Infinity;
        var result = {computed : Infinity, value: Infinity};
        each(obj, function(value, index, list) {
            var computed = iterator ? iterator.call(context, value, index, list) : value;
            computed < result.computed && (result = {value : value, computed : computed});
        });
        return result.value;
    };

    // Shuffle an array.
    _.shuffle = function(obj) {
        var rand;
        var index = 0;
        var shuffled = [];
        each(obj, function(value) {
            rand = _.random(index++);
            shuffled[index - 1] = shuffled[rand];
            shuffled[rand] = value;
        });
        return shuffled;
    };

    // An internal function to generate lookup iterators.
    var lookupIterator = function(value) {
        return _.isFunction(value) ? value : function(obj){ return obj[value]; };
    };

    // Sort the object's values by a criterion produced by an iterator.
    _.sortBy = function(obj, value, context) {
        var iterator = lookupIterator(value);
        return _.pluck(_.map(obj, function(value, index, list) {
            return {
                value : value,
                index : index,
                criteria : iterator.call(context, value, index, list)
            };
        }).sort(function(left, right) {
                var a = left.criteria;
                var b = right.criteria;
                if (a !== b) {
                    if (a > b || a === void 0) return 1;
                    if (a < b || b === void 0) return -1;
                }
                return left.index < right.index ? -1 : 1;
            }), 'value');
    };

    // An internal function used for aggregate "group by" operations.
    var group = function(obj, value, context, behavior) {
        var result = {};
        var iterator = lookupIterator(value || _.identity);
        each(obj, function(value, index) {
            var key = iterator.call(context, value, index, obj);
            behavior(result, key, value);
        });
        return result;
    };

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    _.groupBy = function(obj, value, context) {
        return group(obj, value, context, function(result, key, value) {
            (_.has(result, key) ? result[key] : (result[key] = [])).push(value);
        });
    };

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    _.countBy = function(obj, value, context) {
        return group(obj, value, context, function(result, key) {
            if (!_.has(result, key)) result[key] = 0;
            result[key]++;
        });
    };

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    _.sortedIndex = function(array, obj, iterator, context) {
        iterator = iterator == null ? _.identity : lookupIterator(iterator);
        var value = iterator.call(context, obj);
        var low = 0, high = array.length;
        while (low < high) {
            var mid = (low + high) >>> 1;
            iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
        }
        return low;
    };

    // Safely convert anything iterable into a real, live array.
    _.toArray = function(obj) {
        if (!obj) return [];
        if (_.isArray(obj)) return slice.call(obj);
        if (obj.length === +obj.length) return _.map(obj, _.identity);
        return _.values(obj);
    };

    // Return the number of elements in an object.
    _.size = function(obj) {
        if (obj == null) return 0;
        return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
    };

    // Array Functions
    // ---------------

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. Aliased as `head` and `take`. The **guard** check
    // allows it to work with `_.map`.
    _.first = _.head = _.take = function(array, n, guard) {
        if (array == null) return void 0;
        return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
    };

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N. The **guard** check allows it to work with
    // `_.map`.
    _.initial = function(array, n, guard) {
        return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
    };

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array. The **guard** check allows it to work with `_.map`.
    _.last = function(array, n, guard) {
        if (array == null) return void 0;
        if ((n != null) && !guard) {
            return slice.call(array, Math.max(array.length - n, 0));
        } else {
            return array[array.length - 1];
        }
    };

    // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
    // Especially useful on the arguments object. Passing an **n** will return
    // the rest N values in the array. The **guard**
    // check allows it to work with `_.map`.
    _.rest = _.tail = _.drop = function(array, n, guard) {
        return slice.call(array, (n == null) || guard ? 1 : n);
    };

    // Trim out all falsy values from an array.
    _.compact = function(array) {
        return _.filter(array, _.identity);
    };

    // Internal implementation of a recursive `flatten` function.
    var flatten = function(input, shallow, output) {
        each(input, function(value) {
            if (_.isArray(value)) {
                shallow ? push.apply(output, value) : flatten(value, shallow, output);
            } else {
                output.push(value);
            }
        });
        return output;
    };

    // Return a completely flattened version of an array.
    _.flatten = function(array, shallow) {
        return flatten(array, shallow, []);
    };

    // Return a version of the array that does not contain the specified value(s).
    _.without = function(array) {
        return _.difference(array, slice.call(arguments, 1));
    };

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // Aliased as `unique`.
    _.uniq = _.unique = function(array, isSorted, iterator, context) {
        if (_.isFunction(isSorted)) {
            context = iterator;
            iterator = isSorted;
            isSorted = false;
        }
        var initial = iterator ? _.map(array, iterator, context) : array;
        var results = [];
        var seen = [];
        each(initial, function(value, index) {
            if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
                seen.push(value);
                results.push(array[index]);
            }
        });
        return results;
    };

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    _.union = function() {
        return _.uniq(concat.apply(ArrayProto, arguments));
    };

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    _.intersection = function(array) {
        var rest = slice.call(arguments, 1);
        return _.filter(_.uniq(array), function(item) {
            return _.every(rest, function(other) {
                return _.indexOf(other, item) >= 0;
            });
        });
    };

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    _.difference = function(array) {
        var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
        return _.filter(array, function(value){ return !_.contains(rest, value); });
    };

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    _.zip = function() {
        var args = slice.call(arguments);
        var length = _.max(_.pluck(args, 'length'));
        var results = new Array(length);
        for (var i = 0; i < length; i++) {
            results[i] = _.pluck(args, "" + i);
        }
        return results;
    };

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values.
    _.object = function(list, values) {
        if (list == null) return {};
        var result = {};
        for (var i = 0, l = list.length; i < l; i++) {
            if (values) {
                result[list[i]] = values[i];
            } else {
                result[list[i][0]] = list[i][1];
            }
        }
        return result;
    };

    // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
    // we need this function. Return the position of the first occurrence of an
    // item in an array, or -1 if the item is not included in the array.
    // Delegates to **ECMAScript 5**'s native `indexOf` if available.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    _.indexOf = function(array, item, isSorted) {
        if (array == null) return -1;
        var i = 0, l = array.length;
        if (isSorted) {
            if (typeof isSorted == 'number') {
                i = (isSorted < 0 ? Math.max(0, l + isSorted) : isSorted);
            } else {
                i = _.sortedIndex(array, item);
                return array[i] === item ? i : -1;
            }
        }
        if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
        for (; i < l; i++) if (array[i] === item) return i;
        return -1;
    };

    // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
    _.lastIndexOf = function(array, item, from) {
        if (array == null) return -1;
        var hasIndex = from != null;
        if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
            return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
        }
        var i = (hasIndex ? from : array.length);
        while (i--) if (array[i] === item) return i;
        return -1;
    };

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](http://docs.python.org/library/functions.html#range).
    _.range = function(start, stop, step) {
        if (arguments.length <= 1) {
            stop = start || 0;
            start = 0;
        }
        step = arguments[2] || 1;

        var len = Math.max(Math.ceil((stop - start) / step), 0);
        var idx = 0;
        var range = new Array(len);

        while(idx < len) {
            range[idx++] = start;
            start += step;
        }

        return range;
    };

    // Function (ahem) Functions
    // ------------------

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function(func, context) {
        if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        var args = slice.call(arguments, 2);
        return function() {
            return func.apply(context, args.concat(slice.call(arguments)));
        };
    };

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context.
    _.partial = function(func) {
        var args = slice.call(arguments, 1);
        return function() {
            return func.apply(this, args.concat(slice.call(arguments)));
        };
    };

    // Bind all of an object's methods to that object. Useful for ensuring that
    // all callbacks defined on an object belong to it.
    _.bindAll = function(obj) {
        var funcs = slice.call(arguments, 1);
        if (funcs.length === 0) funcs = _.functions(obj);
        each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
        return obj;
    };

    // Memoize an expensive function by storing its results.
    _.memoize = function(func, hasher) {
        var memo = {};
        hasher || (hasher = _.identity);
        return function() {
            var key = hasher.apply(this, arguments);
            return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
        };
    };

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    _.delay = function(func, wait) {
        var args = slice.call(arguments, 2);
        return setTimeout(function(){ return func.apply(null, args); }, wait);
    };

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    _.defer = function(func) {
        return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
    };

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time.
    _.throttle = function(func, wait) {
        var context, args, timeout, result;
        var previous = 0;
        var later = function() {
            previous = new Date;
            timeout = null;
            result = func.apply(context, args);
        };
        return function() {
            var now = new Date;
            var remaining = wait - (now - previous);
            context = this;
            args = arguments;
            if (remaining <= 0) {
                clearTimeout(timeout);
                timeout = null;
                previous = now;
                result = func.apply(context, args);
            } else if (!timeout) {
                timeout = setTimeout(later, remaining);
            }
            return result;
        };
    };

    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    _.debounce = function(func, wait, immediate) {
        var timeout, result;
        return function() {
            var context = this, args = arguments;
            var later = function() {
                timeout = null;
                if (!immediate) result = func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) result = func.apply(context, args);
            return result;
        };
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _.once = function(func) {
        var ran = false, memo;
        return function() {
            if (ran) return memo;
            ran = true;
            memo = func.apply(this, arguments);
            func = null;
            return memo;
        };
    };

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    _.wrap = function(func, wrapper) {
        return function() {
            var args = [func];
            push.apply(args, arguments);
            return wrapper.apply(this, args);
        };
    };

    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    _.compose = function() {
        var funcs = arguments;
        return function() {
            var args = arguments;
            for (var i = funcs.length - 1; i >= 0; i--) {
                args = [funcs[i].apply(this, args)];
            }
            return args[0];
        };
    };

    // Returns a function that will only be executed after being called N times.
    _.after = function(times, func) {
        if (times <= 0) return func();
        return function() {
            if (--times < 1) {
                return func.apply(this, arguments);
            }
        };
    };

    // Object Functions
    // ----------------

    // Retrieve the names of an object's properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _.keys = nativeKeys || function(obj) {
        if (obj !== Object(obj)) throw new TypeError('Invalid object');
        var keys = [];
        for (var key in obj) if (_.has(obj, key)) keys[keys.length] = key;
        return keys;
    };

    // Retrieve the values of an object's properties.
    _.values = function(obj) {
        var values = [];
        for (var key in obj) if (_.has(obj, key)) values.push(obj[key]);
        return values;
    };

    // Convert an object into a list of `[key, value]` pairs.
    _.pairs = function(obj) {
        var pairs = [];
        for (var key in obj) if (_.has(obj, key)) pairs.push([key, obj[key]]);
        return pairs;
    };

    // Invert the keys and values of an object. The values must be serializable.
    _.invert = function(obj) {
        var result = {};
        for (var key in obj) if (_.has(obj, key)) result[obj[key]] = key;
        return result;
    };

    // Return a sorted list of the function names available on the object.
    // Aliased as `methods`
    _.functions = _.methods = function(obj) {
        var names = [];
        for (var key in obj) {
            if (_.isFunction(obj[key])) names.push(key);
        }
        return names.sort();
    };

    // Extend a given object with all the properties in passed-in object(s).
    _.extend = function(obj) {
        each(slice.call(arguments, 1), function(source) {
            if (source) {
                for (var prop in source) {
                    obj[prop] = source[prop];
                }
            }
        });
        return obj;
    };

    // Return a copy of the object only containing the whitelisted properties.
    _.pick = function(obj) {
        var copy = {};
        var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
        each(keys, function(key) {
            if (key in obj) copy[key] = obj[key];
        });
        return copy;
    };

    // Return a copy of the object without the blacklisted properties.
    _.omit = function(obj) {
        var copy = {};
        var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
        for (var key in obj) {
            if (!_.contains(keys, key)) copy[key] = obj[key];
        }
        return copy;
    };

    // Fill in a given object with default properties.
    _.defaults = function(obj) {
        each(slice.call(arguments, 1), function(source) {
            if (source) {
                for (var prop in source) {
                    if (obj[prop] == null) obj[prop] = source[prop];
                }
            }
        });
        return obj;
    };

    // Create a (shallow-cloned) duplicate of an object.
    _.clone = function(obj) {
        if (!_.isObject(obj)) return obj;
        return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
    };

    // Invokes interceptor with the obj, and then returns obj.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    _.tap = function(obj, interceptor) {
        interceptor(obj);
        return obj;
    };

    // Internal recursive comparison function for `isEqual`.
    var eq = function(a, b, aStack, bStack) {
        // Identical objects are equal. `0 === -0`, but they aren't identical.
        // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
        if (a === b) return a !== 0 || 1 / a == 1 / b;
        // A strict comparison is necessary because `null == undefined`.
        if (a == null || b == null) return a === b;
        // Unwrap any wrapped objects.
        if (a instanceof _) a = a._wrapped;
        if (b instanceof _) b = b._wrapped;
        // Compare `[[Class]]` names.
        var className = toString.call(a);
        if (className != toString.call(b)) return false;
        switch (className) {
            // Strings, numbers, dates, and booleans are compared by value.
            case '[object String]':
                // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
                // equivalent to `new String("5")`.
                return a == String(b);
            case '[object Number]':
                // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
                // other numeric values.
                return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
            case '[object Date]':
            case '[object Boolean]':
                // Coerce dates and booleans to numeric primitive values. Dates are compared by their
                // millisecond representations. Note that invalid dates with millisecond representations
                // of `NaN` are not equivalent.
                return +a == +b;
            // RegExps are compared by their source patterns and flags.
            case '[object RegExp]':
                return a.source == b.source &&
                    a.global == b.global &&
                    a.multiline == b.multiline &&
                    a.ignoreCase == b.ignoreCase;
        }
        if (typeof a != 'object' || typeof b != 'object') return false;
        // Assume equality for cyclic structures. The algorithm for detecting cyclic
        // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
        var length = aStack.length;
        while (length--) {
            // Linear search. Performance is inversely proportional to the number of
            // unique nested structures.
            if (aStack[length] == a) return bStack[length] == b;
        }
        // Add the first object to the stack of traversed objects.
        aStack.push(a);
        bStack.push(b);
        var size = 0, result = true;
        // Recursively compare objects and arrays.
        if (className == '[object Array]') {
            // Compare array lengths to determine if a deep comparison is necessary.
            size = a.length;
            result = size == b.length;
            if (result) {
                // Deep compare the contents, ignoring non-numeric properties.
                while (size--) {
                    if (!(result = eq(a[size], b[size], aStack, bStack))) break;
                }
            }
        } else {
            // Objects with different constructors are not equivalent, but `Object`s
            // from different frames are.
            var aCtor = a.constructor, bCtor = b.constructor;
            if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                _.isFunction(bCtor) && (bCtor instanceof bCtor))) {
                return false;
            }
            // Deep compare objects.
            for (var key in a) {
                if (_.has(a, key)) {
                    // Count the expected number of properties.
                    size++;
                    // Deep compare each member.
                    if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
                }
            }
            // Ensure that both objects contain the same number of properties.
            if (result) {
                for (key in b) {
                    if (_.has(b, key) && !(size--)) break;
                }
                result = !size;
            }
        }
        // Remove the first object from the stack of traversed objects.
        aStack.pop();
        bStack.pop();
        return result;
    };

    // Perform a deep comparison to check if two objects are equal.
    _.isEqual = function(a, b) {
        return eq(a, b, [], []);
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    _.isEmpty = function(obj) {
        if (obj == null) return true;
        if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
        for (var key in obj) if (_.has(obj, key)) return false;
        return true;
    };

    // Is a given value a DOM element?
    _.isElement = function(obj) {
        return !!(obj && obj.nodeType === 1);
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _.isArray = nativeIsArray || function(obj) {
        return toString.call(obj) == '[object Array]';
    };

    // Is a given variable an object?
    _.isObject = function(obj) {
        return obj === Object(obj);
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
    each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
        _['is' + name] = function(obj) {
            return toString.call(obj) == '[object ' + name + ']';
        };
    });

    // Define a fallback version of the method in browsers (ahem, IE), where
    // there isn't any inspectable "Arguments" type.
    if (!_.isArguments(arguments)) {
        _.isArguments = function(obj) {
            return !!(obj && _.has(obj, 'callee'));
        };
    }

    // Optimize `isFunction` if appropriate.
    if (typeof (/./) !== 'function') {
        _.isFunction = function(obj) {
            return typeof obj === 'function';
        };
    }

    // Is a given object a finite number?
    _.isFinite = function(obj) {
        return isFinite(obj) && !isNaN(parseFloat(obj));
    };

    // Is the given value `NaN`? (NaN is the only number which does not equal itself).
    _.isNaN = function(obj) {
        return _.isNumber(obj) && obj != +obj;
    };

    // Is a given value a boolean?
    _.isBoolean = function(obj) {
        return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
    };

    // Is a given value equal to null?
    _.isNull = function(obj) {
        return obj === null;
    };

    // Is a given variable undefined?
    _.isUndefined = function(obj) {
        return obj === void 0;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _.has = function(obj, key) {
        return hasOwnProperty.call(obj, key);
    };

    // Utility Functions
    // -----------------

    // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
    // previous owner. Returns a reference to the Underscore object.
    _.noConflict = function() {
        root._ = previousUnderscore;
        return this;
    };

    // Keep the identity function around for default iterators.
    _.identity = function(value) {
        return value;
    };

    // Run a function **n** times.
    _.times = function(n, iterator, context) {
        var accum = Array(n);
        for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
        return accum;
    };

    // Return a random integer between min and max (inclusive).
    _.random = function(min, max) {
        if (max == null) {
            max = min;
            min = 0;
        }
        return min + Math.floor(Math.random() * (max - min + 1));
    };

    // List of HTML entities for escaping.
    var entityMap = {
        escape: {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        }
    };
    entityMap.unescape = _.invert(entityMap.escape);

    // Regexes containing the keys and values listed immediately above.
    var entityRegexes = {
        escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
        unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
    };

    // Functions for escaping and unescaping strings to/from HTML interpolation.
    _.each(['escape', 'unescape'], function(method) {
        _[method] = function(string) {
            if (string == null) return '';
            return ('' + string).replace(entityRegexes[method], function(match) {
                return entityMap[method][match];
            });
        };
    });

    // If the value of the named property is a function then invoke it;
    // otherwise, return it.
    _.result = function(object, property) {
        if (object == null) return null;
        var value = object[property];
        return _.isFunction(value) ? value.call(object) : value;
    };

    // Add your own custom functions to the Underscore object.
    _.mixin = function(obj) {
        each(_.functions(obj), function(name){
            var func = _[name] = obj[name];
            _.prototype[name] = function() {
                var args = [this._wrapped];
                push.apply(args, arguments);
                return result.call(this, func.apply(_, args));
            };
        });
    };

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    var idCounter = 0;
    _.uniqueId = function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    };

    // By default, Underscore uses ERB-style template delimiters, change the
    // following template settings to use alternative delimiters.
    _.templateSettings = {
        evaluate    : /<%([\s\S]+?)%>/g,
        interpolate : /<%=([\s\S]+?)%>/g,
        escape      : /<%-([\s\S]+?)%>/g
    };

    // When customizing `templateSettings`, if you don't want to define an
    // interpolation, evaluation or escaping regex, we need one that is
    // guaranteed not to match.
    var noMatch = /(.)^/;

    // Certain characters need to be escaped so that they can be put into a
    // string literal.
    var escapes = {
        "'":      "'",
        '\\':     '\\',
        '\r':     'r',
        '\n':     'n',
        '\t':     't',
        '\u2028': 'u2028',
        '\u2029': 'u2029'
    };

    var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

    // JavaScript micro-templating, similar to John Resig's implementation.
    // Underscore templating handles arbitrary delimiters, preserves whitespace,
    // and correctly escapes quotes within interpolated code.
    _.template = function(text, data, settings) {
        var render;
        settings = _.defaults({}, settings, _.templateSettings);

        // Combine delimiters into one regular expression via alternation.
        var matcher = new RegExp([
            (settings.escape || noMatch).source,
            (settings.interpolate || noMatch).source,
            (settings.evaluate || noMatch).source
        ].join('|') + '|$', 'g');

        // Compile the template source, escaping string literals appropriately.
        var index = 0;
        var source = "__p+='";
        text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
            source += text.slice(index, offset)
                .replace(escaper, function(match) { return '\\' + escapes[match]; });

            if (escape) {
                source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
            }
            if (interpolate) {
                source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
            }
            if (evaluate) {
                source += "';\n" + evaluate + "\n__p+='";
            }
            index = offset + match.length;
            return match;
        });
        source += "';\n";

        // If a variable is not specified, place data values in local scope.
        if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

        source = "var __t,__p='',__j=Array.prototype.join," +
            "print=function(){__p+=__j.call(arguments,'');};\n" +
            source + "return __p;\n";

        try {
            render = new Function(settings.variable || 'obj', '_', source);
        } catch (e) {
            e.source = source;
            throw e;
        }

        if (data) return render(data, _);
        var template = function(data) {
            return render.call(this, data, _);
        };

        // Provide the compiled function source as a convenience for precompilation.
        template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

        return template;
    };

    // Add a "chain" function, which will delegate to the wrapper.
    _.chain = function(obj) {
        return _(obj).chain();
    };

    // OOP
    // ---------------
    // If Underscore is called as a function, it returns a wrapped object that
    // can be used OO-style. This wrapper holds altered versions of all the
    // underscore functions. Wrapped objects may be chained.

    // Helper function to continue chaining intermediate results.
    var result = function(obj) {
        return this._chain ? _(obj).chain() : obj;
    };

    // Add all of the Underscore functions to the wrapper object.
    _.mixin(_);

    // Add all mutator Array functions to the wrapper.
    each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            var obj = this._wrapped;
            method.apply(obj, arguments);
            if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
            return result.call(this, obj);
        };
    });

    // Add all accessor Array functions to the wrapper.
    each(['concat', 'join', 'slice'], function(name) {
        var method = ArrayProto[name];
        _.prototype[name] = function() {
            return result.call(this, method.apply(this._wrapped, arguments));
        };
    });

    _.extend(_.prototype, {

        // Start chaining a wrapped Underscore object.
        chain: function() {
            this._chain = true;
            return this;
        },

        // Extracts the result from a wrapped and chained object.
        value: function() {
            return this._wrapped;
        }

    });

}).call(this);
define("underscore", (function (global) {
    return function () {
        var ret, fn;
        return ret || global._;
    };
}(this)));

//     Backbone.js 1.0.0

//     (c) 2010-2013 Jeremy Ashkenas, DocumentCloud Inc.
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(){

    // Initial Setup
    // -------------

    // Save a reference to the global object (`window` in the browser, `exports`
    // on the server).
    var root = this;

    // Save the previous value of the `Backbone` variable, so that it can be
    // restored later on, if `noConflict` is used.
    var previousBackbone = root.Backbone;

    // Create local references to array methods we'll want to use later.
    var array = [];
    var push = array.push;
    var slice = array.slice;
    var splice = array.splice;

    // The top-level namespace. All public Backbone classes and modules will
    // be attached to this. Exported for both the browser and the server.
    var Backbone;
    if (typeof exports !== 'undefined') {
        Backbone = exports;
    } else {
        Backbone = root.Backbone = {};
    }

    // Current version of the library. Keep in sync with `package.json`.
    Backbone.VERSION = '1.0.0';

    // Require Underscore, if we're on the server, and it's not already present.
    var _ = root._;
    if (!_ && (typeof require !== 'undefined')) _ = require('underscore');

    // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
    // the `$` variable.
    Backbone.$ = root.jQuery || root.Zepto || root.ender || root.$;

    // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
    // to its previous owner. Returns a reference to this Backbone object.
    Backbone.noConflict = function() {
        root.Backbone = previousBackbone;
        return this;
    };

    // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
    // will fake `"PUT"` and `"DELETE"` requests via the `_method` parameter and
    // set a `X-Http-Method-Override` header.
    Backbone.emulateHTTP = false;

    // Turn on `emulateJSON` to support legacy servers that can't deal with direct
    // `application/json` requests ... will encode the body as
    // `application/x-www-form-urlencoded` instead and will send the model in a
    // form param named `model`.
    Backbone.emulateJSON = false;

    // Backbone.Events
    // ---------------

    // A module that can be mixed in to *any object* in order to provide it with
    // custom events. You may bind with `on` or remove with `off` callback
    // functions to an event; `trigger`-ing an event fires all callbacks in
    // succession.
    //
    //     var object = {};
    //     _.extend(object, Backbone.Events);
    //     object.on('expand', function(){ alert('expanded'); });
    //     object.trigger('expand');
    //
    var Events = Backbone.Events = {

        // Bind an event to a `callback` function. Passing `"all"` will bind
        // the callback to all events fired.
        on: function(name, callback, context) {
            if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
            this._events || (this._events = {});
            var events = this._events[name] || (this._events[name] = []);
            events.push({callback: callback, context: context, ctx: context || this});
            return this;
        },

        // Bind an event to only be triggered a single time. After the first time
        // the callback is invoked, it will be removed.
        once: function(name, callback, context) {
            if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
            var self = this;
            var once = _.once(function() {
                self.off(name, once);
                callback.apply(this, arguments);
            });
            once._callback = callback;
            return this.on(name, once, context);
        },

        // Remove one or many callbacks. If `context` is null, removes all
        // callbacks with that function. If `callback` is null, removes all
        // callbacks for the event. If `name` is null, removes all bound
        // callbacks for all events.
        off: function(name, callback, context) {
            var retain, ev, events, names, i, l, j, k;
            if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
            if (!name && !callback && !context) {
                this._events = {};
                return this;
            }

            names = name ? [name] : _.keys(this._events);
            for (i = 0, l = names.length; i < l; i++) {
                name = names[i];
                if (events = this._events[name]) {
                    this._events[name] = retain = [];
                    if (callback || context) {
                        for (j = 0, k = events.length; j < k; j++) {
                            ev = events[j];
                            if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                                (context && context !== ev.context)) {
                                retain.push(ev);
                            }
                        }
                    }
                    if (!retain.length) delete this._events[name];
                }
            }

            return this;
        },

        // Trigger one or many events, firing all bound callbacks. Callbacks are
        // passed the same arguments as `trigger` is, apart from the event name
        // (unless you're listening on `"all"`, which will cause your callback to
        // receive the true name of the event as the first argument).
        trigger: function(name) {
            if (!this._events) return this;
            var args = slice.call(arguments, 1);
            if (!eventsApi(this, 'trigger', name, args)) return this;
            var events = this._events[name];
            var allEvents = this._events.all;
            if (events) triggerEvents(events, args);
            if (allEvents) triggerEvents(allEvents, arguments);
            return this;
        },

        // Tell this object to stop listening to either specific events ... or
        // to every object it's currently listening to.
        stopListening: function(obj, name, callback) {
            var listeners = this._listeners;
            if (!listeners) return this;
            var deleteListener = !name && !callback;
            if (typeof name === 'object') callback = this;
            if (obj) (listeners = {})[obj._listenerId] = obj;
            for (var id in listeners) {
                listeners[id].off(name, callback, this);
                if (deleteListener) delete this._listeners[id];
            }
            return this;
        }

    };

    // Regular expression used to split event strings.
    var eventSplitter = /\s+/;

    // Implement fancy features of the Events API such as multiple event
    // names `"change blur"` and jQuery-style event maps `{change: action}`
    // in terms of the existing API.
    var eventsApi = function(obj, action, name, rest) {
        if (!name) return true;

        // Handle event maps.
        if (typeof name === 'object') {
            for (var key in name) {
                obj[action].apply(obj, [key, name[key]].concat(rest));
            }
            return false;
        }

        // Handle space separated event names.
        if (eventSplitter.test(name)) {
            var names = name.split(eventSplitter);
            for (var i = 0, l = names.length; i < l; i++) {
                obj[action].apply(obj, [names[i]].concat(rest));
            }
            return false;
        }

        return true;
    };

    // A difficult-to-believe, but optimized internal dispatch function for
    // triggering events. Tries to keep the usual cases speedy (most internal
    // Backbone events have 3 arguments).
    var triggerEvents = function(events, args) {
        var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
        switch (args.length) {
            case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
            case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
            case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
            case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
            default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
        }
    };

    var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

    // Inversion-of-control versions of `on` and `once`. Tell *this* object to
    // listen to an event in another object ... keeping track of what it's
    // listening to.
    _.each(listenMethods, function(implementation, method) {
        Events[method] = function(obj, name, callback) {
            var listeners = this._listeners || (this._listeners = {});
            var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
            listeners[id] = obj;
            if (typeof name === 'object') callback = this;
            obj[implementation](name, callback, this);
            return this;
        };
    });

    // Aliases for backwards compatibility.
    Events.bind   = Events.on;
    Events.unbind = Events.off;

    // Allow the `Backbone` object to serve as a global event bus, for folks who
    // want global "pubsub" in a convenient place.
    _.extend(Backbone, Events);

    // Backbone.Model
    // --------------

    // Backbone **Models** are the basic data object in the framework --
    // frequently representing a row in a table in a database on your server.
    // A discrete chunk of data and a bunch of useful, related methods for
    // performing computations and transformations on that data.

    // Create a new model with the specified attributes. A client id (`cid`)
    // is automatically generated and assigned for you.
    var Model = Backbone.Model = function(attributes, options) {
        var defaults;
        var attrs = attributes || {};
        options || (options = {});
        this.cid = _.uniqueId('c');
        this.attributes = {};
        _.extend(this, _.pick(options, modelOptions));
        if (options.parse) attrs = this.parse(attrs, options) || {};
        if (defaults = _.result(this, 'defaults')) {
            attrs = _.defaults({}, attrs, defaults);
        }
        this.set(attrs, options);
        this.changed = {};
        this.initialize.apply(this, arguments);
    };

    // A list of options to be attached directly to the model, if provided.
    var modelOptions = ['url', 'urlRoot', 'collection'];

    // Attach all inheritable methods to the Model prototype.
    _.extend(Model.prototype, Events, {

        // A hash of attributes whose current and previous value differ.
        changed: null,

        // The value returned during the last failed validation.
        validationError: null,

        // The default name for the JSON `id` attribute is `"id"`. MongoDB and
        // CouchDB users may want to set this to `"_id"`.
        idAttribute: 'id',

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function(){},

        // Return a copy of the model's `attributes` object.
        toJSON: function(options) {
            return _.clone(this.attributes);
        },

        // Proxy `Backbone.sync` by default -- but override this if you need
        // custom syncing semantics for *this* particular model.
        sync: function() {
            return Backbone.sync.apply(this, arguments);
        },

        // Get the value of an attribute.
        get: function(attr) {
            return this.attributes[attr];
        },

        // Get the HTML-escaped value of an attribute.
        escape: function(attr) {
            return _.escape(this.get(attr));
        },

        // Returns `true` if the attribute contains a value that is not null
        // or undefined.
        has: function(attr) {
            return this.get(attr) != null;
        },

        // Set a hash of model attributes on the object, firing `"change"`. This is
        // the core primitive operation of a model, updating the data and notifying
        // anyone who needs to know about the change in state. The heart of the beast.
        set: function(key, val, options) {
            var attr, attrs, unset, changes, silent, changing, prev, current;
            if (key == null) return this;

            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            options || (options = {});

            // Run validation.
            if (!this._validate(attrs, options)) return false;

            // Extract attributes and options.
            unset           = options.unset;
            silent          = options.silent;
            changes         = [];
            changing        = this._changing;
            this._changing  = true;

            if (!changing) {
                this._previousAttributes = _.clone(this.attributes);
                this.changed = {};
            }
            current = this.attributes, prev = this._previousAttributes;

            // Check for changes of `id`.
            if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

            // For each `set` attribute, update or delete the current value.
            for (attr in attrs) {
                val = attrs[attr];
                if (!_.isEqual(current[attr], val)) changes.push(attr);
                if (!_.isEqual(prev[attr], val)) {
                    this.changed[attr] = val;
                } else {
                    delete this.changed[attr];
                }
                unset ? delete current[attr] : current[attr] = val;
            }

            // Trigger all relevant attribute changes.
            if (!silent) {
                if (changes.length) this._pending = true;
                for (var i = 0, l = changes.length; i < l; i++) {
                    this.trigger('change:' + changes[i], this, current[changes[i]], options);
                }
            }

            // You might be wondering why there's a `while` loop here. Changes can
            // be recursively nested within `"change"` events.
            if (changing) return this;
            if (!silent) {
                while (this._pending) {
                    this._pending = false;
                    this.trigger('change', this, options);
                }
            }
            this._pending = false;
            this._changing = false;
            return this;
        },

        // Remove an attribute from the model, firing `"change"`. `unset` is a noop
        // if the attribute doesn't exist.
        unset: function(attr, options) {
            return this.set(attr, void 0, _.extend({}, options, {unset: true}));
        },

        // Clear all attributes on the model, firing `"change"`.
        clear: function(options) {
            var attrs = {};
            for (var key in this.attributes) attrs[key] = void 0;
            return this.set(attrs, _.extend({}, options, {unset: true}));
        },

        // Determine if the model has changed since the last `"change"` event.
        // If you specify an attribute name, determine if that attribute has changed.
        hasChanged: function(attr) {
            if (attr == null) return !_.isEmpty(this.changed);
            return _.has(this.changed, attr);
        },

        // Return an object containing all the attributes that have changed, or
        // false if there are no changed attributes. Useful for determining what
        // parts of a view need to be updated and/or what attributes need to be
        // persisted to the server. Unset attributes will be set to undefined.
        // You can also pass an attributes object to diff against the model,
        // determining if there *would be* a change.
        changedAttributes: function(diff) {
            if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
            var val, changed = false;
            var old = this._changing ? this._previousAttributes : this.attributes;
            for (var attr in diff) {
                if (_.isEqual(old[attr], (val = diff[attr]))) continue;
                (changed || (changed = {}))[attr] = val;
            }
            return changed;
        },

        // Get the previous value of an attribute, recorded at the time the last
        // `"change"` event was fired.
        previous: function(attr) {
            if (attr == null || !this._previousAttributes) return null;
            return this._previousAttributes[attr];
        },

        // Get all of the attributes of the model at the time of the previous
        // `"change"` event.
        previousAttributes: function() {
            return _.clone(this._previousAttributes);
        },

        // Fetch the model from the server. If the server's representation of the
        // model differs from its current attributes, they will be overridden,
        // triggering a `"change"` event.
        fetch: function(options) {
            options = options ? _.clone(options) : {};
            if (options.parse === void 0) options.parse = true;
            var model = this;
            var success = options.success;
            options.success = function(resp) {
                if (!model.set(model.parse(resp, options), options)) return false;
                if (success) success(model, resp, options);
                model.trigger('sync', model, resp, options);
            };
            wrapError(this, options);
            return this.sync('read', this, options);
        },

        // Set a hash of model attributes, and sync the model to the server.
        // If the server returns an attributes hash that differs, the model's
        // state will be `set` again.
        save: function(key, val, options) {
            var attrs, method, xhr, attributes = this.attributes;

            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (key == null || typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            // If we're not waiting and attributes exist, save acts as `set(attr).save(null, opts)`.
            if (attrs && (!options || !options.wait) && !this.set(attrs, options)) return false;

            options = _.extend({validate: true}, options);

            // Do not persist invalid models.
            if (!this._validate(attrs, options)) return false;

            // Set temporary attributes if `{wait: true}`.
            if (attrs && options.wait) {
                this.attributes = _.extend({}, attributes, attrs);
            }

            // After a successful server-side save, the client is (optionally)
            // updated with the server-side state.
            if (options.parse === void 0) options.parse = true;
            var model = this;
            var success = options.success;
            options.success = function(resp) {
                // Ensure attributes are restored during synchronous saves.
                model.attributes = attributes;
                var serverAttrs = model.parse(resp, options);
                if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
                if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
                    return false;
                }
                if (success) success(model, resp, options);
                model.trigger('sync', model, resp, options);
            };
            wrapError(this, options);

            method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
            if (method === 'patch') options.attrs = attrs;
            xhr = this.sync(method, this, options);

            // Restore attributes.
            if (attrs && options.wait) this.attributes = attributes;

            return xhr;
        },

        // Destroy this model on the server if it was already persisted.
        // Optimistically removes the model from its collection, if it has one.
        // If `wait: true` is passed, waits for the server to respond before removal.
        destroy: function(options) {
            options = options ? _.clone(options) : {};
            var model = this;
            var success = options.success;

            var destroy = function() {
                model.trigger('destroy', model, model.collection, options);
            };

            options.success = function(resp) {
                if (options.wait || model.isNew()) destroy();
                if (success) success(model, resp, options);
                if (!model.isNew()) model.trigger('sync', model, resp, options);
            };

            if (this.isNew()) {
                options.success();
                return false;
            }
            wrapError(this, options);

            var xhr = this.sync('delete', this, options);
            if (!options.wait) destroy();
            return xhr;
        },

        // Default URL for the model's representation on the server -- if you're
        // using Backbone's restful methods, override this to change the endpoint
        // that will be called.
        url: function() {
            var base = _.result(this, 'urlRoot') || _.result(this.collection, 'url') || urlError();
            if (this.isNew()) return base;
            return base + (base.charAt(base.length - 1) === '/' ? '' : '/') + encodeURIComponent(this.id);
        },

        // **parse** converts a response into the hash of attributes to be `set` on
        // the model. The default implementation is just to pass the response along.
        parse: function(resp, options) {
            return resp;
        },

        // Create a new model with identical attributes to this one.
        clone: function() {
            return new this.constructor(this.attributes);
        },

        // A model is new if it has never been saved to the server, and lacks an id.
        isNew: function() {
            return this.id == null;
        },

        // Check if the model is currently in a valid state.
        isValid: function(options) {
            return this._validate({}, _.extend(options || {}, { validate: true }));
        },

        // Run validation against the next complete set of model attributes,
        // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
        _validate: function(attrs, options) {
            if (!options.validate || !this.validate) return true;
            attrs = _.extend({}, this.attributes, attrs);
            var error = this.validationError = this.validate(attrs, options) || null;
            if (!error) return true;
            this.trigger('invalid', this, error, _.extend(options || {}, {validationError: error}));
            return false;
        }

    });

    // Underscore methods that we want to implement on the Model.
    var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit'];

    // Mix in each Underscore method as a proxy to `Model#attributes`.
    _.each(modelMethods, function(method) {
        Model.prototype[method] = function() {
            var args = slice.call(arguments);
            args.unshift(this.attributes);
            return _[method].apply(_, args);
        };
    });

    // Backbone.Collection
    // -------------------

    // If models tend to represent a single row of data, a Backbone Collection is
    // more analagous to a table full of data ... or a small slice or page of that
    // table, or a collection of rows that belong together for a particular reason
    // -- all of the messages in this particular folder, all of the documents
    // belonging to this particular author, and so on. Collections maintain
    // indexes of their models, both in order, and for lookup by `id`.

    // Create a new **Collection**, perhaps to contain a specific type of `model`.
    // If a `comparator` is specified, the Collection will maintain
    // its models in sort order, as they're added and removed.
    var Collection = Backbone.Collection = function(models, options) {
        options || (options = {});
        if (options.url) this.url = options.url;
        if (options.model) this.model = options.model;
        if (options.comparator !== void 0) this.comparator = options.comparator;
        this._reset();
        this.initialize.apply(this, arguments);
        if (models) this.reset(models, _.extend({silent: true}, options));
    };

    // Default options for `Collection#set`.
    var setOptions = {add: true, remove: true, merge: true};
    var addOptions = {add: true, merge: false, remove: false};

    // Define the Collection's inheritable methods.
    _.extend(Collection.prototype, Events, {

        // The default model for a collection is just a **Backbone.Model**.
        // This should be overridden in most cases.
        model: Model,

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function(){},

        // The JSON representation of a Collection is an array of the
        // models' attributes.
        toJSON: function(options) {
            return this.map(function(model){ return model.toJSON(options); });
        },

        // Proxy `Backbone.sync` by default.
        sync: function() {
            return Backbone.sync.apply(this, arguments);
        },

        // Add a model, or list of models to the set.
        add: function(models, options) {
            return this.set(models, _.defaults(options || {}, addOptions));
        },

        // Remove a model, or a list of models from the set.
        remove: function(models, options) {
            models = _.isArray(models) ? models.slice() : [models];
            options || (options = {});
            var i, l, index, model;
            for (i = 0, l = models.length; i < l; i++) {
                model = this.get(models[i]);
                if (!model) continue;
                delete this._byId[model.id];
                delete this._byId[model.cid];
                index = this.indexOf(model);
                this.models.splice(index, 1);
                this.length--;
                if (!options.silent) {
                    options.index = index;
                    model.trigger('remove', model, this, options);
                }
                this._removeReference(model);
            }
            return this;
        },

        // Update a collection by `set`-ing a new list of models, adding new ones,
        // removing models that are no longer present, and merging models that
        // already exist in the collection, as necessary. Similar to **Model#set**,
        // the core operation for updating the data contained by the collection.
        set: function(models, options) {
            options = _.defaults(options || {}, setOptions);
            if (options.parse) models = this.parse(models, options);
            if (!_.isArray(models)) models = models ? [models] : [];
            var i, l, model, attrs, existing, sort;
            var at = options.at;
            var sortable = this.comparator && (at == null) && options.sort !== false;
            var sortAttr = _.isString(this.comparator) ? this.comparator : null;
            var toAdd = [], toRemove = [], modelMap = {};

            // Turn bare objects into model references, and prevent invalid models
            // from being added.
            for (i = 0, l = models.length; i < l; i++) {
                if (!(model = this._prepareModel(models[i], options))) continue;

                // If a duplicate is found, prevent it from being added and
                // optionally merge it into the existing model.
                if (existing = this.get(model)) {
                    if (options.remove) modelMap[existing.cid] = true;
                    if (options.merge) {
                        existing.set(model.attributes, options);
                        if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
                    }

                    // This is a new model, push it to the `toAdd` list.
                } else if (options.add) {
                    toAdd.push(model);

                    // Listen to added models' events, and index models for lookup by
                    // `id` and by `cid`.
                    model.on('all', this._onModelEvent, this);
                    this._byId[model.cid] = model;
                    if (model.id != null) this._byId[model.id] = model;
                }
            }

            // Remove nonexistent models if appropriate.
            if (options.remove) {
                for (i = 0, l = this.length; i < l; ++i) {
                    if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
                }
                if (toRemove.length) this.remove(toRemove, options);
            }

            // See if sorting is needed, update `length` and splice in new models.
            if (toAdd.length) {
                if (sortable) sort = true;
                this.length += toAdd.length;
                if (at != null) {
                    splice.apply(this.models, [at, 0].concat(toAdd));
                } else {
                    push.apply(this.models, toAdd);
                }
            }

            // Silently sort the collection if appropriate.
            if (sort) this.sort({silent: true});

            if (options.silent) return this;

            // Trigger `add` events.
            for (i = 0, l = toAdd.length; i < l; i++) {
                (model = toAdd[i]).trigger('add', model, this, options);
            }

            // Trigger `sort` if the collection was sorted.
            if (sort) this.trigger('sort', this, options);
            return this;
        },

        // When you have more items than you want to add or remove individually,
        // you can reset the entire set with a new list of models, without firing
        // any granular `add` or `remove` events. Fires `reset` when finished.
        // Useful for bulk operations and optimizations.
        reset: function(models, options) {
            options || (options = {});
            for (var i = 0, l = this.models.length; i < l; i++) {
                this._removeReference(this.models[i]);
            }
            options.previousModels = this.models;
            this._reset();
            this.add(models, _.extend({silent: true}, options));
            if (!options.silent) this.trigger('reset', this, options);
            return this;
        },

        // Add a model to the end of the collection.
        push: function(model, options) {
            model = this._prepareModel(model, options);
            this.add(model, _.extend({at: this.length}, options));
            return model;
        },

        // Remove a model from the end of the collection.
        pop: function(options) {
            var model = this.at(this.length - 1);
            this.remove(model, options);
            return model;
        },

        // Add a model to the beginning of the collection.
        unshift: function(model, options) {
            model = this._prepareModel(model, options);
            this.add(model, _.extend({at: 0}, options));
            return model;
        },

        // Remove a model from the beginning of the collection.
        shift: function(options) {
            var model = this.at(0);
            this.remove(model, options);
            return model;
        },

        // Slice out a sub-array of models from the collection.
        slice: function(begin, end) {
            return this.models.slice(begin, end);
        },

        // Get a model from the set by id.
        get: function(obj) {
            if (obj == null) return void 0;
            return this._byId[obj.id != null ? obj.id : obj.cid || obj];
        },

        // Get the model at the given index.
        at: function(index) {
            return this.models[index];
        },

        // Return models with matching attributes. Useful for simple cases of
        // `filter`.
        where: function(attrs, first) {
            if (_.isEmpty(attrs)) return first ? void 0 : [];
            return this[first ? 'find' : 'filter'](function(model) {
                for (var key in attrs) {
                    if (attrs[key] !== model.get(key)) return false;
                }
                return true;
            });
        },

        // Return the first model with matching attributes. Useful for simple cases
        // of `find`.
        findWhere: function(attrs) {
            return this.where(attrs, true);
        },

        // Force the collection to re-sort itself. You don't need to call this under
        // normal circumstances, as the set will maintain sort order as each item
        // is added.
        sort: function(options) {
            if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
            options || (options = {});

            // Run sort based on type of `comparator`.
            if (_.isString(this.comparator) || this.comparator.length === 1) {
                this.models = this.sortBy(this.comparator, this);
            } else {
                this.models.sort(_.bind(this.comparator, this));
            }

            if (!options.silent) this.trigger('sort', this, options);
            return this;
        },

        // Figure out the smallest index at which a model should be inserted so as
        // to maintain order.
        sortedIndex: function(model, value, context) {
            value || (value = this.comparator);
            var iterator = _.isFunction(value) ? value : function(model) {
                return model.get(value);
            };
            return _.sortedIndex(this.models, model, iterator, context);
        },

        // Pluck an attribute from each model in the collection.
        pluck: function(attr) {
            return _.invoke(this.models, 'get', attr);
        },

        // Fetch the default set of models for this collection, resetting the
        // collection when they arrive. If `reset: true` is passed, the response
        // data will be passed through the `reset` method instead of `set`.
        fetch: function(options) {
            options = options ? _.clone(options) : {};
            if (options.parse === void 0) options.parse = true;
            var success = options.success;
            var collection = this;
            options.success = function(resp) {
                var method = options.reset ? 'reset' : 'set';
                collection[method](resp, options);
                if (success) success(collection, resp, options);
                collection.trigger('sync', collection, resp, options);
            };
            wrapError(this, options);
            return this.sync('read', this, options);
        },

        // Create a new instance of a model in this collection. Add the model to the
        // collection immediately, unless `wait: true` is passed, in which case we
        // wait for the server to agree.
        create: function(model, options) {
            options = options ? _.clone(options) : {};
            if (!(model = this._prepareModel(model, options))) return false;
            if (!options.wait) this.add(model, options);
            var collection = this;
            var success = options.success;
            options.success = function(resp) {
                if (options.wait) collection.add(model, options);
                if (success) success(model, resp, options);
            };
            model.save(null, options);
            return model;
        },

        // **parse** converts a response into a list of models to be added to the
        // collection. The default implementation is just to pass it through.
        parse: function(resp, options) {
            return resp;
        },

        // Create a new collection with an identical list of models as this one.
        clone: function() {
            return new this.constructor(this.models);
        },

        // Private method to reset all internal state. Called when the collection
        // is first initialized or reset.
        _reset: function() {
            this.length = 0;
            this.models = [];
            this._byId  = {};
        },

        // Prepare a hash of attributes (or other model) to be added to this
        // collection.
        _prepareModel: function(attrs, options) {
            if (attrs instanceof Model) {
                if (!attrs.collection) attrs.collection = this;
                return attrs;
            }
            options || (options = {});
            options.collection = this;
            var model = new this.model(attrs, options);
            if (!model._validate(attrs, options)) {
                this.trigger('invalid', this, attrs, options);
                return false;
            }
            return model;
        },

        // Internal method to sever a model's ties to a collection.
        _removeReference: function(model) {
            if (this === model.collection) delete model.collection;
            model.off('all', this._onModelEvent, this);
        },

        // Internal method called every time a model in the set fires an event.
        // Sets need to update their indexes when models change ids. All other
        // events simply proxy through. "add" and "remove" events that originate
        // in other collections are ignored.
        _onModelEvent: function(event, model, collection, options) {
            if ((event === 'add' || event === 'remove') && collection !== this) return;
            if (event === 'destroy') this.remove(model, options);
            if (model && event === 'change:' + model.idAttribute) {
                delete this._byId[model.previous(model.idAttribute)];
                if (model.id != null) this._byId[model.id] = model;
            }
            this.trigger.apply(this, arguments);
        }

    });

    // Underscore methods that we want to implement on the Collection.
    // 90% of the core usefulness of Backbone Collections is actually implemented
    // right here:
    var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
        'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
        'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
        'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
        'tail', 'drop', 'last', 'without', 'indexOf', 'shuffle', 'lastIndexOf',
        'isEmpty', 'chain'];

    // Mix in each Underscore method as a proxy to `Collection#models`.
    _.each(methods, function(method) {
        Collection.prototype[method] = function() {
            var args = slice.call(arguments);
            args.unshift(this.models);
            return _[method].apply(_, args);
        };
    });

    // Underscore methods that take a property name as an argument.
    var attributeMethods = ['groupBy', 'countBy', 'sortBy'];

    // Use attributes instead of properties.
    _.each(attributeMethods, function(method) {
        Collection.prototype[method] = function(value, context) {
            var iterator = _.isFunction(value) ? value : function(model) {
                return model.get(value);
            };
            return _[method](this.models, iterator, context);
        };
    });

    // Backbone.View
    // -------------

    // Backbone Views are almost more convention than they are actual code. A View
    // is simply a JavaScript object that represents a logical chunk of UI in the
    // DOM. This might be a single item, an entire list, a sidebar or panel, or
    // even the surrounding frame which wraps your whole app. Defining a chunk of
    // UI as a **View** allows you to define your DOM events declaratively, without
    // having to worry about render order ... and makes it easy for the view to
    // react to specific changes in the state of your models.

    // Creating a Backbone.View creates its initial element outside of the DOM,
    // if an existing element is not provided...
    var View = Backbone.View = function(options) {
        this.cid = _.uniqueId('view');
        this._configure(options || {});
        this._ensureElement();
        this.initialize.apply(this, arguments);
        this.delegateEvents();
    };

    // Cached regex to split keys for `delegate`.
    var delegateEventSplitter = /^(\S+)\s*(.*)$/;

    // List of view options to be merged as properties.
    var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

    // Set up all inheritable **Backbone.View** properties and methods.
    _.extend(View.prototype, Events, {

        // The default `tagName` of a View's element is `"div"`.
        tagName: 'div',

        // jQuery delegate for element lookup, scoped to DOM elements within the
        // current view. This should be prefered to global lookups where possible.
        $: function(selector) {
            return this.$el.find(selector);
        },

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function(){},

        // **render** is the core function that your view should override, in order
        // to populate its element (`this.el`), with the appropriate HTML. The
        // convention is for **render** to always return `this`.
        render: function() {
            return this;
        },

        // Remove this view by taking the element out of the DOM, and removing any
        // applicable Backbone.Events listeners.
        remove: function() {
            this.$el.remove();
            this.stopListening();
            return this;
        },

        // Change the view's element (`this.el` property), including event
        // re-delegation.
        setElement: function(element, delegate) {
            if (this.$el) this.undelegateEvents();
            this.$el = element instanceof Backbone.$ ? element : Backbone.$(element);
            this.el = this.$el[0];
            if (delegate !== false) this.delegateEvents();
            return this;
        },

        // Set callbacks, where `this.events` is a hash of
        //
        // *{"event selector": "callback"}*
        //
        //     {
        //       'mousedown .title':  'edit',
        //       'click .button':     'save'
        //       'click .open':       function(e) { ... }
        //     }
        //
        // pairs. Callbacks will be bound to the view, with `this` set properly.
        // Uses event delegation for efficiency.
        // Omitting the selector binds the event to `this.el`.
        // This only works for delegate-able events: not `focus`, `blur`, and
        // not `change`, `submit`, and `reset` in Internet Explorer.
        delegateEvents: function(events) {
            if (!(events || (events = _.result(this, 'events')))) return this;
            this.undelegateEvents();
            for (var key in events) {
                var method = events[key];
                if (!_.isFunction(method)) method = this[events[key]];
                if (!method) continue;

                var match = key.match(delegateEventSplitter);
                var eventName = match[1], selector = match[2];
                method = _.bind(method, this);
                eventName += '.delegateEvents' + this.cid;
                if (selector === '') {
                    this.$el.on(eventName, method);
                } else {
                    this.$el.on(eventName, selector, method);
                }
            }
            return this;
        },

        // Clears all callbacks previously bound to the view with `delegateEvents`.
        // You usually don't need to use this, but may wish to if you have multiple
        // Backbone views attached to the same DOM element.
        undelegateEvents: function() {
            this.$el.off('.delegateEvents' + this.cid);
            return this;
        },

        // Performs the initial configuration of a View with a set of options.
        // Keys with special meaning *(e.g. model, collection, id, className)* are
        // attached directly to the view.  See `viewOptions` for an exhaustive
        // list.
        _configure: function(options) {
            if (this.options) options = _.extend({}, _.result(this, 'options'), options);
            _.extend(this, _.pick(options, viewOptions));
            this.options = options;
        },

        // Ensure that the View has a DOM element to render into.
        // If `this.el` is a string, pass it through `$()`, take the first
        // matching element, and re-assign it to `el`. Otherwise, create
        // an element from the `id`, `className` and `tagName` properties.
        _ensureElement: function() {
            if (!this.el) {
                var attrs = _.extend({}, _.result(this, 'attributes'));
                if (this.id) attrs.id = _.result(this, 'id');
                if (this.className) attrs['class'] = _.result(this, 'className');
                var $el = Backbone.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
                this.setElement($el, false);
            } else {
                this.setElement(_.result(this, 'el'), false);
            }
        }

    });

    // Backbone.sync
    // -------------

    // Override this function to change the manner in which Backbone persists
    // models to the server. You will be passed the type of request, and the
    // model in question. By default, makes a RESTful Ajax request
    // to the model's `url()`. Some possible customizations could be:
    //
    // * Use `setTimeout` to batch rapid-fire updates into a single request.
    // * Send up the models as XML instead of JSON.
    // * Persist models via WebSockets instead of Ajax.
    //
    // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
    // as `POST`, with a `_method` parameter containing the true HTTP method,
    // as well as all requests with the body as `application/x-www-form-urlencoded`
    // instead of `application/json` with the model in a param named `model`.
    // Useful when interfacing with server-side languages like **PHP** that make
    // it difficult to read the body of `PUT` requests.
    Backbone.sync = function(method, model, options) {
        var type = methodMap[method];

        // Default options, unless specified.
        _.defaults(options || (options = {}), {
            emulateHTTP: Backbone.emulateHTTP,
            emulateJSON: Backbone.emulateJSON
        });

        // Default JSON-request options.
        var params = {type: type, dataType: 'json'};

        // Ensure that we have a URL.
        if (!options.url) {
            params.url = _.result(model, 'url') || urlError();
        }

        // Ensure that we have the appropriate request data.
        if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
            params.contentType = 'application/json';
            params.data = JSON.stringify(options.attrs || model.toJSON(options));
        }

        // For older servers, emulate JSON by encoding the request into an HTML-form.
        if (options.emulateJSON) {
            params.contentType = 'application/x-www-form-urlencoded';
            params.data = params.data ? {model: params.data} : {};
        }

        // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
        // And an `X-HTTP-Method-Override` header.
        if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
            params.type = 'POST';
            if (options.emulateJSON) params.data._method = type;
            var beforeSend = options.beforeSend;
            options.beforeSend = function(xhr) {
                xhr.setRequestHeader('X-HTTP-Method-Override', type);
                if (beforeSend) return beforeSend.apply(this, arguments);
            };
        }

        // Don't process data on a non-GET request.
        if (params.type !== 'GET' && !options.emulateJSON) {
            params.processData = false;
        }

        // If we're sending a `PATCH` request, and we're in an old Internet Explorer
        // that still has ActiveX enabled by default, override jQuery to use that
        // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
        if (params.type === 'PATCH' && window.ActiveXObject &&
            !(window.external && window.external.msActiveXFilteringEnabled)) {
            params.xhr = function() {
                return new ActiveXObject("Microsoft.XMLHTTP");
            };
        }

        // Make the request, allowing the user to override any Ajax options.
        var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
        model.trigger('request', model, xhr, options);
        return xhr;
    };

    // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch':  'PATCH',
        'delete': 'DELETE',
        'read':   'GET'
    };

    // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
    // Override this if you'd like to use a different library.
    Backbone.ajax = function() {
        return Backbone.$.ajax.apply(Backbone.$, arguments);
    };

    // Backbone.Router
    // ---------------

    // Routers map faux-URLs to actions, and fire events when routes are
    // matched. Creating a new one sets its `routes` hash, if not set statically.
    var Router = Backbone.Router = function(options) {
        options || (options = {});
        if (options.routes) this.routes = options.routes;
        this._bindRoutes();
        this.initialize.apply(this, arguments);
    };

    // Cached regular expressions for matching named param parts and splatted
    // parts of route strings.
    var optionalParam = /\((.*?)\)/g;
    var namedParam    = /(\(\?)?:\w+/g;
    var splatParam    = /\*\w+/g;
    var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

    // Set up all inheritable **Backbone.Router** properties and methods.
    _.extend(Router.prototype, Events, {

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function(){},

        // Manually bind a single named route to a callback. For example:
        //
        //     this.route('search/:query/p:num', 'search', function(query, num) {
        //       ...
        //     });
        //
        route: function(route, name, callback) {
            if (!_.isRegExp(route)) route = this._routeToRegExp(route);
            if (_.isFunction(name)) {
                callback = name;
                name = '';
            }
            if (!callback) callback = this[name];
            var router = this;
            Backbone.history.route(route, function(fragment) {
                var args = router._extractParameters(route, fragment);
                callback && callback.apply(router, args);
                router.trigger.apply(router, ['route:' + name].concat(args));
                router.trigger('route', name, args);
                Backbone.history.trigger('route', router, name, args);
            });
            return this;
        },

        // Simple proxy to `Backbone.history` to save a fragment into the history.
        navigate: function(fragment, options) {
            Backbone.history.navigate(fragment, options);
            return this;
        },

        // Bind all defined routes to `Backbone.history`. We have to reverse the
        // order of the routes here to support behavior where the most general
        // routes can be defined at the bottom of the route map.
        _bindRoutes: function() {
            if (!this.routes) return;
            this.routes = _.result(this, 'routes');
            var route, routes = _.keys(this.routes);
            while ((route = routes.pop()) != null) {
                this.route(route, this.routes[route]);
            }
        },

        // Convert a route string into a regular expression, suitable for matching
        // against the current location hash.
        _routeToRegExp: function(route) {
            route = route.replace(escapeRegExp, '\\$&')
                .replace(optionalParam, '(?:$1)?')
                .replace(namedParam, function(match, optional){
                    return optional ? match : '([^\/]+)';
                })
                .replace(splatParam, '(.*?)');
            return new RegExp('^' + route + '$');
        },

        // Given a route, and a URL fragment that it matches, return the array of
        // extracted decoded parameters. Empty or unmatched parameters will be
        // treated as `null` to normalize cross-browser behavior.
        _extractParameters: function(route, fragment) {
            var params = route.exec(fragment).slice(1);
            return _.map(params, function(param) {
                return param ? decodeURIComponent(param) : null;
            });
        }

    });

    // Backbone.History
    // ----------------

    // Handles cross-browser history management, based on either
    // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
    // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
    // and URL fragments. If the browser supports neither (old IE, natch),
    // falls back to polling.
    var History = Backbone.History = function() {
        this.handlers = [];
        _.bindAll(this, 'checkUrl');

        // Ensure that `History` can be used outside of the browser.
        if (typeof window !== 'undefined') {
            this.location = window.location;
            this.history = window.history;
        }
    };

    // Cached regex for stripping a leading hash/slash and trailing space.
    var routeStripper = /^[#\/]|\s+$/g;

    // Cached regex for stripping leading and trailing slashes.
    var rootStripper = /^\/+|\/+$/g;

    // Cached regex for detecting MSIE.
    var isExplorer = /msie [\w.]+/;

    // Cached regex for removing a trailing slash.
    var trailingSlash = /\/$/;

    // Has the history handling already been started?
    History.started = false;

    // Set up all inheritable **Backbone.History** properties and methods.
    _.extend(History.prototype, Events, {

        // The default interval to poll for hash changes, if necessary, is
        // twenty times a second.
        interval: 50,

        // Gets the true hash value. Cannot use location.hash directly due to bug
        // in Firefox where location.hash will always be decoded.
        getHash: function(window) {
            var match = (window || this).location.href.match(/#(.*)$/);
            return match ? match[1] : '';
        },

        // Get the cross-browser normalized URL fragment, either from the URL,
        // the hash, or the override.
        getFragment: function(fragment, forcePushState) {
            if (fragment == null) {
                if (this._hasPushState || !this._wantsHashChange || forcePushState) {
                    fragment = this.location.pathname;
                    var root = this.root.replace(trailingSlash, '');
                    if (!fragment.indexOf(root)) fragment = fragment.substr(root.length);
                } else {
                    fragment = this.getHash();
                }
            }
            return fragment.replace(routeStripper, '');
        },

        // Start the hash change handling, returning `true` if the current URL matches
        // an existing route, and `false` otherwise.
        start: function(options) {
            if (History.started) throw new Error("Backbone.history has already been started");
            History.started = true;

            // Figure out the initial configuration. Do we need an iframe?
            // Is pushState desired ... is it available?
            this.options          = _.extend({}, {root: '/'}, this.options, options);
            this.root             = this.options.root;
            this._wantsHashChange = this.options.hashChange !== false;
            this._wantsPushState  = !!this.options.pushState;
            this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
            var fragment          = this.getFragment();
            var docMode           = document.documentMode;
            var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

            // Normalize root to always include a leading and trailing slash.
            this.root = ('/' + this.root + '/').replace(rootStripper, '/');

            if (oldIE && this._wantsHashChange) {
                this.iframe = Backbone.$('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo('body')[0].contentWindow;
                this.navigate(fragment);
            }

            // Depending on whether we're using pushState or hashes, and whether
            // 'onhashchange' is supported, determine how we check the URL state.
            if (this._hasPushState) {
                Backbone.$(window).on('popstate', this.checkUrl);
            } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
                Backbone.$(window).on('hashchange', this.checkUrl);
            } else if (this._wantsHashChange) {
                this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
            }

            // Determine if we need to change the base url, for a pushState link
            // opened by a non-pushState browser.
            this.fragment = fragment;
            var loc = this.location;
            var atRoot = loc.pathname.replace(/[^\/]$/, '$&/') === this.root;

            // If we've started off with a route from a `pushState`-enabled browser,
            // but we're currently in a browser that doesn't support it...
            if (this._wantsHashChange && this._wantsPushState && !this._hasPushState && !atRoot) {
                this.fragment = this.getFragment(null, true);
                this.location.replace(this.root + this.location.search + '#' + this.fragment);
                // Return immediately as browser will do redirect to new url
                return true;

                // Or if we've started out with a hash-based route, but we're currently
                // in a browser where it could be `pushState`-based instead...
            } else if (this._wantsPushState && this._hasPushState && atRoot && loc.hash) {
                this.fragment = this.getHash().replace(routeStripper, '');
                this.history.replaceState({}, document.title, this.root + this.fragment + loc.search);
            }

            if (!this.options.silent) return this.loadUrl();
        },

        // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
        // but possibly useful for unit testing Routers.
        stop: function() {
            Backbone.$(window).off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
            clearInterval(this._checkUrlInterval);
            History.started = false;
        },

        // Add a route to be tested when the fragment changes. Routes added later
        // may override previous routes.
        route: function(route, callback) {
            this.handlers.unshift({route: route, callback: callback});
        },

        // Checks the current URL to see if it has changed, and if it has,
        // calls `loadUrl`, normalizing across the hidden iframe.
        checkUrl: function(e) {
            var current = this.getFragment();
            if (current === this.fragment && this.iframe) {
                current = this.getFragment(this.getHash(this.iframe));
            }
            if (current === this.fragment) return false;
            if (this.iframe) this.navigate(current);
            this.loadUrl() || this.loadUrl(this.getHash());
        },

        // Attempt to load the current URL fragment. If a route succeeds with a
        // match, returns `true`. If no defined routes matches the fragment,
        // returns `false`.
        loadUrl: function(fragmentOverride) {
            var fragment = this.fragment = this.getFragment(fragmentOverride);
            var matched = _.any(this.handlers, function(handler) {
                if (handler.route.test(fragment)) {
                    handler.callback(fragment);
                    return true;
                }
            });
            return matched;
        },

        // Save a fragment into the hash history, or replace the URL state if the
        // 'replace' option is passed. You are responsible for properly URL-encoding
        // the fragment in advance.
        //
        // The options object can contain `trigger: true` if you wish to have the
        // route callback be fired (not usually desirable), or `replace: true`, if
        // you wish to modify the current URL without adding an entry to the history.
        navigate: function(fragment, options) {
            if (!History.started) return false;
            if (!options || options === true) options = {trigger: options};
            fragment = this.getFragment(fragment || '');
            if (this.fragment === fragment) return;
            this.fragment = fragment;
            var url = this.root + fragment;

            // If pushState is available, we use it to set the fragment as a real URL.
            if (this._hasPushState) {
                this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

                // If hash changes haven't been explicitly disabled, update the hash
                // fragment to store history.
            } else if (this._wantsHashChange) {
                this._updateHash(this.location, fragment, options.replace);
                if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
                    // Opening and closing the iframe tricks IE7 and earlier to push a
                    // history entry on hash-tag change.  When replace is true, we don't
                    // want this.
                    if(!options.replace) this.iframe.document.open().close();
                    this._updateHash(this.iframe.location, fragment, options.replace);
                }

                // If you've told us that you explicitly don't want fallback hashchange-
                // based history, then `navigate` becomes a page refresh.
            } else {
                return this.location.assign(url);
            }
            if (options.trigger) this.loadUrl(fragment);
        },

        // Update the hash location, either replacing the current entry, or adding
        // a new one to the browser history.
        _updateHash: function(location, fragment, replace) {
            if (replace) {
                var href = location.href.replace(/(javascript:|#).*$/, '');
                location.replace(href + '#' + fragment);
            } else {
                // Some browsers require that `hash` contains a leading #.
                location.hash = '#' + fragment;
            }
        }

    });

    // Create the default Backbone.history.
    Backbone.history = new History;

    // Helpers
    // -------

    // Helper function to correctly set up the prototype chain, for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    var extend = function(protoProps, staticProps) {
        var parent = this;
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && _.has(protoProps, 'constructor')) {
            child = protoProps.constructor;
        } else {
            child = function(){ return parent.apply(this, arguments); };
        }

        // Add static properties to the constructor function, if supplied.
        _.extend(child, parent, staticProps);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        var Surrogate = function(){ this.constructor = child; };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate;

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) _.extend(child.prototype, protoProps);

        // Set a convenience property in case the parent's prototype is needed
        // later.
        child.__super__ = parent.prototype;

        return child;
    };

    // Set up inheritance for the model, collection, router, view and history.
    Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

    // Throw an error when a URL is needed, and none is supplied.
    var urlError = function() {
        throw new Error('A "url" property or function must be specified');
    };

    // Wrap an optional error callback with a fallback error event.
    var wrapError = function (model, options) {
        var error = options.error;
        options.error = function(resp) {
            if (error) error(model, resp, options);
            model.trigger('error', model, resp, options);
        };
    };

}).call(this);
define("backbone", ["underscore","jquery"], (function (global) {
    return function () {
        var ret, fn;
        return ret || global.Backbone;
    };
}(this)));

/**
 * @license RequireJS text 2.0.6 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require, XMLHttpRequest, ActiveXObject,
 define, window, process, Packages,
 java, location, Components, FileUtils */

define('text',['module'], function (module) {
    

    var text, fs, Cc, Ci,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = [],
        masterConfig = (module.config && module.config()) || {};

    text = {
        version: '2.0.6',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var modName, ext, temp,
                strip = false,
                index = name.indexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                    name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1)) {
                modName = name.substring(0, index);
                ext = name.substring(index + 1, name.length);
            } else {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext) {
                    ext = temp;
                } else {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                    (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                    text.useXhr;

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                        parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                    "define(function () { return '" +
                        content +
                        "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
            //Use a '.js' file name so that it indicates it is a
            //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
        typeof process !== "undefined" &&
        process.versions &&
        !!process.versions.node)) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback) {
            var file = fs.readFileSync(url, 'utf8');
            //Remove BOM (Byte Mark Order) from utf8 files if it is there.
            if (file.indexOf('\uFEFF') === 0) {
                file = file.substring(1);
            }
            callback(file);
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
        text.createXhr())) {
        text.get = function (url, callback, errback, headers) {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        errback(err);
                    } else {
                        callback(xhr.responseText);
                    }

                    if (masterConfig.onXhrComplete) {
                        masterConfig.onXhrComplete(xhr, url);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
        typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                stringBuffer.append(line);

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    } else if (masterConfig.env === 'xpconnect' || (!masterConfig.env &&
        typeof Components !== 'undefined' && Components.classes &&
        Components.interfaces)) {
        //Avert your gaze!
        Cc = Components.classes,
            Ci = Components.interfaces;
        Components.utils['import']('resource://gre/modules/FileUtils.jsm');

        text.get = function (url, callback) {
            var inStream, convertStream,
                readData = {},
                fileObj = new FileUtils.File(url);

            //XPCOM, you so crazy
            try {
                inStream = Cc['@mozilla.org/network/file-input-stream;1']
                    .createInstance(Ci.nsIFileInputStream);
                inStream.init(fileObj, 1, 0, false);

                convertStream = Cc['@mozilla.org/intl/converter-input-stream;1']
                    .createInstance(Ci.nsIConverterInputStream);
                convertStream.init(inStream, "utf-8", inStream.available(),
                    Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

                convertStream.readString(inStream.available(), readData);
                convertStream.close();
                inStream.close();
                callback(readData.value);
            } catch (e) {
                throw new Error((fileObj && fileObj.path || '') + ': ' + e);
            }
        };
    }
    return text;
});
define('text!template/donationModule.html',[],function () { return '<section class="<%= data.donationModule.orientation %> <%= data.donationModule.color %> <%= data.donationModule.dimensions %> <%= data.donationModule.tooltipStyle %> <% if (data.donationModule.active === true) { print(\'active\'); } %>" id="elefunds-module">\n    <div class="section-top">\n        <h1 class="region-logo">\n            <a href="http://www.elefunds.de">\n                <svg id="elefundsLogo" viewBox="0 0 407 84" version="1.1"\n                    xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"\n                    x="0px" y="0px" width="407px" height="84px">\n                    <g id="logoLayer">\n                        <path class="elephantIcon" d="M 0 82.9063 L 9.9961 83.2443 L 13.6443 77.7535 L 16.214 77.6728 L 24.9819 63.3615 L 35.1597 72.1091 L 38.3468 82.3896 L 46.1944 82.376 L 46.8734 76.5228 L 48.9711 76.245 L 50.3321 49.2482 L 66.3214 38.7624 L 73.5006 26.8895 L 76.1416 0 L 71.0248 0.947 L 62.1748 25.4859 L 50.5266 19.7129 L 26.4054 22.959 L 23.1412 33.4551 L 9.5418 40.7934 L 3.3376 51.6338 L 2.8823 61.4771 L 0 82.9063 Z" fill="#2f2728"/>\n                        <g>\n                            <path class="logoText" d="M 98.4757 38.8498 C 110.8919 38.8498 117.696 47.8961 117.696 59.3111 C 117.696 60.5796 117.441 63.2847 117.441 63.2847 L 87.5045 63.2847 C 88.3546 70.895 93.9676 74.8677 100.5167 74.8677 C 107.4908 74.8677 112.6779 70.049 112.6779 70.049 L 117.186 77.4893 C 117.186 77.4893 110.5519 84 99.7507 84 C 85.3775 84 76.4484 73.6846 76.4484 61.4246 C 76.4484 48.1506 85.4625 38.8498 98.4757 38.8498 ZM 106.6398 55.8444 C 106.4698 50.6867 102.8978 47.1356 98.4757 47.1356 C 92.9476 47.1356 89.0346 50.4332 87.8445 55.8444 L 106.6398 55.8444 Z" fill="#2f2728"/>\n                            <path class="logoText" d="M 124.4962 33.9461 C 124.4962 32.6775 123.8152 32.086 122.6252 32.086 L 119.2231 32.086 L 119.2231 22.9542 L 129.5143 22.9542 C 133.5113 22.9542 135.2973 24.7297 135.2973 28.7039 L 135.2973 72.078 C 135.2973 73.2611 135.9774 73.9381 137.1684 73.9381 L 140.4854 73.9381 L 140.4854 82.985 L 130.2793 82.985 C 126.1972 82.985 124.4962 81.2939 124.4962 77.2357 L 124.4962 33.9461 Z" fill="#2f2728"/>\n                            <path class="logoText" d="M 165.0609 38.8498 C 177.4771 38.8498 184.2812 47.8961 184.2812 59.3111 C 184.2812 60.5796 184.0262 63.2847 184.0262 63.2847 L 154.0897 63.2847 C 154.9397 70.895 160.5528 74.8677 167.1019 74.8677 C 174.076 74.8677 179.2631 70.049 179.2631 70.049 L 183.7711 77.4893 C 183.7711 77.4893 177.1371 84 166.3359 84 C 151.9627 84 143.0335 73.6846 143.0335 61.4246 C 143.0335 48.1506 152.0477 38.8498 165.0609 38.8498 ZM 173.225 55.8444 C 173.055 50.6867 169.4829 47.1356 165.0609 47.1356 C 159.5328 47.1356 155.6198 50.4332 154.4297 55.8444 L 173.225 55.8444 Z" fill="#2f2728"/>\n                            <path class="logoText" d="M 192.6124 48.4041 L 187.2543 48.4041 L 187.2543 39.8643 L 192.6124 39.8643 L 192.6124 38.5963 C 192.6124 24.4762 204.2635 22.6161 210.3026 22.6161 C 212.5137 22.6161 213.9597 22.8697 213.9597 22.8697 L 213.9597 32.001 C 213.9597 32.001 213.0237 31.832 211.7477 31.832 C 208.6866 31.832 203.4135 32.593 203.4135 38.8498 L 203.4135 39.8643 L 212.6837 39.8643 L 212.6837 48.4041 L 203.4135 48.4041 L 203.4135 82.985 L 192.6124 82.985 L 192.6124 48.4041 Z" fill="#2f2728"/>\n                            <path class="logoText" d="M 221.7799 50.8557 C 221.7799 49.5882 221.0989 48.9957 219.9089 48.9957 L 216.5068 48.9957 L 216.5068 39.8643 L 226.798 39.8643 C 230.795 39.8643 232.4961 41.6399 232.4961 45.529 L 232.4961 65.3983 C 232.4961 70.6405 233.8561 74.1916 239.2142 74.1916 C 247.0393 74.1916 251.3763 67.3438 251.3763 59.6491 L 251.3763 39.8643 L 262.1775 39.8643 L 262.1775 72.078 C 262.1775 73.2611 262.8575 73.9381 264.0485 73.9381 L 267.4506 73.9381 L 267.4506 82.985 L 257.4995 82.985 C 253.7574 82.985 251.8014 81.2094 251.8014 78.1663 L 251.8014 76.9813 C 251.8014 75.9672 251.8864 75.0367 251.8864 75.0367 L 251.7164 75.0367 C 249.6753 79.5183 244.2322 84 236.7481 84 C 227.478 84 221.7799 79.3493 221.7799 67.5964 L 221.7799 50.8557 Z" fill="#2f2728"/>\n                            <path class="logoText" d="M 273.4838 50.8557 C 273.4838 49.5882 272.8038 48.9957 271.6128 48.9957 L 268.2107 48.9957 L 268.2107 39.8643 L 278.1609 39.8643 C 281.9889 39.8643 283.86 41.6399 283.86 44.684 L 283.86 45.9516 C 283.86 46.8821 283.6899 47.8126 283.6899 47.8126 L 283.86 47.8126 C 285.731 44.176 290.4081 38.8498 299.1682 38.8498 C 308.7783 38.8498 314.3064 43.838 314.3064 55.2529 L 314.3064 72.078 C 314.3064 73.2611 314.9874 73.9381 316.1774 73.9381 L 319.5795 73.9381 L 319.5795 82.985 L 309.2893 82.985 C 305.2063 82.985 303.5052 81.2939 303.5052 77.2357 L 303.5052 57.451 C 303.5052 52.2088 302.1452 48.6576 296.7021 48.6576 C 290.9181 48.6576 286.581 52.2933 285.05 57.451 C 284.455 59.2266 284.2 61.1711 284.2 63.2002 L 284.2 82.985 L 273.4838 82.985 L 273.4838 50.8557 Z" fill="#2f2728"/>\n                            <path class="logoText" d="M 341.4319 38.8498 C 350.873 38.8498 353.9341 44.0925 353.9341 44.0925 L 354.1041 44.0925 C 354.1041 44.0925 354.0191 42.9929 354.0191 41.5554 L 354.0191 33.9461 C 354.0191 32.6775 353.3391 32.086 352.1481 32.086 L 348.746 32.086 L 348.746 22.9542 L 359.0372 22.9542 C 363.0342 22.9542 364.8203 24.7297 364.8203 28.7039 L 364.8203 72.078 C 364.8203 73.2611 365.5013 73.9381 366.6913 73.9381 L 370.0084 73.9381 L 370.0084 82.985 L 360.0582 82.985 C 356.1451 82.985 354.7001 81.1249 354.7001 78.5878 C 354.7001 77.6583 354.7001 76.9813 354.7001 76.9813 L 354.5301 76.9813 C 354.5301 76.9813 350.9581 84 341.0069 84 C 329.2707 84 321.7007 74.7841 321.7007 61.4246 C 321.7007 47.7271 329.9507 38.8498 341.4319 38.8498 ZM 354.2741 61.3401 C 354.2741 54.6604 350.7881 48.0651 343.559 48.0651 C 337.6049 48.0651 332.6728 52.8848 332.6728 61.4246 C 332.6728 69.6264 337.0099 74.9531 343.388 74.9531 C 349.002 74.9531 354.2741 70.895 354.2741 61.3401 Z" fill="#2f2728"/>\n                            <path class="logoText" d="M 377.4036 69.2884 C 377.4036 69.2884 382.9316 75.6292 390.3307 75.6292 C 393.6478 75.6292 396.1989 74.2761 396.1989 71.402 C 396.1989 65.3138 373.3215 65.3983 373.3215 51.4473 C 373.3215 42.8234 381.1456 38.8498 390.1607 38.8498 C 396.0288 38.8498 405.384 40.7944 405.384 47.8126 L 405.384 52.2933 L 395.8588 52.2933 L 395.8588 50.1797 C 395.8588 48.1506 392.7968 47.1356 390.4157 47.1356 C 386.5887 47.1356 383.9526 48.4886 383.9526 51.0257 C 383.9526 57.789 407 56.436 407 70.8095 C 407 78.9268 399.7709 84 390.3307 84 C 378.4246 84 372.3005 76.3052 372.3005 76.3052 L 377.4036 69.2884 Z" fill="#2f2728"/>\n                        </g>\n                    </g>\n                </svg>\n            </a>\n            <div class="elefunds-tooltip">\n                <h2>\n                    <%= data.translations.tooltipTitle %>\n                </h2>\n                <p>\n                    <%= data.translations.tooltipDescription %>\n                </p>\n            </div>\n        </h1>\n        <div class="region-activate-module">\n            <div class="region-check">\n                <div class="checkbox-wrapper">\n                    <div class="checkmark checkmark-white checkmark-large"></div>\n                    <input type="checkbox" name="donate-active" id="donate-active" />\n                </div>\n            </div>\n            <div class="region-checklabel">\n                <label for="donate-active"><%= data.donationModule.activateText %></label>\n            </div>\n        </div>\n        <div class="region-donation-value">\n            <div class="region-buttons">\n                <div class="button-decrease">\n                -\n                </div>\n                <div class="button-increase">\n                +\n                </div>\n            </div>\n            <div class="region-input">\n                <div class="donation-currency">\n                    <%= data.donation.currency %>\n                </div>\n                <input class="donation-input-full" type="text" value="<%= data.donation.donationAmountAbsolute %>" maxlength="4" />\n                <div class="currency-delimiter"><%= data.donation.currencyDelimiter %></div>\n                <input class="donation-input-small" type="text" value="<%= data.donation.donationAmountAfterComma %>" maxlength="2">\n            </div>\n        </div>\n    </div>\n\n    <div class="section-middle">\n        <ul>\n            <% if (data.receivers.length === 0) { %>\n                <li class="loading-indicator">\n                    <div class="jumpingBall">\n                        <div class="wBall" id="wBall_1">\n                            <div class="wInnerBall">\n                            </div>\n                        </div>\n                        <div class="wBall" id="wBall_2">\n                            <div class="wInnerBall">\n                            </div>\n                        </div>\n                        <div class="wBall" id="wBall_3">\n                            <div class="wInnerBall">\n                            </div>\n                        </div>\n                        <div class="wBall" id="wBall_4">\n                            <div class="wInnerBall">\n                            </div>\n                        </div>\n                        <div class="wBall" id="wBall_5">\n                            <div class="wInnerBall">\n                            </div>\n                        </div>\n                    </div>\n                </li>\n            <% } %>\n            <% _.each(data.receivers, function (receiver) { %>\n                <li data-receiver="<%= receiver.id %>" class="<% if (receiver.active === true) { print(\'active\') } %>">\n                    <div class="checkbox-wrapper">\n                        <div class="checkmark checkmark-black checkmark-medium"></div>\n                        <input type="checkbox" name="<%= receiver.nameURLFriendly %>" id="<%= receiver.nameURLFriendly %>" />\n                    </div>\n                    <label style="background-image: url(<%= receiver.imageURL %>);" for="<%= receiver.nameURLFriendly %>"><%= receiver.name %></label>\n                    <div class="receiver-tooltip">\n                        <h2><%= receiver.name %></h2>\n                        <p><%= receiver.description %></p>\n                    </div>\n                </li>\n            <% }); %>\n        </ul>\n    </div>\n\n    <div class="section-bottom">\n        <div class="donation-receipt">\n            <div class="checkbox-wrapper">\n                <input type="checkbox" name="receipt-active" />\n            </div>\n            <%= data.donation.donationReceiptText %>\n        </div>\n        <div class="region-sum">\n            <span class="round-sum-text">\n                <%= data.donationModule.sumText %>\n            </span>\n            <span class="sum">\n                <span class="sum-value"><%= data.donation.sumIncludingDonation %></span>\n                <span class="sum-currency"><%= data.donation.currency %></span>\n            </span>\n        </div>\n    </div>\n</section>\n';});

/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Model of the module itself
 * Holds data like translations for general texts and status of the module itself (activated / deactivated)
 *
 * @extends Backbone.Model
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('model/donationModule',[
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    
    return Backbone.Model.extend({
        initialize: function () {
            var me = this;

            this.bind('change:active', function (model, value) {
                sessionStorage.setItem('lfnds-module-active', value);
            });

            me.checkLocalStorage();
        },

        defaults: {
            'activateText': 'Ja, ich möchte mit meinem Einkauf aufrunden und spenden!',
            'sumText': 'Runde Summe',

            'orientation'   : 'horizontal',
            'color'         : 'elefunds',
            'dimensions'    : 'large',
            'tooltipStyle'  : 'default'
        },

        checkLocalStorage: function () {
            var me = this;

            if (sessionStorage.getItem('lfnds-module-active')) {
                me.activeDefault = sessionStorage.getItem('lfnds-module-active') === 'true';
                me.set({'active': me.activeDefault});
            }
        }
    });
});
define('manager/getElefundsData',[
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    

    if (lfnds !== undefined) {
        return lfnds;
    } else {
        return {};
    }
});
/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Model of a receiver
 *
 * @extends Backbone.Model
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('model/receiver',[
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    
    return Backbone.Model.extend({
        /**
         * The default-values for the attributes of the model
         * @type {object}
         */
        defaults: {
            'id': 0,
            'name': 'Test-Receiver',
            'nameURLFriendly': 'test-receiver',
            'imageURL': 'http://www.google.com/images.jpg',
            'active': false,
            'description': 'example',
            'clientID': 1001
        },

        initialize: function () {
            var me = this;

            if (sessionStorage.getItem('lfnds-receiver-active' + me.get('id'))) {
                if (sessionStorage.getItem(('lfnds-receiver-active' + me.get('id'))) === 'true') {
                    me.set({'active' : true});
                } else {
                    me.set({'active' : false});
                }
            }

            this.bind('change:active', function (model, value) {
                sessionStorage.setItem('lfnds-receiver-active' + me.get('id'), value);
            });
        }
    });
});
/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Collection of the receiver
 *
 * @extends Backbone.Collection
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('collection/receiver',[
    'jquery',
    'underscore',
    'backbone',
    'model/receiver'
], function ($, _, Backbone, receiverModel) {
    
    return Backbone.Collection.extend({
        model: receiverModel,
        url: 'http://elefunds-api-staging.herokuapp.com/receivers/for/test',

        initialize: function (models, options) {
            this.url = 'http://elefunds-api-staging.herokuapp.com/receivers/for/' + options.clientID;
            console.log(this.url);
        }
    });
});
/**
 * @license RequireJS i18n 2.0.3 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/i18n for details
 */
/*jslint regexp: true */
/*global require: false, navigator: false, define: false */

/**
 * This plugin handles i18n! prefixed modules. It does the following:
 *
 * 1) A regular module can have a dependency on an i18n bundle, but the regular
 * module does not want to specify what locale to load. So it just specifies
 * the top-level bundle, like "i18n!nls/colors".
 *
 * This plugin will load the i18n bundle at nls/colors, see that it is a root/master
 * bundle since it does not have a locale in its name. It will then try to find
 * the best match locale available in that master bundle, then request all the
 * locale pieces for that best match locale. For instance, if the locale is "en-us",
 * then the plugin will ask for the "en-us", "en" and "root" bundles to be loaded
 * (but only if they are specified on the master bundle).
 *
 * Once all the bundles for the locale pieces load, then it mixes in all those
 * locale pieces into each other, then finally sets the context.defined value
 * for the nls/colors bundle to be that mixed in locale.
 *
 * 2) A regular module specifies a specific locale to load. For instance,
 * i18n!nls/fr-fr/colors. In this case, the plugin needs to load the master bundle
 * first, at nls/colors, then figure out what the best match locale is for fr-fr,
 * since maybe only fr or just root is defined for that locale. Once that best
 * fit is found, all of its locale pieces need to have their bundles loaded.
 *
 * Once all the bundles for the locale pieces load, then it mixes in all those
 * locale pieces into each other, then finally sets the context.defined value
 * for the nls/fr-fr/colors bundle to be that mixed in locale.
 */
(function () {
    

    //regexp for reconstructing the master bundle name from parts of the regexp match
    //nlsRegExp.exec("foo/bar/baz/nls/en-ca/foo") gives:
    //["foo/bar/baz/nls/en-ca/foo", "foo/bar/baz/nls/", "/", "/", "en-ca", "foo"]
    //nlsRegExp.exec("foo/bar/baz/nls/foo") gives:
    //["foo/bar/baz/nls/foo", "foo/bar/baz/nls/", "/", "/", "foo", ""]
    //so, if match[5] is blank, it means this is the top bundle definition.
    var nlsRegExp = /(^.*(^|\/)nls(\/|$))([^\/]*)\/?([^\/]*)/;

    //Helper function to avoid repeating code. Lots of arguments in the
    //desire to stay functional and support RequireJS contexts without having
    //to know about the RequireJS contexts.
    function addPart(locale, master, needed, toLoad, prefix, suffix) {
        if (master[locale]) {
            needed.push(locale);
            if (master[locale] === true || master[locale] === 1) {
                toLoad.push(prefix + locale + '/' + suffix);
            }
        }
    }

    function addIfExists(req, locale, toLoad, prefix, suffix) {
        var fullName = prefix + locale + '/' + suffix;
        if (require._fileExists(req.toUrl(fullName + '.js'))) {
            toLoad.push(fullName);
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     * This is not robust in IE for transferring methods that match
     * Object.prototype names, but the uses of mixin here seem unlikely to
     * trigger a problem related to that.
     */
    function mixin(target, source, force) {
        var prop;
        for (prop in source) {
            if (source.hasOwnProperty(prop) && (!target.hasOwnProperty(prop) || force)) {
                target[prop] = source[prop];
            } else if (typeof source[prop] === 'object') {
                if (!target[prop]) {
                    target[prop] = {};
                }
                mixin(target[prop], source[prop], force);
            }
        }
    }

    define('i18n',['module'], function (module) {
        var masterConfig = module.config ? module.config() : {};

        return {
            version: '2.0.3',
            /**
             * Called when a dependency needs to be loaded.
             */
            load: function (name, req, onLoad, config) {
                config = config || {};

                if (config.locale) {
                    masterConfig.locale = config.locale;
                }

                var masterName,
                    match = nlsRegExp.exec(name),
                    prefix = match[1],
                    locale = match[4],
                    suffix = match[5],
                    parts = locale.split("-"),
                    toLoad = [],
                    value = {},
                    i, part, current = "";

                //If match[5] is blank, it means this is the top bundle definition,
                //so it does not have to be handled. Locale-specific requests
                //will have a match[4] value but no match[5]
                if (match[5]) {
                    //locale-specific bundle
                    prefix = match[1];
                    masterName = prefix + suffix;
                } else {
                    //Top-level bundle.
                    masterName = name;
                    suffix = match[4];
                    locale = masterConfig.locale;
                    if (!locale) {
                        locale = masterConfig.locale =
                            typeof navigator === "undefined" ? "root" :
                                (navigator.language ||
                                    navigator.userLanguage || "root").toLowerCase();
                    }
                    parts = locale.split("-");
                }

                if (config.isBuild) {
                    //Check for existence of all locale possible files and
                    //require them if exist.
                    toLoad.push(masterName);
                    addIfExists(req, "root", toLoad, prefix, suffix);
                    for (i = 0; i < parts.length; i++) {
                        part = parts[i];
                        current += (current ? "-" : "") + part;
                        addIfExists(req, current, toLoad, prefix, suffix);
                    }

                    req(toLoad, function () {
                        onLoad();
                    });
                } else {
                    //First, fetch the master bundle, it knows what locales are available.
                    req([masterName], function (master) {
                        //Figure out the best fit
                        var needed = [],
                            part;

                        //Always allow for root, then do the rest of the locale parts.
                        addPart("root", master, needed, toLoad, prefix, suffix);
                        for (i = 0; i < parts.length; i++) {
                            part = parts[i];
                            current += (current ? "-" : "") + part;
                            addPart(current, master, needed, toLoad, prefix, suffix);
                        }

                        //Load all the parts missing.
                        req(toLoad, function () {
                            var i, partBundle, part;
                            for (i = needed.length - 1; i > -1 && needed[i]; i--) {
                                part = needed[i];
                                partBundle = master[part];
                                if (partBundle === true || partBundle === 1) {
                                    partBundle = req(prefix + part + '/' + suffix);
                                }
                                mixin(value, partBundle);
                            }

                            //All done, notify the loader.
                            onLoad(value);
                        });
                    });
                }
            }
        };
    });
}());

define('nls/donationModule',{
    'root'  : {
        'tooltipTitle'          :   'elefunds',
        'tooltipDescription'    :   'This is the description.'
    },
    'de'    : true
});
/*global define, document*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Main-view of the donation-module
 *
 * @extends Backbone.View
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('view/donationModule',[
    'jquery',
    'underscore',
    'backbone',
    'text!template/donationModule.html',
    'model/donationModule',
    'manager/getElefundsData',
    'collection/receiver',
    'i18n!nls/donationModule'
], function ($, _, Backbone, donationModuleTemplate, DonationModuleModel, elefundsData, ReceiverCollection, DonationModuleTranslations) {
    
    return Backbone.View.extend({
        el: $('#elefunds'),

        /**
         * Initializes the models
         * Calls Model-Events
         * @this {Backbone.View}
         */
        initialize: function () {
            this.donationModuleModel = new DonationModuleModel();
            this.receiverCollection = this.options.receiverCollection;

            this.addModelEvents();
        },

        /**
         * DOM-events
         */
        events: {
            'click .region-activate-module'                     : 'onModuleActivateButtonClick',
            'keydown .region-input input.donation-input-small'  : 'onArrowUseInSmallInput',
            'keydown .region-input input.donation-input-full'   : 'onArrowUseInLargeInput',
            'keypress .region-input input.donation-input-full'  : 'onValidateKeyInput',
            'keypress .region-input input.donation-input-small' : 'onValidateKeyInput',
            'click .button-increase'                            : 'onButtonIncreaseClick',
            'click .button-decrease'                            : 'onButtonDecreaseClick',
            'click .section-middle li'                          : 'onReceiverButtonClick',
            'click .donation-receipt'                           : 'onDonationReceiptClick',
            'change .region-input input.donation-input-small'   : 'onSmallInputChanges',
            'change .region-input input.donation-input-full'    : 'onLargeInputChanges'
        },

        /**
         * Compiles the template
         * Renders the template
         * Appends the compiled template to the DOM
         * @this {Backbone.View}
         * @return {Backbone.View}
         */
        render: function () {
            var me = this,
                modelJSON = me.model.toJSON();
            _.templateSettings.variable = 'data';

            /**
             * Check if receivers are available in JSON, otherwise fetch them from the elefunds API
             */
            if (elefundsData.receivers !== undefined) {
                _.each(elefundsData.receivers.de, function (receiver) {
                    /** @namespace receiver.vertical.horizontal */
                    /** @namespace receiver.vertical.horizontal.large */
                    /** @namespace receiver.vertical */
                    me.receiverCollection.add({
                        name: receiver.name,
                        nameURLFriendly: receiver.name.toLowerCase().replace(/ +/g,'_').replace(/[^a-z0-9-_]/g,'').trim(),
                        description: receiver.description,
                        imageURL: receiver.vertical.horizontal.large,
                        active: false
                    });
                });
            } else {
                me.template = _.template(donationModuleTemplate, {donation: modelJSON, donationModule: me.donationModuleModel.toJSON(), receivers: me.receiverCollection.toJSON(), translations: DonationModuleTranslations});
                me.template = $(me.template);

                me.$el.html(me.template, []);

                me.receiverCollection.fetch({dataType: 'jsonp', success: function (model, response) {
                    me.receiverCollection.reset();
                    _.each(response.receivers.de, function (item) {
                        /** @namespace item.images.horizontal.medium */
                        me.receiverCollection.add({
                            'id': item.id,
                            'imageURL': item.images.horizontal.medium,
                            'description': item.description,
                            'name': item.name
                        });
                    });

                    me.template = _.template(donationModuleTemplate, {donation: modelJSON, donationModule: me.donationModuleModel.toJSON(), receivers: me.receiverCollection.toJSON(), translations: DonationModuleTranslations});
                    me.template = $(me.template);
                    me.$el.html(me.template, []);
                }});
            }


            return this;
        },

        /**
         * Adds events
         * Listening to changes in model and DOM
         * @this {Backbone.View}
         */
        addModelEvents: function () {
            var me = this;

            /**
             * React on model-changes
             * Important: We use event-driven-development
             * It is extremely important to differ between model-events and dom-events,
             * to guarantee consistency while extending our application
             *
             * In general: When reacting on DOM-events which change the model,
             * it is a good advice to stop writing code after changing the model and implement the
             * rest of the logic in a model-change event
             * (Because mostly, when a particular change in the model happens, the rest of the logic should happen)
             */
            this.model.on('change:sumIncludingDonation', function (model, value) {
                me.onChangeSumIncludingDonation(model, value);
            });
            this.receiverCollection.on('change:active', function (model, isActive) {
                me.onChangeActiveReceiver(model, isActive);
            });
            this.donationModuleModel.on('change:active', function (model, isActive) {
                me.onChangeActiveModuleStatus(model, isActive);
            });
            this.model.on('change:donationReceipt', function (model, isActive) {
                me.onChangeDonationReceiptStatus(model, isActive);
            });
        },

        /**
         * Set donationModule-model active attribute to true / false when activate button is clicked
         * @this {Backbone.View}
         * @param event
         */
        onModuleActivateButtonClick: function (event) {
            /**
             * Prevents bubbling of label-clicks (would be registered as two clicks)
             */
            event.stopPropagation();
            event.preventDefault();

            if (this.donationModuleModel.get('active') === true) {
                this.donationModuleModel.set({'active': false});
            } else {
                this.donationModuleModel.set({'active': true});

//                if (this.receiverCollection.)
                this.receiverCollection.each(function (item) {
                    item.set({active: true});
                });
            }
        },

        /**
         * Jump in Large Input when cursor is at the very left and arrow-left is pressed
         * @this {Backbone.View}
         * @param event
         */
        onArrowUseInSmallInput: function (event) {
            var $smallInput = $(event.target),
                lastCursorPosition = this.getCursorPositionInInput($smallInput),
                charCode = (event.which) || event.keyCode;

            if (parseInt(charCode, 10) === 37 && lastCursorPosition === 0
                || parseInt(charCode, 10) === 8 && lastCursorPosition === 0) {
                $('.region-input input.donation-input-full').focus();
            }
        },

        /**
         * Jump in small Input when cursor is at the very right and arrow-right is pressed
         * @this {Backbone.View}
         * @param event
         */
        onArrowUseInLargeInput: function (event) {
            var $fullInput = $(event.target),
                lastCursorPosition = this.getCursorPositionInInput($fullInput),
                charCode = (event.which) || event.keyCode;

            if (parseInt(charCode, 10) === 39 && lastCursorPosition === $fullInput.val().length) {
                $('.region-input input.donation-input-small').focus();
            }
        },

        /**
         * Prohibit everything but numbers in donation-input
         * @this {Backbone.View}
         * @param event
         * @return {boolean}
         */
        onValidateKeyInput: function (event) {
            var charCode = (event.which) || event.keyCode;
            if (charCode > 31 && (charCode < 48 || charCode > 57)) {

                /* If "," or "." are pressed, switch to small input (for cent-values) */
                if (parseInt(charCode, 10) === 44 || parseInt(charCode, 10) === 46) {
                    $('.region-input input.donation-input-small').focus().select();
                }

                return false;
            }

            return true;
        },

        /**
         * Raise the donationAmountAbsolute for one when button is clicked
         * @this {Backbone.View}
         */
        onButtonIncreaseClick: function () {
            var newDonationAmountAbsolute = parseInt(this.model.get('donationAmountAbsolute'), 10) + 1;
            this.model.set({donationAmountAbsolute: newDonationAmountAbsolute}, {validate: true});

            if (this.donationModuleModel.get('active') === false) {
                this.donationModuleModel.set({'active': true});

                this.receiverCollection.each(function (item) {
                    item.set({active: true});
                });
            }
        },

        /**
         * Decrease the donationAmountAbsolute for one when button is clicked
         * @this {Backbone.View}
         */
        onButtonDecreaseClick: function () {
            var newDonationAmountAbsolute = parseInt(this.model.get('donationAmountAbsolute'), 10) - 1;
            this.model.set({donationAmountAbsolute: newDonationAmountAbsolute}, {validate: true});

            if (this.donationModuleModel.get('active') === false) {
                this.donationModuleModel.set({'active': true});

                this.receiverCollection.each(function (item) {
                    item.set({active: true});
                });
            }
        },

        /**
         * Change model value for donationAmountAfterComma when input changed
         * @this {Backbone.View}
         */
        onSmallInputChanges: function () {
            if (this.$el.find('.region-input input.donation-input-small').val() === '') {
                this.$el.find('.region-input input.donation-input-small').val('00');
            }
            this.model.set({donationAmountAfterComma : this.$el.find('.region-input input.donation-input-small').val()});
        },

        /**
         * Change model value for donationAmountAbsolute when input changed
         */
        onLargeInputChanges: function () {
            if (this.$el.find('.region-input input.donation-input-full').val() === '') {
                this.$el.find('.region-input input.donation-input-full').val('0');
            }
            this.model.set({donationAmountAbsolute : this.$el.find('.region-input input.donation-input-full').val()});
        },

        /**
         * Set receiver-model to active when a receiver is clicked
         * @this {Backbone.View}
         * @param event
         */
        onReceiverButtonClick: function (event) {
            /**
             * Prevents bubbling of label-clicks (would be registered as two clicks)
             */
            event.stopPropagation();
            event.preventDefault();

            var liElement;

            if (!$(event.target).is('li')) {
                liElement = $(event.target).parents('li');
            } else {
                liElement = $(event.target);
            }

            if (this.receiverCollection.findWhere({id: liElement.data('receiver')}).get('active') === true) {
                this.receiverCollection.findWhere({id: liElement.data('receiver')}).set({'active': false});
            } else {
                this.receiverCollection.findWhere({id: liElement.data('receiver')}).set({'active': true});
            }
        },

        /**
         * Set donation-receipt to true when the area for it is clicked
         * @this {Backbone.View}
         */
        onDonationReceiptClick: function () {
            if (this.model.get('donationReceipt') === true) {
                this.model.set({'donationReceipt': false});
            } else {
                this.model.set({'donationReceipt': true});
            }
        },

        /**
         * Helper-function to receive current cursor-position in an input-field
         * @this {Backbone.View}
         * @param inputTest
         * @returns {*}
         */
        getCursorPositionInInput: function (inputTest) {
            var input = inputTest.get(0),
                sel,
                selLen;

            if (input.selectionStart !== undefined) {
                return input.selectionStart;
            }
            if (document.selection) {
                input.focus();
                sel = document.selection.createRange();
                selLen = document.selection.createRange().text.length;
                sel.moveStart('character', -input.value.length);
                return sel.text.length - selLen;
            }
            return false;
        },

        /**
         * Change the sum-value always when the sum changes in the model
         * @this {Backbone.View}
         * @param model
         * @param value
         */
        onChangeSumIncludingDonation: function (model, value) {
            this.$el.find('.sum-value').html(value);
            this.$el.find('.donation-input-full').val(this.model.get('donationAmountAbsolute'));
            this.$el.find('.donation-input-small').val(this.model.get('donationAmountAfterComma'));
        },

        /**
         * @this {Backbone.View}
         * @param model
         * @param isActive
         */
        onChangeActiveReceiver: function (model, isActive) {
            if (isActive) {
                this.$el.find('.section-middle li[data-receiver="' + model.get('id') + '"]').addClass('active');
                /* As soon as at least one receiver is selected, the module automatically activates  */
                this.donationModuleModel.set({'active': true});
            } else {
                var areAllReceiversDeactivated = true;

                this.receiverCollection.each(function (item) {
                    if (item.get('active') === true) {
                        areAllReceiversDeactivated = false;
                    }
                });
                if (areAllReceiversDeactivated) {
                    this.donationModuleModel.set({'active': false});
                }
                this.$el.find('.section-middle li[data-receiver="' + model.get('id') + '"]').removeClass('active');
            }
        },

        /**
         * @this {Backbone.View}
         * @param model
         * @param isActive
         */
        onChangeActiveModuleStatus: function (model, isActive) {
            if (isActive) {
                this.$el.find('#elefunds-module').addClass('active');
            } else {
                this.$el.find('#elefunds-module').removeClass('active');
            }
        },

        /**
         * @this {Backbone.View}
         * @param model
         * @param isActive
         */
        onChangeDonationReceiptStatus: function (model, isActive) {
            if (isActive) {
                this.$el.find('.donation-receipt').addClass('active');
            } else {
                this.$el.find('.donation-receipt').removeClass('active');
            }
        }
    });
});
/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Model of a donation
 *
 * @extends Backbone.Model
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('model/donation',[
    'jquery',
    'underscore',
    'backbone',
    'manager/getElefundsData'
], function ($, _, Backbone, elefundsDataModel) {
    
    return Backbone.Model.extend({
        /**
         * Initialize the model, add event-listeners for change events
         * @this {Backbone.Model}
         */
        initialize: function () {
            /**
             * @type {*}
             */
            var me = this;

            if (!this.checkLocalStorage()) {
                /**
                 * Set initial values from given JSON-String
                 */
                this.set({'sumExcludingDonation': (elefundsDataModel.total) / 100});
                this.set({'currency': elefundsDataModel.currency});
                this.set({'currencyDelimiter': elefundsDataModel.currencyDelimiter});

                this.calculateSuggestedDonation();
            }


            /**
             * Events when donation has changed
             */
            this.bind('change:donationAmount', function () {
                me.normalizeDonationAmount();
            });
            this.bind('change:donationAmountAbsolute', function () {
                me.normalizeDonationAmount();
            });
            this.bind('change:donationAmountAfterComma', function () {
                me.normalizeDonationAmount();
            });
            this.bind('change:currencyDelimiter', function (value) {
                me.changeCurrencyDelimiter(value);
            });

            /**
             * Sometimes the sum excluding the donation can change
             * Make sure that the sumIncludingDonation changes after that.
             * fe. when changing the supply-type via ajax (OneStepCheckout)
             */
            this.bind('change:sumExcludingDonation', function () {
                me.changeSumIncludingDonation();
                /**
                 * Suggested Donation-Amount has to change
                 */
                me.calculateSuggestedDonation();
            });
        },

        /**
         * The default-values for the attributes of the model
         * @type {object}
         */
        defaults: {
            'suggestedAmount'           :   '5.00',
            /**
             * We separate between 'before comma' and 'after comma'
             * to make calculations and validation easier
             */
            'donationAmountAbsolute'    :   '5',
            'donationAmountAfterComma'  :   '00',

            'sumExcludingDonation'      :   98,
            'sumIncludingDonation'      :   105,

            'maxDonation'               :   '9999',

            'currency'                  :   '€',
            'currencyDelimiter'         :   ',',

            'donationReceipt'           :   false,
            'donationReceiptText'       :   'Ja, ich würde gerne eine Spendenquitting erhalten.',

            /**
             * Never change Cent-Values directly,
             * Cent-values are automatically changed
             */
            'suggestedAmountCent'       :   '500',
            'donationAmountCent'        :   '500',
            'sumExcludingDonationCent'  :   '9800',
            'sumIncludingDonationCent'  :   '10500'
        },

        /**
         * Validates attributes on set-method-call
         * set-method-call needs parameter {validate: true}
         * @param attributes attributes to be validated
         * @return {string} Returns false if validation succeeds
         */
        validate: function (attributes) {
            if (_.has(attributes, 'donationAmountAbsolute') && attributes.donationAmountAbsolute < 0) {
                return 'Donation-amount is too small.';
            }
            if (_.has(attributes, 'donationAmountAbsolute') && attributes.donationAmountAbsolute > attributes.maxDonation) {
                return 'Donation-amount is too high.';
            }
            return '';
        },

        /**
         * Normalizes donation-amount to this format: 10.00 (2 decimals)
         * @this {Backbone.Model}
         * @return {object} Returns instance
         */
        normalizeDonationAmount: function () {
            var donationAmountAbsolute = this.get('donationAmountAbsolute'),
                donationAmountAfterComma = this.get('donationAmountAfterComma'),
                sum = donationAmountAbsolute + this.get('currencyDelimiter') + donationAmountAfterComma;

            this.set({'donationAmount': sum});

            this.set({'donationAmountCent': this.convertToCent(sum)});

            sessionStorage.setItem('lfnds-donation-donationAmountAbsolute', donationAmountAbsolute);
            sessionStorage.setItem('lfnds-donation-donationAmountAfterComma', donationAmountAfterComma);

            this.changeSumIncludingDonation();

            return this;
        },

        /**
         * Changes the sum after donation-amount changed
         * @this {Backbone.Model}
         * @return {object} Returns instance
         */
        changeSumIncludingDonation: function () {
                /**
                 * @type {number}
                 */
            var sumExcludingDonation = this.get('sumExcludingDonation'),
                /**
                 * @type {number}
                 */
                donationAmount = this.get('donationAmount'),
                /**
                 * @type {number}
                 */
                sumIncludingDonation;

            this.set({'sumExcludingDonationCent': this.convertToCent(sumExcludingDonation)});

            sumExcludingDonation = parseFloat(sumExcludingDonation);
            donationAmount = parseFloat(donationAmount);

            sumIncludingDonation = sumExcludingDonation + donationAmount;
            this.set({'sumIncludingDonation' : sumIncludingDonation.toFixed(2)});
            this.set({'sumIncludingDonationCent' : this.convertToCent(sumIncludingDonation.toFixed(2))});

            sessionStorage.setItem('lfnds-donation-sumExcludingDonation', sumExcludingDonation);
            sessionStorage.setItem('lfnds-donation-sumIncludingDonation', sumIncludingDonation.toFixed(2));
            sessionStorage.setItem('lfnds-donation-sumIncludingDonationCent', this.convertToCent(sumIncludingDonation.toFixed(2)));

            return this;
        },

        /**
         * Changes the currency-delimiter in donation-value
         * @this {Backbone.Model}
         * @return {object} Returns instance
         */
        changeCurrencyDelimiter: function (value) {
            var donationAmount = this.get('donationAmount'),
                oldDelimiter = value.previous('currencyDelimiter'),
                newDelimiter = this.get('currencyDelimiter'),
                newDonationAmount = donationAmount.toString().replace(oldDelimiter, newDelimiter);
            this.set({donationAmount: newDonationAmount});

            return this;
        },

        /**
         * Calculate the initial suggested amount and set correct values
         * @this {Backbone.Model}
         * @returns {number}
         */
        calculateSuggestedDonation: function () {
            var suggestedDonation,
                sumExcludingDonation = this.get('sumExcludingDonation') * 100,
                sumIncludingDonation,
                suggestedDonationSplitted,
                /**
                 * Tiers, when donation-percentage change
                 * @type {Array}
                 */
                tiers = [16, 100, 1000, 999999],
                /**
                 * The different percentages for roundup-values,
                 * in relationship to the tiers
                 * @type {Array}
                 */
                percent = [0.10, 0.06, 0.04, 0.03],
                /**
                 * percentage alone don't always give us a round value
                 * helper-values for creating a round sum
                 */
                roundup = [2, 5, 10, 20],
                /**
                 * default tier
                 * @type {number}
                 */
                chosenTierIndex = tiers.length - 1;

            /**
             * Determine the correct tier for the shopping-sum
             */
            _.each(tiers, function (tier, index) {
                if (sumExcludingDonation > tier) {
                    chosenTierIndex = index + 1;
                }
            });

            /**
             * Calculate suggested donation just with chosen percentage,
             * without checking for specific roundup
             */
            suggestedDonation = sumExcludingDonation * percent[chosenTierIndex];

            /**
             * getting the new sum, including the donation, after rounding up
             */
            sumIncludingDonation = Math.round((sumExcludingDonation + suggestedDonation) / roundup[chosenTierIndex]) * roundup[chosenTierIndex];

            /**
             * suggested donation by negate the sum with donation of the sum without
             */
            suggestedDonation = sumIncludingDonation - sumExcludingDonation;

            /**
             * Correct the algorithm to guarantee that donation suggestions are not to high
             */
            if (suggestedDonation > roundup[chosenTierIndex] && chosenTierIndex < (tiers.length - 2)) {
                suggestedDonation -= roundup[chosenTierIndex];
            }
            suggestedDonation = (suggestedDonation / 100).toFixed(2);
            /**
             * Set initial values for suggested donation and the donation-amount (initial)
             */
            this.set({'suggestedAmount': suggestedDonation});
            this.set({'suggestedAmountCent': this.convertToCent(suggestedDonation)});

            suggestedDonationSplitted = suggestedDonation.toString().split('.');
            this.set({'donationAmountAbsolute': suggestedDonationSplitted[0]});
            this.set({'donationAmountAfterComma': suggestedDonationSplitted[1]});

            /**
             * Normalize donation amount
             * has to be called by hand as backbone-models don't register their own change-events (weird)
             */
            this.normalizeDonationAmount();

            return suggestedDonation;
        },

        /**
         *
         * @param amount
         */
        convertToCent: function (amount) {
            var amountInCent;

            console.log(amount);

            amountInCent = amount * 100;

            return amountInCent;
        },

        checkLocalStorage: function () {
            if (sessionStorage.getItem('lfnds-donation-donationAmountAbsolute')) {
                this.set({'sumExcludingDonation': sessionStorage.getItem('lfnds-donation-sumExcludingDonation')});
                this.set({'sumIncludingDonation': sessionStorage.getItem('lfnds-donation-sumIncludingDonation')});
                this.set({'sumIncludingDonationCent': sessionStorage.getItem('lfnds-donation-sumIncludingDonationCent')});

                this.set({'donationAmountAbsolute': sessionStorage.getItem('lfnds-donation-donationAmountAbsolute')});
                this.set({'donationAmountAfterComma': sessionStorage.getItem('lfnds-donation-donationAmountAfterComma')});

                this.normalizeDonationAmount();

                return true;
            }

            return false;
        }
    });
});
/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Model of the share module
 *
 * @extends Backbone.Model
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('model/shareModule',[
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    
    return Backbone.Model.extend({
        defaults: {
            'link'      :   null,
            'imgSrc'    :   null,
            'baseURL'   :   'http://share.elefunds.de/on',
            'service'   :   'facebook',
            'clientID'  :   '1001',
            'foreignID' :   '2000',
            'receivers' :   ['Plan', 'WWF']
        },

        initialize: function () {
            this.createLink();
        },

        /**
         * @returns {string}
         */
        createLink: function () {
            var link,
                baseURL = this.get('baseURL'),
                service = this.get('service'),
                clientID = this.get('clientID'),
                //TODO: receivers
                foreignID = this.get('foreignID');

            link = baseURL + '/' + service + '/' + clientID + '/' + foreignID;

            this.set({'link' : link});

            return link;
        }
    });
});
/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Collection of share-providers
 *
 * @extends Backbone.Collection
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('collection/shareModule',[
    'jquery',
    'underscore',
    'backbone',
    'model/shareModule'
], function ($, _, Backbone, shareModuleModel) {
    
    return Backbone.Collection.extend({
        model: shareModuleModel
    });
});
define('text!template/donationForm.html',[],function () { return '<!--\n This Form provides all model-values in a form-element to be able to get them with an PHP-Post\n -->\n\n<form id="elefundsDonation">\n    <input id="suggestedAmount" name="suggestedAmount" value="<%= data.donationModel.suggestedAmount %>" type="text">\n    <input id="donationAmount" name="donationAmount" value="<%= data.donationModel.donationAmount %>" type="text">\n    <input id="donationAmountAbsolute" name="donationAmountAbsolute" value="<%= data.donationModel.donationAmountAbsolute %>" type="text">\n\n    <input id="donationAmountAfterComma" name="donationAmountAfterComma" value="<%= data.donationModel.donationAmountAfterComma %>" type="text">\n    <input id="sumExcludingDonation" name="sumExcludingDonation" value="<%= data.donationModel.sumExcludingDonation %>" type="text">\n    <input id="sumIncludingDonation" name="sumIncludingDonation" value="<%= data.donationModel.sumIncludingDonation %>" type="text">\n\n    <input id="maxDonation" name="maxDonation" value="<%= data.donationModel.maxDonation %>" type="text">\n    <input id="currency" name="currency" value="<%= data.donationModel.currency %>" type="text">\n\n    <input id="sumExcludingDonationCent" name="sumExcludingDonationCent" value="<%= data.donationModel.sumExcludingDonationCent %>" type="text">\n    <input id="sumIncludingDonationCent" name="sumIncludingDonationCent" value="<%= data.donationModel.sumIncludingDonationCent %>" type="text">\n    <input id="suggestedAmountCent" name="suggestedAmountCent" value="<%= data.donationModel.suggestedAmountCent %>" type="text">\n    <input id="donationAmountCent" name="donationAmountCent" value="<%= data.donationModel.donationAmountCent %>" type="text">\n    <%\n        _.each(data.receiverCollection, function (receiver) {\n            if (receiver.active === true) { %>\n                <%= receiver.id %>\n                <%= receiver.name %>\n           <%  }\n        });\n    %>\n</form>';});

/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Form-view
 * Include this view,
 * if you want to get the model as form-values for some reasons
 * f.e. when you want to receive the values via POST
 *
 * @extends Backbone.View
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('view/donationForm',[
    'jquery',
    'underscore',
    'backbone',
    'text!template/donationForm.html'
], function ($, _, Backbone, donationFormTemplate) {
    
    return Backbone.View.extend({
        el: $('#donation-form'),

        /**
         * Initializes the model
         * Gets the template
         * renders the view
         */
        initialize: function () {
            this.addModelEvents();
        },

        /**
         * Adds events
         * Listening to changes in model
         */
        addModelEvents: function () {
            var me = this;
            /**
             * Just re-render form on model/collection-changes
             */
            this.model.on('change', function () {
                me.render();
            });
            this.collection.on('change', function () {
                me.render();
            });
            this.collection.on('add', function () {
                me.render();
            });
        },

        /**
         * Compiles the template
         * Renders the template
         * Appends the compiled template to the DOM
         */
        render: function () {
            var me = this,
                modelJSON = me.model.toJSON(),
                collectionJSON = me.collection.toJSON();

            _.templateSettings.variable = 'data';

            me.template = _.template(donationFormTemplate, {donationModel: modelJSON, receiverCollection: collectionJSON});
            me.template = $(me.template);

            this.$el.html('');
            this.$el.append(this.template, []);
            return this;
        }
    });
});
define('text!template/shareModule.html',[],function () { return '<section id="elefunds-share-module">\n    <h1>\n        <%= data.labels.heading %>\n    </h1>\n    <h2>\n        <%= data.labels.subHeading %>\n    </h2>\n    <ul>\n        <% _.each(data.shareCollection, function (shareItem) { %>\n            <li>\n                <a href="<%= shareItem.link %>" class="button" target="_blank">\n                    <img width="130" src="<%= shareItem.imgSrc %>">\n                </a>\n            </li>\n        <% }); %>\n    </ul>\n    <span class="caption"><%= data.labels.caption %>\n        <a href="http://www.elefunds.de" target="_blank" rel="nofollow">\n                <svg id="elefundsLogo" viewBox="0 0 407 84" version="1.1"\n                xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve"\n                x="0px" y="0px" width="80px" height="15px">\n                <g id="logoLayer">\n                    <path class="elephantIcon" d="M 0 82.9063 L 9.9961 83.2443 L 13.6443 77.7535 L 16.214 77.6728 L 24.9819 63.3615 L 35.1597 72.1091 L 38.3468 82.3896 L 46.1944 82.376 L 46.8734 76.5228 L 48.9711 76.245 L 50.3321 49.2482 L 66.3214 38.7624 L 73.5006 26.8895 L 76.1416 0 L 71.0248 0.947 L 62.1748 25.4859 L 50.5266 19.7129 L 26.4054 22.959 L 23.1412 33.4551 L 9.5418 40.7934 L 3.3376 51.6338 L 2.8823 61.4771 L 0 82.9063 Z" fill="#2f2728"/>\n                    <g>\n                        <path class="logoText" d="M 98.4757 38.8498 C 110.8919 38.8498 117.696 47.8961 117.696 59.3111 C 117.696 60.5796 117.441 63.2847 117.441 63.2847 L 87.5045 63.2847 C 88.3546 70.895 93.9676 74.8677 100.5167 74.8677 C 107.4908 74.8677 112.6779 70.049 112.6779 70.049 L 117.186 77.4893 C 117.186 77.4893 110.5519 84 99.7507 84 C 85.3775 84 76.4484 73.6846 76.4484 61.4246 C 76.4484 48.1506 85.4625 38.8498 98.4757 38.8498 ZM 106.6398 55.8444 C 106.4698 50.6867 102.8978 47.1356 98.4757 47.1356 C 92.9476 47.1356 89.0346 50.4332 87.8445 55.8444 L 106.6398 55.8444 Z" fill="#2f2728"/>\n                        <path class="logoText" d="M 124.4962 33.9461 C 124.4962 32.6775 123.8152 32.086 122.6252 32.086 L 119.2231 32.086 L 119.2231 22.9542 L 129.5143 22.9542 C 133.5113 22.9542 135.2973 24.7297 135.2973 28.7039 L 135.2973 72.078 C 135.2973 73.2611 135.9774 73.9381 137.1684 73.9381 L 140.4854 73.9381 L 140.4854 82.985 L 130.2793 82.985 C 126.1972 82.985 124.4962 81.2939 124.4962 77.2357 L 124.4962 33.9461 Z" fill="#2f2728"/>\n                        <path class="logoText" d="M 165.0609 38.8498 C 177.4771 38.8498 184.2812 47.8961 184.2812 59.3111 C 184.2812 60.5796 184.0262 63.2847 184.0262 63.2847 L 154.0897 63.2847 C 154.9397 70.895 160.5528 74.8677 167.1019 74.8677 C 174.076 74.8677 179.2631 70.049 179.2631 70.049 L 183.7711 77.4893 C 183.7711 77.4893 177.1371 84 166.3359 84 C 151.9627 84 143.0335 73.6846 143.0335 61.4246 C 143.0335 48.1506 152.0477 38.8498 165.0609 38.8498 ZM 173.225 55.8444 C 173.055 50.6867 169.4829 47.1356 165.0609 47.1356 C 159.5328 47.1356 155.6198 50.4332 154.4297 55.8444 L 173.225 55.8444 Z" fill="#2f2728"/>\n                        <path class="logoText" d="M 192.6124 48.4041 L 187.2543 48.4041 L 187.2543 39.8643 L 192.6124 39.8643 L 192.6124 38.5963 C 192.6124 24.4762 204.2635 22.6161 210.3026 22.6161 C 212.5137 22.6161 213.9597 22.8697 213.9597 22.8697 L 213.9597 32.001 C 213.9597 32.001 213.0237 31.832 211.7477 31.832 C 208.6866 31.832 203.4135 32.593 203.4135 38.8498 L 203.4135 39.8643 L 212.6837 39.8643 L 212.6837 48.4041 L 203.4135 48.4041 L 203.4135 82.985 L 192.6124 82.985 L 192.6124 48.4041 Z" fill="#2f2728"/>\n                        <path class="logoText" d="M 221.7799 50.8557 C 221.7799 49.5882 221.0989 48.9957 219.9089 48.9957 L 216.5068 48.9957 L 216.5068 39.8643 L 226.798 39.8643 C 230.795 39.8643 232.4961 41.6399 232.4961 45.529 L 232.4961 65.3983 C 232.4961 70.6405 233.8561 74.1916 239.2142 74.1916 C 247.0393 74.1916 251.3763 67.3438 251.3763 59.6491 L 251.3763 39.8643 L 262.1775 39.8643 L 262.1775 72.078 C 262.1775 73.2611 262.8575 73.9381 264.0485 73.9381 L 267.4506 73.9381 L 267.4506 82.985 L 257.4995 82.985 C 253.7574 82.985 251.8014 81.2094 251.8014 78.1663 L 251.8014 76.9813 C 251.8014 75.9672 251.8864 75.0367 251.8864 75.0367 L 251.7164 75.0367 C 249.6753 79.5183 244.2322 84 236.7481 84 C 227.478 84 221.7799 79.3493 221.7799 67.5964 L 221.7799 50.8557 Z" fill="#2f2728"/>\n                        <path class="logoText" d="M 273.4838 50.8557 C 273.4838 49.5882 272.8038 48.9957 271.6128 48.9957 L 268.2107 48.9957 L 268.2107 39.8643 L 278.1609 39.8643 C 281.9889 39.8643 283.86 41.6399 283.86 44.684 L 283.86 45.9516 C 283.86 46.8821 283.6899 47.8126 283.6899 47.8126 L 283.86 47.8126 C 285.731 44.176 290.4081 38.8498 299.1682 38.8498 C 308.7783 38.8498 314.3064 43.838 314.3064 55.2529 L 314.3064 72.078 C 314.3064 73.2611 314.9874 73.9381 316.1774 73.9381 L 319.5795 73.9381 L 319.5795 82.985 L 309.2893 82.985 C 305.2063 82.985 303.5052 81.2939 303.5052 77.2357 L 303.5052 57.451 C 303.5052 52.2088 302.1452 48.6576 296.7021 48.6576 C 290.9181 48.6576 286.581 52.2933 285.05 57.451 C 284.455 59.2266 284.2 61.1711 284.2 63.2002 L 284.2 82.985 L 273.4838 82.985 L 273.4838 50.8557 Z" fill="#2f2728"/>\n                        <path class="logoText" d="M 341.4319 38.8498 C 350.873 38.8498 353.9341 44.0925 353.9341 44.0925 L 354.1041 44.0925 C 354.1041 44.0925 354.0191 42.9929 354.0191 41.5554 L 354.0191 33.9461 C 354.0191 32.6775 353.3391 32.086 352.1481 32.086 L 348.746 32.086 L 348.746 22.9542 L 359.0372 22.9542 C 363.0342 22.9542 364.8203 24.7297 364.8203 28.7039 L 364.8203 72.078 C 364.8203 73.2611 365.5013 73.9381 366.6913 73.9381 L 370.0084 73.9381 L 370.0084 82.985 L 360.0582 82.985 C 356.1451 82.985 354.7001 81.1249 354.7001 78.5878 C 354.7001 77.6583 354.7001 76.9813 354.7001 76.9813 L 354.5301 76.9813 C 354.5301 76.9813 350.9581 84 341.0069 84 C 329.2707 84 321.7007 74.7841 321.7007 61.4246 C 321.7007 47.7271 329.9507 38.8498 341.4319 38.8498 ZM 354.2741 61.3401 C 354.2741 54.6604 350.7881 48.0651 343.559 48.0651 C 337.6049 48.0651 332.6728 52.8848 332.6728 61.4246 C 332.6728 69.6264 337.0099 74.9531 343.388 74.9531 C 349.002 74.9531 354.2741 70.895 354.2741 61.3401 Z" fill="#2f2728"/>\n                        <path class="logoText" d="M 377.4036 69.2884 C 377.4036 69.2884 382.9316 75.6292 390.3307 75.6292 C 393.6478 75.6292 396.1989 74.2761 396.1989 71.402 C 396.1989 65.3138 373.3215 65.3983 373.3215 51.4473 C 373.3215 42.8234 381.1456 38.8498 390.1607 38.8498 C 396.0288 38.8498 405.384 40.7944 405.384 47.8126 L 405.384 52.2933 L 395.8588 52.2933 L 395.8588 50.1797 C 395.8588 48.1506 392.7968 47.1356 390.4157 47.1356 C 386.5887 47.1356 383.9526 48.4886 383.9526 51.0257 C 383.9526 57.789 407 56.436 407 70.8095 C 407 78.9268 399.7709 84 390.3307 84 C 378.4246 84 372.3005 76.3052 372.3005 76.3052 L 377.4036 69.2884 Z" fill="#2f2728"/>\n                    </g>\n                </g>\n            </svg>\n        </a>\n    </span>\n</section>';});

define('nls/shareModule',{
    'root'  : {
        'heading'       :       'Juhu! Vielen Dank für Deine Spende.',
        'subHeading'    :       'Teilen kann man nicht nur mit seinem Einkauf, sondern auch mit seinen Freunden. Erzähle Deinen Freunden von elefunds!',
        'caption'       :       'Erfahre mehr über'
    },
    'de'    : true
});
/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

define('view/shareModule',[
    'jquery',
    'underscore',
    'backbone',
    'text!template/shareModule.html',
    'i18n!nls/shareModule'
], function ($, _, Backbone, shareModuleTemplate, shareModuleTranslations) {
    
    return Backbone.View.extend({
        el: $('#shareModule'),
        initialize: function () {
        },
        events: {
            'click .button' : 'onShareButtonClick'
        },
        render: function () {
            var me = this;

            _.templateSettings.variable = 'data';
            me.template = _.template(shareModuleTemplate, {shareCollection: me.collection.toJSON(), labels: shareModuleTranslations});
            me.$el.append(me.template, []);
        },
        onShareButtonClick: function (event) {
            event.preventDefault();
            event.stopPropagation();
            var url = $(event.target).attr('href'),
                title = "Facebook";

            if (!$(event.target).is('a')) {
                url = $(event.target).parents('a').attr('href');
            }

            var shareWindow = window.open(url, title, 'left=100,top=50,width=400,height=400');
            /** @namespace window.focus */
            if (window.focus) {
                shareWindow.focus();
            }
            return false;
        }
    });
});
/**
 * QUnit v1.11.0 - A JavaScript Unit Testing Framework
 *
 * http://qunitjs.com
 *
 * Copyright 2012 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 */

(function( window ) {

    var QUnit,
        assert,
        config,
        onErrorFnPrev,
        testId = 0,
        fileName = (sourceFromStacktrace( 0 ) || "" ).replace(/(:\d+)+\)?/, "").replace(/.+\//, ""),
        toString = Object.prototype.toString,
        hasOwn = Object.prototype.hasOwnProperty,
    // Keep a local reference to Date (GH-283)
        Date = window.Date,
        defined = {
            setTimeout: typeof window.setTimeout !== "undefined",
            sessionStorage: (function() {
                var x = "qunit-test-string";
                try {
                    sessionStorage.setItem( x, x );
                    sessionStorage.removeItem( x );
                    return true;
                } catch( e ) {
                    return false;
                }
            }())
        },
        /**
         * Provides a normalized error string, correcting an issue
         * with IE 7 (and prior) where Error.prototype.toString is
         * not properly implemented
         *
         * Based on http://es5.github.com/#x15.11.4.4
         *
         * @param {String|Error} error
         * @return {String} error message
         */
            errorString = function( error ) {
            var name, message,
                errorString = error.toString();
            if ( errorString.substring( 0, 7 ) === "[object" ) {
                name = error.name ? error.name.toString() : "Error";
                message = error.message ? error.message.toString() : "";
                if ( name && message ) {
                    return name + ": " + message;
                } else if ( name ) {
                    return name;
                } else if ( message ) {
                    return message;
                } else {
                    return "Error";
                }
            } else {
                return errorString;
            }
        },
        /**
         * Makes a clone of an object using only Array or Object as base,
         * and copies over the own enumerable properties.
         *
         * @param {Object} obj
         * @return {Object} New object with only the own properties (recursively).
         */
            objectValues = function( obj ) {
            // Grunt 0.3.x uses an older version of jshint that still has jshint/jshint#392.
            /*jshint newcap: false */
            var key, val,
                vals = QUnit.is( "array", obj ) ? [] : {};
            for ( key in obj ) {
                if ( hasOwn.call( obj, key ) ) {
                    val = obj[key];
                    vals[key] = val === Object(val) ? objectValues(val) : val;
                }
            }
            return vals;
        };

    function Test( settings ) {
        extend( this, settings );
        this.assertions = [];
        this.testNumber = ++Test.count;
    }

    Test.count = 0;

    Test.prototype = {
        init: function() {
            var a, b, li,
                tests = id( "qunit-tests" );

            if ( tests ) {
                b = document.createElement( "strong" );
                b.innerHTML = this.nameHtml;

                // `a` initialized at top of scope
                a = document.createElement( "a" );
                a.innerHTML = "Rerun";
                a.href = QUnit.url({ testNumber: this.testNumber });

                li = document.createElement( "li" );
                li.appendChild( b );
                li.appendChild( a );
                li.className = "running";
                li.id = this.id = "qunit-test-output" + testId++;

                tests.appendChild( li );
            }
        },
        setup: function() {
            if ( this.module !== config.previousModule ) {
                if ( config.previousModule ) {
                    runLoggingCallbacks( "moduleDone", QUnit, {
                        name: config.previousModule,
                        failed: config.moduleStats.bad,
                        passed: config.moduleStats.all - config.moduleStats.bad,
                        total: config.moduleStats.all
                    });
                }
                config.previousModule = this.module;
                config.moduleStats = { all: 0, bad: 0 };
                runLoggingCallbacks( "moduleStart", QUnit, {
                    name: this.module
                });
            } else if ( config.autorun ) {
                runLoggingCallbacks( "moduleStart", QUnit, {
                    name: this.module
                });
            }

            config.current = this;

            this.testEnvironment = extend({
                setup: function() {},
                teardown: function() {}
            }, this.moduleTestEnvironment );

            this.started = +new Date();
            runLoggingCallbacks( "testStart", QUnit, {
                name: this.testName,
                module: this.module
            });

            // allow utility functions to access the current test environment
            // TODO why??
            QUnit.current_testEnvironment = this.testEnvironment;

            if ( !config.pollution ) {
                saveGlobal();
            }
            if ( config.notrycatch ) {
                this.testEnvironment.setup.call( this.testEnvironment );
                return;
            }
            try {
                this.testEnvironment.setup.call( this.testEnvironment );
            } catch( e ) {
                QUnit.pushFailure( "Setup failed on " + this.testName + ": " + ( e.message || e ), extractStacktrace( e, 1 ) );
            }
        },
        run: function() {
            config.current = this;

            var running = id( "qunit-testresult" );

            if ( running ) {
                running.innerHTML = "Running: <br/>" + this.nameHtml;
            }

            if ( this.async ) {
                QUnit.stop();
            }

            this.callbackStarted = +new Date();

            if ( config.notrycatch ) {
                this.callback.call( this.testEnvironment, QUnit.assert );
                this.callbackRuntime = +new Date() - this.callbackStarted;
                return;
            }

            try {
                this.callback.call( this.testEnvironment, QUnit.assert );
                this.callbackRuntime = +new Date() - this.callbackStarted;
            } catch( e ) {
                this.callbackRuntime = +new Date() - this.callbackStarted;

                QUnit.pushFailure( "Died on test #" + (this.assertions.length + 1) + " " + this.stack + ": " + ( e.message || e ), extractStacktrace( e, 0 ) );
                // else next test will carry the responsibility
                saveGlobal();

                // Restart the tests if they're blocking
                if ( config.blocking ) {
                    QUnit.start();
                }
            }
        },
        teardown: function() {
            config.current = this;
            if ( config.notrycatch ) {
                if ( typeof this.callbackRuntime === "undefined" ) {
                    this.callbackRuntime = +new Date() - this.callbackStarted;
                }
                this.testEnvironment.teardown.call( this.testEnvironment );
                return;
            } else {
                try {
                    this.testEnvironment.teardown.call( this.testEnvironment );
                } catch( e ) {
                    QUnit.pushFailure( "Teardown failed on " + this.testName + ": " + ( e.message || e ), extractStacktrace( e, 1 ) );
                }
            }
            checkPollution();
        },
        finish: function() {
            config.current = this;
            if ( config.requireExpects && this.expected === null ) {
                QUnit.pushFailure( "Expected number of assertions to be defined, but expect() was not called.", this.stack );
            } else if ( this.expected !== null && this.expected !== this.assertions.length ) {
                QUnit.pushFailure( "Expected " + this.expected + " assertions, but " + this.assertions.length + " were run", this.stack );
            } else if ( this.expected === null && !this.assertions.length ) {
                QUnit.pushFailure( "Expected at least one assertion, but none were run - call expect(0) to accept zero assertions.", this.stack );
            }

            var i, assertion, a, b, time, li, ol,
                test = this,
                good = 0,
                bad = 0,
                tests = id( "qunit-tests" );

            this.runtime = +new Date() - this.started;
            config.stats.all += this.assertions.length;
            config.moduleStats.all += this.assertions.length;

            if ( tests ) {
                ol = document.createElement( "ol" );
                ol.className = "qunit-assert-list";

                for ( i = 0; i < this.assertions.length; i++ ) {
                    assertion = this.assertions[i];

                    li = document.createElement( "li" );
                    li.className = assertion.result ? "pass" : "fail";
                    li.innerHTML = assertion.message || ( assertion.result ? "okay" : "failed" );
                    ol.appendChild( li );

                    if ( assertion.result ) {
                        good++;
                    } else {
                        bad++;
                        config.stats.bad++;
                        config.moduleStats.bad++;
                    }
                }

                // store result when possible
                if ( QUnit.config.reorder && defined.sessionStorage ) {
                    if ( bad ) {
                        sessionStorage.setItem( "qunit-test-" + this.module + "-" + this.testName, bad );
                    } else {
                        sessionStorage.removeItem( "qunit-test-" + this.module + "-" + this.testName );
                    }
                }

                if ( bad === 0 ) {
                    addClass( ol, "qunit-collapsed" );
                }

                // `b` initialized at top of scope
                b = document.createElement( "strong" );
                b.innerHTML = this.nameHtml + " <b class='counts'>(<b class='failed'>" + bad + "</b>, <b class='passed'>" + good + "</b>, " + this.assertions.length + ")</b>";

                addEvent(b, "click", function() {
                    var next = b.parentNode.lastChild,
                        collapsed = hasClass( next, "qunit-collapsed" );
                    ( collapsed ? removeClass : addClass )( next, "qunit-collapsed" );
                });

                addEvent(b, "dblclick", function( e ) {
                    var target = e && e.target ? e.target : window.event.srcElement;
                    if ( target.nodeName.toLowerCase() === "span" || target.nodeName.toLowerCase() === "b" ) {
                        target = target.parentNode;
                    }
                    if ( window.location && target.nodeName.toLowerCase() === "strong" ) {
                        window.location = QUnit.url({ testNumber: test.testNumber });
                    }
                });

                // `time` initialized at top of scope
                time = document.createElement( "span" );
                time.className = "runtime";
                time.innerHTML = this.runtime + " ms";

                // `li` initialized at top of scope
                li = id( this.id );
                li.className = bad ? "fail" : "pass";
                li.removeChild( li.firstChild );
                a = li.firstChild;
                li.appendChild( b );
                li.appendChild( a );
                li.appendChild( time );
                li.appendChild( ol );

            } else {
                for ( i = 0; i < this.assertions.length; i++ ) {
                    if ( !this.assertions[i].result ) {
                        bad++;
                        config.stats.bad++;
                        config.moduleStats.bad++;
                    }
                }
            }

            runLoggingCallbacks( "testDone", QUnit, {
                name: this.testName,
                module: this.module,
                failed: bad,
                passed: this.assertions.length - bad,
                total: this.assertions.length,
                duration: this.runtime
            });

            QUnit.reset();

            config.current = undefined;
        },

        queue: function() {
            var bad,
                test = this;

            synchronize(function() {
                test.init();
            });
            function run() {
                // each of these can by async
                synchronize(function() {
                    test.setup();
                });
                synchronize(function() {
                    test.run();
                });
                synchronize(function() {
                    test.teardown();
                });
                synchronize(function() {
                    test.finish();
                });
            }

            // `bad` initialized at top of scope
            // defer when previous test run passed, if storage is available
            bad = QUnit.config.reorder && defined.sessionStorage &&
                +sessionStorage.getItem( "qunit-test-" + this.module + "-" + this.testName );

            if ( bad ) {
                run();
            } else {
                synchronize( run, true );
            }
        }
    };

// Root QUnit object.
// `QUnit` initialized at top of scope
    QUnit = {

        // call on start of module test to prepend name to all tests
        module: function( name, testEnvironment ) {
            config.currentModule = name;
            config.currentModuleTestEnvironment = testEnvironment;
            config.modules[name] = true;
        },

        asyncTest: function( testName, expected, callback ) {
            if ( arguments.length === 2 ) {
                callback = expected;
                expected = null;
            }

            QUnit.test( testName, expected, callback, true );
        },

        test: function( testName, expected, callback, async ) {
            var test,
                nameHtml = "<span class='test-name'>" + escapeText( testName ) + "</span>";

            if ( arguments.length === 2 ) {
                callback = expected;
                expected = null;
            }

            if ( config.currentModule ) {
                nameHtml = "<span class='module-name'>" + escapeText( config.currentModule ) + "</span>: " + nameHtml;
            }

            test = new Test({
                nameHtml: nameHtml,
                testName: testName,
                expected: expected,
                async: async,
                callback: callback,
                module: config.currentModule,
                moduleTestEnvironment: config.currentModuleTestEnvironment,
                stack: sourceFromStacktrace( 2 )
            });

            if ( !validTest( test ) ) {
                return;
            }

            test.queue();
        },

        // Specify the number of expected assertions to gurantee that failed test (no assertions are run at all) don't slip through.
        expect: function( asserts ) {
            if (arguments.length === 1) {
                config.current.expected = asserts;
            } else {
                return config.current.expected;
            }
        },

        start: function( count ) {
            // QUnit hasn't been initialized yet.
            // Note: RequireJS (et al) may delay onLoad
            if ( config.semaphore === undefined ) {
                QUnit.begin(function() {
                    // This is triggered at the top of QUnit.load, push start() to the event loop, to allow QUnit.load to finish first
                    setTimeout(function() {
                        QUnit.start( count );
                    });
                });
                return;
            }

            config.semaphore -= count || 1;
            // don't start until equal number of stop-calls
            if ( config.semaphore > 0 ) {
                return;
            }
            // ignore if start is called more often then stop
            if ( config.semaphore < 0 ) {
                config.semaphore = 0;
                QUnit.pushFailure( "Called start() while already started (QUnit.config.semaphore was 0 already)", null, sourceFromStacktrace(2) );
                return;
            }
            // A slight delay, to avoid any current callbacks
            if ( defined.setTimeout ) {
                window.setTimeout(function() {
                    if ( config.semaphore > 0 ) {
                        return;
                    }
                    if ( config.timeout ) {
                        clearTimeout( config.timeout );
                    }

                    config.blocking = false;
                    process( true );
                }, 13);
            } else {
                config.blocking = false;
                process( true );
            }
        },

        stop: function( count ) {
            config.semaphore += count || 1;
            config.blocking = true;

            if ( config.testTimeout && defined.setTimeout ) {
                clearTimeout( config.timeout );
                config.timeout = window.setTimeout(function() {
                    QUnit.ok( false, "Test timed out" );
                    config.semaphore = 1;
                    QUnit.start();
                }, config.testTimeout );
            }
        }
    };

// `assert` initialized at top of scope
// Asssert helpers
// All of these must either call QUnit.push() or manually do:
// - runLoggingCallbacks( "log", .. );
// - config.current.assertions.push({ .. });
// We attach it to the QUnit object *after* we expose the public API,
// otherwise `assert` will become a global variable in browsers (#341).
    assert = {
        /**
         * Asserts rough true-ish result.
         * @name ok
         * @function
         * @example ok( "asdfasdf".length > 5, "There must be at least 5 chars" );
         */
        ok: function( result, msg ) {
            if ( !config.current ) {
                throw new Error( "ok() assertion outside test context, was " + sourceFromStacktrace(2) );
            }
            result = !!result;

            var source,
                details = {
                    module: config.current.module,
                    name: config.current.testName,
                    result: result,
                    message: msg
                };

            msg = escapeText( msg || (result ? "okay" : "failed" ) );
            msg = "<span class='test-message'>" + msg + "</span>";

            if ( !result ) {
                source = sourceFromStacktrace( 2 );
                if ( source ) {
                    details.source = source;
                    msg += "<table><tr class='test-source'><th>Source: </th><td><pre>" + escapeText( source ) + "</pre></td></tr></table>";
                }
            }
            runLoggingCallbacks( "log", QUnit, details );
            config.current.assertions.push({
                result: result,
                message: msg
            });
        },

        /**
         * Assert that the first two arguments are equal, with an optional message.
         * Prints out both actual and expected values.
         * @name equal
         * @function
         * @example equal( format( "Received {0} bytes.", 2), "Received 2 bytes.", "format() replaces {0} with next argument" );
         */
        equal: function( actual, expected, message ) {
            /*jshint eqeqeq:false */
            QUnit.push( expected == actual, actual, expected, message );
        },

        /**
         * @name notEqual
         * @function
         */
        notEqual: function( actual, expected, message ) {
            /*jshint eqeqeq:false */
            QUnit.push( expected != actual, actual, expected, message );
        },

        /**
         * @name propEqual
         * @function
         */
        propEqual: function( actual, expected, message ) {
            actual = objectValues(actual);
            expected = objectValues(expected);
            QUnit.push( QUnit.equiv(actual, expected), actual, expected, message );
        },

        /**
         * @name notPropEqual
         * @function
         */
        notPropEqual: function( actual, expected, message ) {
            actual = objectValues(actual);
            expected = objectValues(expected);
            QUnit.push( !QUnit.equiv(actual, expected), actual, expected, message );
        },

        /**
         * @name deepEqual
         * @function
         */
        deepEqual: function( actual, expected, message ) {
            QUnit.push( QUnit.equiv(actual, expected), actual, expected, message );
        },

        /**
         * @name notDeepEqual
         * @function
         */
        notDeepEqual: function( actual, expected, message ) {
            QUnit.push( !QUnit.equiv(actual, expected), actual, expected, message );
        },

        /**
         * @name strictEqual
         * @function
         */
        strictEqual: function( actual, expected, message ) {
            QUnit.push( expected === actual, actual, expected, message );
        },

        /**
         * @name notStrictEqual
         * @function
         */
        notStrictEqual: function( actual, expected, message ) {
            QUnit.push( expected !== actual, actual, expected, message );
        },

        "throws": function( block, expected, message ) {
            var actual,
                expectedOutput = expected,
                ok = false;

            // 'expected' is optional
            if ( typeof expected === "string" ) {
                message = expected;
                expected = null;
            }

            config.current.ignoreGlobalErrors = true;
            try {
                block.call( config.current.testEnvironment );
            } catch (e) {
                actual = e;
            }
            config.current.ignoreGlobalErrors = false;

            if ( actual ) {
                // we don't want to validate thrown error
                if ( !expected ) {
                    ok = true;
                    expectedOutput = null;
                    // expected is a regexp
                } else if ( QUnit.objectType( expected ) === "regexp" ) {
                    ok = expected.test( errorString( actual ) );
                    // expected is a constructor
                } else if ( actual instanceof expected ) {
                    ok = true;
                    // expected is a validation function which returns true is validation passed
                } else if ( expected.call( {}, actual ) === true ) {
                    expectedOutput = null;
                    ok = true;
                }

                QUnit.push( ok, actual, expectedOutput, message );
            } else {
                QUnit.pushFailure( message, null, 'No exception was thrown.' );
            }
        }
    };

    /**
     * @deprecate since 1.8.0
     * Kept assertion helpers in root for backwards compatibility.
     */
    extend( QUnit, assert );

    /**
     * @deprecated since 1.9.0
     * Kept root "raises()" for backwards compatibility.
     * (Note that we don't introduce assert.raises).
     */
    QUnit.raises = assert[ "throws" ];

    /**
     * @deprecated since 1.0.0, replaced with error pushes since 1.3.0
     * Kept to avoid TypeErrors for undefined methods.
     */
    QUnit.equals = function() {
        QUnit.push( false, false, false, "QUnit.equals has been deprecated since 2009 (e88049a0), use QUnit.equal instead" );
    };
    QUnit.same = function() {
        QUnit.push( false, false, false, "QUnit.same has been deprecated since 2009 (e88049a0), use QUnit.deepEqual instead" );
    };

// We want access to the constructor's prototype
    (function() {
        function F() {}
        F.prototype = QUnit;
        QUnit = new F();
        // Make F QUnit's constructor so that we can add to the prototype later
        QUnit.constructor = F;
    }());

    /**
     * Config object: Maintain internal state
     * Later exposed as QUnit.config
     * `config` initialized at top of scope
     */
    config = {
        // The queue of tests to run
        queue: [],

        // block until document ready
        blocking: true,

        // when enabled, show only failing tests
        // gets persisted through sessionStorage and can be changed in UI via checkbox
        hidepassed: false,

        // by default, run previously failed tests first
        // very useful in combination with "Hide passed tests" checked
        reorder: true,

        // by default, modify document.title when suite is done
        altertitle: true,

        // when enabled, all tests must call expect()
        requireExpects: false,

        // add checkboxes that are persisted in the query-string
        // when enabled, the id is set to `true` as a `QUnit.config` property
        urlConfig: [
            {
                id: "noglobals",
                label: "Check for Globals",
                tooltip: "Enabling this will test if any test introduces new properties on the `window` object. Stored as query-strings."
            },
            {
                id: "notrycatch",
                label: "No try-catch",
                tooltip: "Enabling this will run tests outside of a try-catch block. Makes debugging exceptions in IE reasonable. Stored as query-strings."
            }
        ],

        // Set of all modules.
        modules: {},

        // logging callback queues
        begin: [],
        done: [],
        log: [],
        testStart: [],
        testDone: [],
        moduleStart: [],
        moduleDone: []
    };

// Export global variables, unless an 'exports' object exists,
// in that case we assume we're in CommonJS (dealt with on the bottom of the script)
    if ( typeof exports === "undefined" ) {
        extend( window, QUnit );

        // Expose QUnit object
        window.QUnit = QUnit;
    }

// Initialize more QUnit.config and QUnit.urlParams
    (function() {
        var i,
            location = window.location || { search: "", protocol: "file:" },
            params = location.search.slice( 1 ).split( "&" ),
            length = params.length,
            urlParams = {},
            current;

        if ( params[ 0 ] ) {
            for ( i = 0; i < length; i++ ) {
                current = params[ i ].split( "=" );
                current[ 0 ] = decodeURIComponent( current[ 0 ] );
                // allow just a key to turn on a flag, e.g., test.html?noglobals
                current[ 1 ] = current[ 1 ] ? decodeURIComponent( current[ 1 ] ) : true;
                urlParams[ current[ 0 ] ] = current[ 1 ];
            }
        }

        QUnit.urlParams = urlParams;

        // String search anywhere in moduleName+testName
        config.filter = urlParams.filter;

        // Exact match of the module name
        config.module = urlParams.module;

        config.testNumber = parseInt( urlParams.testNumber, 10 ) || null;

        // Figure out if we're running the tests from a server or not
        QUnit.isLocal = location.protocol === "file:";
    }());

// Extend QUnit object,
// these after set here because they should not be exposed as global functions
    extend( QUnit, {
        assert: assert,

        config: config,

        // Initialize the configuration options
        init: function() {
            extend( config, {
                stats: { all: 0, bad: 0 },
                moduleStats: { all: 0, bad: 0 },
                started: +new Date(),
                updateRate: 1000,
                blocking: false,
                autostart: true,
                autorun: false,
                filter: "",
                queue: [],
                semaphore: 1
            });

            var tests, banner, result,
                qunit = id( "qunit" );

            if ( qunit ) {
                qunit.innerHTML =
                    "<h1 id='qunit-header'>" + escapeText( document.title ) + "</h1>" +
                        "<h2 id='qunit-banner'></h2>" +
                        "<div id='qunit-testrunner-toolbar'></div>" +
                        "<h2 id='qunit-userAgent'></h2>" +
                        "<ol id='qunit-tests'></ol>";
            }

            tests = id( "qunit-tests" );
            banner = id( "qunit-banner" );
            result = id( "qunit-testresult" );

            if ( tests ) {
                tests.innerHTML = "";
            }

            if ( banner ) {
                banner.className = "";
            }

            if ( result ) {
                result.parentNode.removeChild( result );
            }

            if ( tests ) {
                result = document.createElement( "p" );
                result.id = "qunit-testresult";
                result.className = "result";
                tests.parentNode.insertBefore( result, tests );
                result.innerHTML = "Running...<br/>&nbsp;";
            }
        },

        // Resets the test setup. Useful for tests that modify the DOM.
        reset: function() {
            var fixture = id( "qunit-fixture" );
            if ( fixture ) {
                fixture.innerHTML = config.fixture;
            }
        },

        // Trigger an event on an element.
        // @example triggerEvent( document.body, "click" );
        triggerEvent: function( elem, type, event ) {
            if ( document.createEvent ) {
                event = document.createEvent( "MouseEvents" );
                event.initMouseEvent(type, true, true, elem.ownerDocument.defaultView,
                    0, 0, 0, 0, 0, false, false, false, false, 0, null);

                elem.dispatchEvent( event );
            } else if ( elem.fireEvent ) {
                elem.fireEvent( "on" + type );
            }
        },

        // Safe object type checking
        is: function( type, obj ) {
            return QUnit.objectType( obj ) === type;
        },

        objectType: function( obj ) {
            if ( typeof obj === "undefined" ) {
                return "undefined";
                // consider: typeof null === object
            }
            if ( obj === null ) {
                return "null";
            }

            var match = toString.call( obj ).match(/^\[object\s(.*)\]$/),
                type = match && match[1] || "";

            switch ( type ) {
                case "Number":
                    if ( isNaN(obj) ) {
                        return "nan";
                    }
                    return "number";
                case "String":
                case "Boolean":
                case "Array":
                case "Date":
                case "RegExp":
                case "Function":
                    return type.toLowerCase();
            }
            if ( typeof obj === "object" ) {
                return "object";
            }
            return undefined;
        },

        push: function( result, actual, expected, message ) {
            if ( !config.current ) {
                throw new Error( "assertion outside test context, was " + sourceFromStacktrace() );
            }

            var output, source,
                details = {
                    module: config.current.module,
                    name: config.current.testName,
                    result: result,
                    message: message,
                    actual: actual,
                    expected: expected
                };

            message = escapeText( message ) || ( result ? "okay" : "failed" );
            message = "<span class='test-message'>" + message + "</span>";
            output = message;

            if ( !result ) {
                expected = escapeText( QUnit.jsDump.parse(expected) );
                actual = escapeText( QUnit.jsDump.parse(actual) );
                output += "<table><tr class='test-expected'><th>Expected: </th><td><pre>" + expected + "</pre></td></tr>";

                if ( actual !== expected ) {
                    output += "<tr class='test-actual'><th>Result: </th><td><pre>" + actual + "</pre></td></tr>";
                    output += "<tr class='test-diff'><th>Diff: </th><td><pre>" + QUnit.diff( expected, actual ) + "</pre></td></tr>";
                }

                source = sourceFromStacktrace();

                if ( source ) {
                    details.source = source;
                    output += "<tr class='test-source'><th>Source: </th><td><pre>" + escapeText( source ) + "</pre></td></tr>";
                }

                output += "</table>";
            }

            runLoggingCallbacks( "log", QUnit, details );

            config.current.assertions.push({
                result: !!result,
                message: output
            });
        },

        pushFailure: function( message, source, actual ) {
            if ( !config.current ) {
                throw new Error( "pushFailure() assertion outside test context, was " + sourceFromStacktrace(2) );
            }

            var output,
                details = {
                    module: config.current.module,
                    name: config.current.testName,
                    result: false,
                    message: message
                };

            message = escapeText( message ) || "error";
            message = "<span class='test-message'>" + message + "</span>";
            output = message;

            output += "<table>";

            if ( actual ) {
                output += "<tr class='test-actual'><th>Result: </th><td><pre>" + escapeText( actual ) + "</pre></td></tr>";
            }

            if ( source ) {
                details.source = source;
                output += "<tr class='test-source'><th>Source: </th><td><pre>" + escapeText( source ) + "</pre></td></tr>";
            }

            output += "</table>";

            runLoggingCallbacks( "log", QUnit, details );

            config.current.assertions.push({
                result: false,
                message: output
            });
        },

        url: function( params ) {
            params = extend( extend( {}, QUnit.urlParams ), params );
            var key,
                querystring = "?";

            for ( key in params ) {
                if ( !hasOwn.call( params, key ) ) {
                    continue;
                }
                querystring += encodeURIComponent( key ) + "=" +
                    encodeURIComponent( params[ key ] ) + "&";
            }
            return window.location.protocol + "//" + window.location.host +
                window.location.pathname + querystring.slice( 0, -1 );
        },

        extend: extend,
        id: id,
        addEvent: addEvent
        // load, equiv, jsDump, diff: Attached later
    });

    /**
     * @deprecated: Created for backwards compatibility with test runner that set the hook function
     * into QUnit.{hook}, instead of invoking it and passing the hook function.
     * QUnit.constructor is set to the empty F() above so that we can add to it's prototype here.
     * Doing this allows us to tell if the following methods have been overwritten on the actual
     * QUnit object.
     */
    extend( QUnit.constructor.prototype, {

        // Logging callbacks; all receive a single argument with the listed properties
        // run test/logs.html for any related changes
        begin: registerLoggingCallback( "begin" ),

        // done: { failed, passed, total, runtime }
        done: registerLoggingCallback( "done" ),

        // log: { result, actual, expected, message }
        log: registerLoggingCallback( "log" ),

        // testStart: { name }
        testStart: registerLoggingCallback( "testStart" ),

        // testDone: { name, failed, passed, total, duration }
        testDone: registerLoggingCallback( "testDone" ),

        // moduleStart: { name }
        moduleStart: registerLoggingCallback( "moduleStart" ),

        // moduleDone: { name, failed, passed, total }
        moduleDone: registerLoggingCallback( "moduleDone" )
    });

    if ( typeof document === "undefined" || document.readyState === "complete" ) {
        config.autorun = true;
    }

    QUnit.load = function() {
        runLoggingCallbacks( "begin", QUnit, {} );

        // Initialize the config, saving the execution queue
        var banner, filter, i, label, len, main, ol, toolbar, userAgent, val,
            urlConfigCheckboxesContainer, urlConfigCheckboxes, moduleFilter,
            numModules = 0,
            moduleFilterHtml = "",
            urlConfigHtml = "",
            oldconfig = extend( {}, config );

        QUnit.init();
        extend(config, oldconfig);

        config.blocking = false;

        len = config.urlConfig.length;

        for ( i = 0; i < len; i++ ) {
            val = config.urlConfig[i];
            if ( typeof val === "string" ) {
                val = {
                    id: val,
                    label: val,
                    tooltip: "[no tooltip available]"
                };
            }
            config[ val.id ] = QUnit.urlParams[ val.id ];
            urlConfigHtml += "<input id='qunit-urlconfig-" + escapeText( val.id ) +
                "' name='" + escapeText( val.id ) +
                "' type='checkbox'" + ( config[ val.id ] ? " checked='checked'" : "" ) +
                " title='" + escapeText( val.tooltip ) +
                "'><label for='qunit-urlconfig-" + escapeText( val.id ) +
                "' title='" + escapeText( val.tooltip ) + "'>" + val.label + "</label>";
        }

        moduleFilterHtml += "<label for='qunit-modulefilter'>Module: </label><select id='qunit-modulefilter' name='modulefilter'><option value='' " +
            ( config.module === undefined  ? "selected='selected'" : "" ) +
            ">< All Modules ></option>";

        for ( i in config.modules ) {
            if ( config.modules.hasOwnProperty( i ) ) {
                numModules += 1;
                moduleFilterHtml += "<option value='" + escapeText( encodeURIComponent(i) ) + "' " +
                    ( config.module === i ? "selected='selected'" : "" ) +
                    ">" + escapeText(i) + "</option>";
            }
        }
        moduleFilterHtml += "</select>";

        // `userAgent` initialized at top of scope
        userAgent = id( "qunit-userAgent" );
        if ( userAgent ) {
            userAgent.innerHTML = navigator.userAgent;
        }

        // `banner` initialized at top of scope
        banner = id( "qunit-header" );
        if ( banner ) {
            banner.innerHTML = "<a href='" + QUnit.url({ filter: undefined, module: undefined, testNumber: undefined }) + "'>" + banner.innerHTML + "</a> ";
        }

        // `toolbar` initialized at top of scope
        toolbar = id( "qunit-testrunner-toolbar" );
        if ( toolbar ) {
            // `filter` initialized at top of scope
            filter = document.createElement( "input" );
            filter.type = "checkbox";
            filter.id = "qunit-filter-pass";

            addEvent( filter, "click", function() {
                var tmp,
                    ol = document.getElementById( "qunit-tests" );

                if ( filter.checked ) {
                    ol.className = ol.className + " hidepass";
                } else {
                    tmp = " " + ol.className.replace( /[\n\t\r]/g, " " ) + " ";
                    ol.className = tmp.replace( / hidepass /, " " );
                }
                if ( defined.sessionStorage ) {
                    if (filter.checked) {
                        sessionStorage.setItem( "qunit-filter-passed-tests", "true" );
                    } else {
                        sessionStorage.removeItem( "qunit-filter-passed-tests" );
                    }
                }
            });

            if ( config.hidepassed || defined.sessionStorage && sessionStorage.getItem( "qunit-filter-passed-tests" ) ) {
                filter.checked = true;
                // `ol` initialized at top of scope
                ol = document.getElementById( "qunit-tests" );
                ol.className = ol.className + " hidepass";
            }
            toolbar.appendChild( filter );

            // `label` initialized at top of scope
            label = document.createElement( "label" );
            label.setAttribute( "for", "qunit-filter-pass" );
            label.setAttribute( "title", "Only show tests and assertons that fail. Stored in sessionStorage." );
            label.innerHTML = "Hide passed tests";
            toolbar.appendChild( label );

            urlConfigCheckboxesContainer = document.createElement("span");
            urlConfigCheckboxesContainer.innerHTML = urlConfigHtml;
            urlConfigCheckboxes = urlConfigCheckboxesContainer.getElementsByTagName("input");
            // For oldIE support:
            // * Add handlers to the individual elements instead of the container
            // * Use "click" instead of "change"
            // * Fallback from event.target to event.srcElement
            addEvents( urlConfigCheckboxes, "click", function( event ) {
                var params = {},
                    target = event.target || event.srcElement;
                params[ target.name ] = target.checked ? true : undefined;
                window.location = QUnit.url( params );
            });
            toolbar.appendChild( urlConfigCheckboxesContainer );

            if (numModules > 1) {
                moduleFilter = document.createElement( 'span' );
                moduleFilter.setAttribute( 'id', 'qunit-modulefilter-container' );
                moduleFilter.innerHTML = moduleFilterHtml;
                addEvent( moduleFilter.lastChild, "change", function() {
                    var selectBox = moduleFilter.getElementsByTagName("select")[0],
                        selectedModule = decodeURIComponent(selectBox.options[selectBox.selectedIndex].value);

                    window.location = QUnit.url( { module: ( selectedModule === "" ) ? undefined : selectedModule } );
                });
                toolbar.appendChild(moduleFilter);
            }
        }

        // `main` initialized at top of scope
        main = id( "qunit-fixture" );
        if ( main ) {
            config.fixture = main.innerHTML;
        }

        if ( config.autostart ) {
            QUnit.start();
        }
    };

    addEvent( window, "load", QUnit.load );

// `onErrorFnPrev` initialized at top of scope
// Preserve other handlers
    onErrorFnPrev = window.onerror;

// Cover uncaught exceptions
// Returning true will surpress the default browser handler,
// returning false will let it run.
    window.onerror = function ( error, filePath, linerNr ) {
        var ret = false;
        if ( onErrorFnPrev ) {
            ret = onErrorFnPrev( error, filePath, linerNr );
        }

        // Treat return value as window.onerror itself does,
        // Only do our handling if not surpressed.
        if ( ret !== true ) {
            if ( QUnit.config.current ) {
                if ( QUnit.config.current.ignoreGlobalErrors ) {
                    return true;
                }
                QUnit.pushFailure( error, filePath + ":" + linerNr );
            } else {
                QUnit.test( "global failure", extend( function() {
                    QUnit.pushFailure( error, filePath + ":" + linerNr );
                }, { validTest: validTest } ) );
            }
            return false;
        }

        return ret;
    };

    function done() {
        config.autorun = true;

        // Log the last module results
        if ( config.currentModule ) {
            runLoggingCallbacks( "moduleDone", QUnit, {
                name: config.currentModule,
                failed: config.moduleStats.bad,
                passed: config.moduleStats.all - config.moduleStats.bad,
                total: config.moduleStats.all
            });
        }

        var i, key,
            banner = id( "qunit-banner" ),
            tests = id( "qunit-tests" ),
            runtime = +new Date() - config.started,
            passed = config.stats.all - config.stats.bad,
            html = [
                "Tests completed in ",
                runtime,
                " milliseconds.<br/>",
                "<span class='passed'>",
                passed,
                "</span> assertions of <span class='total'>",
                config.stats.all,
                "</span> passed, <span class='failed'>",
                config.stats.bad,
                "</span> failed."
            ].join( "" );

        if ( banner ) {
            banner.className = ( config.stats.bad ? "qunit-fail" : "qunit-pass" );
        }

        if ( tests ) {
            id( "qunit-testresult" ).innerHTML = html;
        }

        if ( config.altertitle && typeof document !== "undefined" && document.title ) {
            // show ✖ for good, ✔ for bad suite result in title
            // use escape sequences in case file gets loaded with non-utf-8-charset
            document.title = [
                ( config.stats.bad ? "\u2716" : "\u2714" ),
                document.title.replace( /^[\u2714\u2716] /i, "" )
            ].join( " " );
        }

        // clear own sessionStorage items if all tests passed
        if ( config.reorder && defined.sessionStorage && config.stats.bad === 0 ) {
            // `key` & `i` initialized at top of scope
            for ( i = 0; i < sessionStorage.length; i++ ) {
                key = sessionStorage.key( i++ );
                if ( key.indexOf( "qunit-test-" ) === 0 ) {
                    sessionStorage.removeItem( key );
                }
            }
        }

        // scroll back to top to show results
        if ( window.scrollTo ) {
            window.scrollTo(0, 0);
        }

        runLoggingCallbacks( "done", QUnit, {
            failed: config.stats.bad,
            passed: passed,
            total: config.stats.all,
            runtime: runtime
        });
    }

    /** @return Boolean: true if this test should be ran */
    function validTest( test ) {
        var include,
            filter = config.filter && config.filter.toLowerCase(),
            module = config.module && config.module.toLowerCase(),
            fullName = (test.module + ": " + test.testName).toLowerCase();

        // Internally-generated tests are always valid
        if ( test.callback && test.callback.validTest === validTest ) {
            delete test.callback.validTest;
            return true;
        }

        if ( config.testNumber ) {
            return test.testNumber === config.testNumber;
        }

        if ( module && ( !test.module || test.module.toLowerCase() !== module ) ) {
            return false;
        }

        if ( !filter ) {
            return true;
        }

        include = filter.charAt( 0 ) !== "!";
        if ( !include ) {
            filter = filter.slice( 1 );
        }

        // If the filter matches, we need to honour include
        if ( fullName.indexOf( filter ) !== -1 ) {
            return include;
        }

        // Otherwise, do the opposite
        return !include;
    }

// so far supports only Firefox, Chrome and Opera (buggy), Safari (for real exceptions)
// Later Safari and IE10 are supposed to support error.stack as well
// See also https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error/Stack
    function extractStacktrace( e, offset ) {
        offset = offset === undefined ? 3 : offset;

        var stack, include, i;

        if ( e.stacktrace ) {
            // Opera
            return e.stacktrace.split( "\n" )[ offset + 3 ];
        } else if ( e.stack ) {
            // Firefox, Chrome
            stack = e.stack.split( "\n" );
            if (/^error$/i.test( stack[0] ) ) {
                stack.shift();
            }
            if ( fileName ) {
                include = [];
                for ( i = offset; i < stack.length; i++ ) {
                    if ( stack[ i ].indexOf( fileName ) !== -1 ) {
                        break;
                    }
                    include.push( stack[ i ] );
                }
                if ( include.length ) {
                    return include.join( "\n" );
                }
            }
            return stack[ offset ];
        } else if ( e.sourceURL ) {
            // Safari, PhantomJS
            // hopefully one day Safari provides actual stacktraces
            // exclude useless self-reference for generated Error objects
            if ( /qunit.js$/.test( e.sourceURL ) ) {
                return;
            }
            // for actual exceptions, this is useful
            return e.sourceURL + ":" + e.line;
        }
    }
    function sourceFromStacktrace( offset ) {
        try {
            throw new Error();
        } catch ( e ) {
            return extractStacktrace( e, offset );
        }
    }

    /**
     * Escape text for attribute or text content.
     */
    function escapeText( s ) {
        if ( !s ) {
            return "";
        }
        s = s + "";
        // Both single quotes and double quotes (for attributes)
        return s.replace( /['"<>&]/g, function( s ) {
            switch( s ) {
                case '\'':
                    return '&#039;';
                case '"':
                    return '&quot;';
                case '<':
                    return '&lt;';
                case '>':
                    return '&gt;';
                case '&':
                    return '&amp;';
            }
        });
    }

    function synchronize( callback, last ) {
        config.queue.push( callback );

        if ( config.autorun && !config.blocking ) {
            process( last );
        }
    }

    function process( last ) {
        function next() {
            process( last );
        }
        var start = new Date().getTime();
        config.depth = config.depth ? config.depth + 1 : 1;

        while ( config.queue.length && !config.blocking ) {
            if ( !defined.setTimeout || config.updateRate <= 0 || ( ( new Date().getTime() - start ) < config.updateRate ) ) {
                config.queue.shift()();
            } else {
                window.setTimeout( next, 13 );
                break;
            }
        }
        config.depth--;
        if ( last && !config.blocking && !config.queue.length && config.depth === 0 ) {
            done();
        }
    }

    function saveGlobal() {
        config.pollution = [];

        if ( config.noglobals ) {
            for ( var key in window ) {
                // in Opera sometimes DOM element ids show up here, ignore them
                if ( !hasOwn.call( window, key ) || /^qunit-test-output/.test( key ) ) {
                    continue;
                }
                config.pollution.push( key );
            }
        }
    }

    function checkPollution() {
        var newGlobals,
            deletedGlobals,
            old = config.pollution;

        saveGlobal();

        newGlobals = diff( config.pollution, old );
        if ( newGlobals.length > 0 ) {
            QUnit.pushFailure( "Introduced global variable(s): " + newGlobals.join(", ") );
        }

        deletedGlobals = diff( old, config.pollution );
        if ( deletedGlobals.length > 0 ) {
            QUnit.pushFailure( "Deleted global variable(s): " + deletedGlobals.join(", ") );
        }
    }

// returns a new Array with the elements that are in a but not in b
    function diff( a, b ) {
        var i, j,
            result = a.slice();

        for ( i = 0; i < result.length; i++ ) {
            for ( j = 0; j < b.length; j++ ) {
                if ( result[i] === b[j] ) {
                    result.splice( i, 1 );
                    i--;
                    break;
                }
            }
        }
        return result;
    }

    function extend( a, b ) {
        for ( var prop in b ) {
            if ( b[ prop ] === undefined ) {
                delete a[ prop ];

                // Avoid "Member not found" error in IE8 caused by setting window.constructor
            } else if ( prop !== "constructor" || a !== window ) {
                a[ prop ] = b[ prop ];
            }
        }

        return a;
    }

    /**
     * @param {HTMLElement} elem
     * @param {string} type
     * @param {Function} fn
     */
    function addEvent( elem, type, fn ) {
        // Standards-based browsers
        if ( elem.addEventListener ) {
            elem.addEventListener( type, fn, false );
            // IE
        } else {
            elem.attachEvent( "on" + type, fn );
        }
    }

    /**
     * @param {Array|NodeList} elems
     * @param {string} type
     * @param {Function} fn
     */
    function addEvents( elems, type, fn ) {
        var i = elems.length;
        while ( i-- ) {
            addEvent( elems[i], type, fn );
        }
    }

    function hasClass( elem, name ) {
        return (" " + elem.className + " ").indexOf(" " + name + " ") > -1;
    }

    function addClass( elem, name ) {
        if ( !hasClass( elem, name ) ) {
            elem.className += (elem.className ? " " : "") + name;
        }
    }

    function removeClass( elem, name ) {
        var set = " " + elem.className + " ";
        // Class name may appear multiple times
        while ( set.indexOf(" " + name + " ") > -1 ) {
            set = set.replace(" " + name + " " , " ");
        }
        // If possible, trim it for prettiness, but not neccecarily
        elem.className = window.jQuery ? jQuery.trim( set ) : ( set.trim ? set.trim() : set );
    }

    function id( name ) {
        return !!( typeof document !== "undefined" && document && document.getElementById ) &&
            document.getElementById( name );
    }

    function registerLoggingCallback( key ) {
        return function( callback ) {
            config[key].push( callback );
        };
    }

// Supports deprecated method of completely overwriting logging callbacks
    function runLoggingCallbacks( key, scope, args ) {
        var i, callbacks;
        if ( QUnit.hasOwnProperty( key ) ) {
            QUnit[ key ].call(scope, args );
        } else {
            callbacks = config[ key ];
            for ( i = 0; i < callbacks.length; i++ ) {
                callbacks[ i ].call( scope, args );
            }
        }
    }

// Test for equality any JavaScript type.
// Author: Philippe Rathé <prathe@gmail.com>
    QUnit.equiv = (function() {

        // Call the o related callback with the given arguments.
        function bindCallbacks( o, callbacks, args ) {
            var prop = QUnit.objectType( o );
            if ( prop ) {
                if ( QUnit.objectType( callbacks[ prop ] ) === "function" ) {
                    return callbacks[ prop ].apply( callbacks, args );
                } else {
                    return callbacks[ prop ]; // or undefined
                }
            }
        }

        // the real equiv function
        var innerEquiv,
        // stack to decide between skip/abort functions
            callers = [],
        // stack to avoiding loops from circular referencing
            parents = [],

            getProto = Object.getPrototypeOf || function ( obj ) {
                return obj.__proto__;
            },
            callbacks = (function () {

                // for string, boolean, number and null
                function useStrictEquality( b, a ) {
                    /*jshint eqeqeq:false */
                    if ( b instanceof a.constructor || a instanceof b.constructor ) {
                        // to catch short annotaion VS 'new' annotation of a
                        // declaration
                        // e.g. var i = 1;
                        // var j = new Number(1);
                        return a == b;
                    } else {
                        return a === b;
                    }
                }

                return {
                    "string": useStrictEquality,
                    "boolean": useStrictEquality,
                    "number": useStrictEquality,
                    "null": useStrictEquality,
                    "undefined": useStrictEquality,

                    "nan": function( b ) {
                        return isNaN( b );
                    },

                    "date": function( b, a ) {
                        return QUnit.objectType( b ) === "date" && a.valueOf() === b.valueOf();
                    },

                    "regexp": function( b, a ) {
                        return QUnit.objectType( b ) === "regexp" &&
                            // the regex itself
                            a.source === b.source &&
                            // and its modifers
                            a.global === b.global &&
                            // (gmi) ...
                            a.ignoreCase === b.ignoreCase &&
                            a.multiline === b.multiline &&
                            a.sticky === b.sticky;
                    },

                    // - skip when the property is a method of an instance (OOP)
                    // - abort otherwise,
                    // initial === would have catch identical references anyway
                    "function": function() {
                        var caller = callers[callers.length - 1];
                        return caller !== Object && typeof caller !== "undefined";
                    },

                    "array": function( b, a ) {
                        var i, j, len, loop;

                        // b could be an object literal here
                        if ( QUnit.objectType( b ) !== "array" ) {
                            return false;
                        }

                        len = a.length;
                        if ( len !== b.length ) {
                            // safe and faster
                            return false;
                        }

                        // track reference to avoid circular references
                        parents.push( a );
                        for ( i = 0; i < len; i++ ) {
                            loop = false;
                            for ( j = 0; j < parents.length; j++ ) {
                                if ( parents[j] === a[i] ) {
                                    loop = true;// dont rewalk array
                                }
                            }
                            if ( !loop && !innerEquiv(a[i], b[i]) ) {
                                parents.pop();
                                return false;
                            }
                        }
                        parents.pop();
                        return true;
                    },

                    "object": function( b, a ) {
                        var i, j, loop,
                        // Default to true
                            eq = true,
                            aProperties = [],
                            bProperties = [];

                        // comparing constructors is more strict than using
                        // instanceof
                        if ( a.constructor !== b.constructor ) {
                            // Allow objects with no prototype to be equivalent to
                            // objects with Object as their constructor.
                            if ( !(( getProto(a) === null && getProto(b) === Object.prototype ) ||
                                ( getProto(b) === null && getProto(a) === Object.prototype ) ) ) {
                                return false;
                            }
                        }

                        // stack constructor before traversing properties
                        callers.push( a.constructor );
                        // track reference to avoid circular references
                        parents.push( a );

                        for ( i in a ) { // be strict: don't ensures hasOwnProperty
                            // and go deep
                            loop = false;
                            for ( j = 0; j < parents.length; j++ ) {
                                if ( parents[j] === a[i] ) {
                                    // don't go down the same path twice
                                    loop = true;
                                }
                            }
                            aProperties.push(i); // collect a's properties

                            if (!loop && !innerEquiv( a[i], b[i] ) ) {
                                eq = false;
                                break;
                            }
                        }

                        callers.pop(); // unstack, we are done
                        parents.pop();

                        for ( i in b ) {
                            bProperties.push( i ); // collect b's properties
                        }

                        // Ensures identical properties name
                        return eq && innerEquiv( aProperties.sort(), bProperties.sort() );
                    }
                };
            }());

        innerEquiv = function() { // can take multiple arguments
            var args = [].slice.apply( arguments );
            if ( args.length < 2 ) {
                return true; // end transition
            }

            return (function( a, b ) {
                if ( a === b ) {
                    return true; // catch the most you can
                } else if ( a === null || b === null || typeof a === "undefined" ||
                    typeof b === "undefined" ||
                    QUnit.objectType(a) !== QUnit.objectType(b) ) {
                    return false; // don't lose time with error prone cases
                } else {
                    return bindCallbacks(a, callbacks, [ b, a ]);
                }

                // apply transition with (1..n) arguments
            }( args[0], args[1] ) && arguments.callee.apply( this, args.splice(1, args.length - 1 )) );
        };

        return innerEquiv;
    }());

    /**
     * jsDump Copyright (c) 2008 Ariel Flesler - aflesler(at)gmail(dot)com |
     * http://flesler.blogspot.com Licensed under BSD
     * (http://www.opensource.org/licenses/bsd-license.php) Date: 5/15/2008
     *
     * @projectDescription Advanced and extensible data dumping for Javascript.
     * @version 1.0.0
     * @author Ariel Flesler
     * @link {http://flesler.blogspot.com/2008/05/jsdump-pretty-dump-of-any-javascript.html}
     */
    QUnit.jsDump = (function() {
        function quote( str ) {
            return '"' + str.toString().replace( /"/g, '\\"' ) + '"';
        }
        function literal( o ) {
            return o + "";
        }
        function join( pre, arr, post ) {
            var s = jsDump.separator(),
                base = jsDump.indent(),
                inner = jsDump.indent(1);
            if ( arr.join ) {
                arr = arr.join( "," + s + inner );
            }
            if ( !arr ) {
                return pre + post;
            }
            return [ pre, inner + arr, base + post ].join(s);
        }
        function array( arr, stack ) {
            var i = arr.length, ret = new Array(i);
            this.up();
            while ( i-- ) {
                ret[i] = this.parse( arr[i] , undefined , stack);
            }
            this.down();
            return join( "[", ret, "]" );
        }

        var reName = /^function (\w+)/,
            jsDump = {
                // type is used mostly internally, you can fix a (custom)type in advance
                parse: function( obj, type, stack ) {
                    stack = stack || [ ];
                    var inStack, res,
                        parser = this.parsers[ type || this.typeOf(obj) ];

                    type = typeof parser;
                    inStack = inArray( obj, stack );

                    if ( inStack !== -1 ) {
                        return "recursion(" + (inStack - stack.length) + ")";
                    }
                    if ( type === "function" )  {
                        stack.push( obj );
                        res = parser.call( this, obj, stack );
                        stack.pop();
                        return res;
                    }
                    return ( type === "string" ) ? parser : this.parsers.error;
                },
                typeOf: function( obj ) {
                    var type;
                    if ( obj === null ) {
                        type = "null";
                    } else if ( typeof obj === "undefined" ) {
                        type = "undefined";
                    } else if ( QUnit.is( "regexp", obj) ) {
                        type = "regexp";
                    } else if ( QUnit.is( "date", obj) ) {
                        type = "date";
                    } else if ( QUnit.is( "function", obj) ) {
                        type = "function";
                    } else if ( typeof obj.setInterval !== undefined && typeof obj.document !== "undefined" && typeof obj.nodeType === "undefined" ) {
                        type = "window";
                    } else if ( obj.nodeType === 9 ) {
                        type = "document";
                    } else if ( obj.nodeType ) {
                        type = "node";
                    } else if (
                    // native arrays
                        toString.call( obj ) === "[object Array]" ||
                            // NodeList objects
                            ( typeof obj.length === "number" && typeof obj.item !== "undefined" && ( obj.length ? obj.item(0) === obj[0] : ( obj.item( 0 ) === null && typeof obj[0] === "undefined" ) ) )
                        ) {
                        type = "array";
                    } else if ( obj.constructor === Error.prototype.constructor ) {
                        type = "error";
                    } else {
                        type = typeof obj;
                    }
                    return type;
                },
                separator: function() {
                    return this.multiline ?	this.HTML ? "<br />" : "\n" : this.HTML ? "&nbsp;" : " ";
                },
                // extra can be a number, shortcut for increasing-calling-decreasing
                indent: function( extra ) {
                    if ( !this.multiline ) {
                        return "";
                    }
                    var chr = this.indentChar;
                    if ( this.HTML ) {
                        chr = chr.replace( /\t/g, "   " ).replace( / /g, "&nbsp;" );
                    }
                    return new Array( this._depth_ + (extra||0) ).join(chr);
                },
                up: function( a ) {
                    this._depth_ += a || 1;
                },
                down: function( a ) {
                    this._depth_ -= a || 1;
                },
                setParser: function( name, parser ) {
                    this.parsers[name] = parser;
                },
                // The next 3 are exposed so you can use them
                quote: quote,
                literal: literal,
                join: join,
                //
                _depth_: 1,
                // This is the list of parsers, to modify them, use jsDump.setParser
                parsers: {
                    window: "[Window]",
                    document: "[Document]",
                    error: function(error) {
                        return "Error(\"" + error.message + "\")";
                    },
                    unknown: "[Unknown]",
                    "null": "null",
                    "undefined": "undefined",
                    "function": function( fn ) {
                        var ret = "function",
                        // functions never have name in IE
                            name = "name" in fn ? fn.name : (reName.exec(fn) || [])[1];

                        if ( name ) {
                            ret += " " + name;
                        }
                        ret += "( ";

                        ret = [ ret, QUnit.jsDump.parse( fn, "functionArgs" ), "){" ].join( "" );
                        return join( ret, QUnit.jsDump.parse(fn,"functionCode" ), "}" );
                    },
                    array: array,
                    nodelist: array,
                    "arguments": array,
                    object: function( map, stack ) {
                        var ret = [ ], keys, key, val, i;
                        QUnit.jsDump.up();
                        keys = [];
                        for ( key in map ) {
                            keys.push( key );
                        }
                        keys.sort();
                        for ( i = 0; i < keys.length; i++ ) {
                            key = keys[ i ];
                            val = map[ key ];
                            ret.push( QUnit.jsDump.parse( key, "key" ) + ": " + QUnit.jsDump.parse( val, undefined, stack ) );
                        }
                        QUnit.jsDump.down();
                        return join( "{", ret, "}" );
                    },
                    node: function( node ) {
                        var len, i, val,
                            open = QUnit.jsDump.HTML ? "&lt;" : "<",
                            close = QUnit.jsDump.HTML ? "&gt;" : ">",
                            tag = node.nodeName.toLowerCase(),
                            ret = open + tag,
                            attrs = node.attributes;

                        if ( attrs ) {
                            for ( i = 0, len = attrs.length; i < len; i++ ) {
                                val = attrs[i].nodeValue;
                                // IE6 includes all attributes in .attributes, even ones not explicitly set.
                                // Those have values like undefined, null, 0, false, "" or "inherit".
                                if ( val && val !== "inherit" ) {
                                    ret += " " + attrs[i].nodeName + "=" + QUnit.jsDump.parse( val, "attribute" );
                                }
                            }
                        }
                        ret += close;

                        // Show content of TextNode or CDATASection
                        if ( node.nodeType === 3 || node.nodeType === 4 ) {
                            ret += node.nodeValue;
                        }

                        return ret + open + "/" + tag + close;
                    },
                    // function calls it internally, it's the arguments part of the function
                    functionArgs: function( fn ) {
                        var args,
                            l = fn.length;

                        if ( !l ) {
                            return "";
                        }

                        args = new Array(l);
                        while ( l-- ) {
                            // 97 is 'a'
                            args[l] = String.fromCharCode(97+l);
                        }
                        return " " + args.join( ", " ) + " ";
                    },
                    // object calls it internally, the key part of an item in a map
                    key: quote,
                    // function calls it internally, it's the content of the function
                    functionCode: "[code]",
                    // node calls it internally, it's an html attribute value
                    attribute: quote,
                    string: quote,
                    date: quote,
                    regexp: literal,
                    number: literal,
                    "boolean": literal
                },
                // if true, entities are escaped ( <, >, \t, space and \n )
                HTML: false,
                // indentation unit
                indentChar: "  ",
                // if true, items in a collection, are separated by a \n, else just a space.
                multiline: true
            };

        return jsDump;
    }());

// from jquery.js
    function inArray( elem, array ) {
        if ( array.indexOf ) {
            return array.indexOf( elem );
        }

        for ( var i = 0, length = array.length; i < length; i++ ) {
            if ( array[ i ] === elem ) {
                return i;
            }
        }

        return -1;
    }

    /*
     * Javascript Diff Algorithm
     *  By John Resig (http://ejohn.org/)
     *  Modified by Chu Alan "sprite"
     *
     * Released under the MIT license.
     *
     * More Info:
     *  http://ejohn.org/projects/javascript-diff-algorithm/
     *
     * Usage: QUnit.diff(expected, actual)
     *
     * QUnit.diff( "the quick brown fox jumped over", "the quick fox jumps over" ) == "the  quick <del>brown </del> fox <del>jumped </del><ins>jumps </ins> over"
     */
    QUnit.diff = (function() {
        /*jshint eqeqeq:false, eqnull:true */
        function diff( o, n ) {
            var i,
                ns = {},
                os = {};

            for ( i = 0; i < n.length; i++ ) {
                if ( !hasOwn.call( ns, n[i] ) ) {
                    ns[ n[i] ] = {
                        rows: [],
                        o: null
                    };
                }
                ns[ n[i] ].rows.push( i );
            }

            for ( i = 0; i < o.length; i++ ) {
                if ( !hasOwn.call( os, o[i] ) ) {
                    os[ o[i] ] = {
                        rows: [],
                        n: null
                    };
                }
                os[ o[i] ].rows.push( i );
            }

            for ( i in ns ) {
                if ( !hasOwn.call( ns, i ) ) {
                    continue;
                }
                if ( ns[i].rows.length === 1 && hasOwn.call( os, i ) && os[i].rows.length === 1 ) {
                    n[ ns[i].rows[0] ] = {
                        text: n[ ns[i].rows[0] ],
                        row: os[i].rows[0]
                    };
                    o[ os[i].rows[0] ] = {
                        text: o[ os[i].rows[0] ],
                        row: ns[i].rows[0]
                    };
                }
            }

            for ( i = 0; i < n.length - 1; i++ ) {
                if ( n[i].text != null && n[ i + 1 ].text == null && n[i].row + 1 < o.length && o[ n[i].row + 1 ].text == null &&
                    n[ i + 1 ] == o[ n[i].row + 1 ] ) {

                    n[ i + 1 ] = {
                        text: n[ i + 1 ],
                        row: n[i].row + 1
                    };
                    o[ n[i].row + 1 ] = {
                        text: o[ n[i].row + 1 ],
                        row: i + 1
                    };
                }
            }

            for ( i = n.length - 1; i > 0; i-- ) {
                if ( n[i].text != null && n[ i - 1 ].text == null && n[i].row > 0 && o[ n[i].row - 1 ].text == null &&
                    n[ i - 1 ] == o[ n[i].row - 1 ]) {

                    n[ i - 1 ] = {
                        text: n[ i - 1 ],
                        row: n[i].row - 1
                    };
                    o[ n[i].row - 1 ] = {
                        text: o[ n[i].row - 1 ],
                        row: i - 1
                    };
                }
            }

            return {
                o: o,
                n: n
            };
        }

        return function( o, n ) {
            o = o.replace( /\s+$/, "" );
            n = n.replace( /\s+$/, "" );

            var i, pre,
                str = "",
                out = diff( o === "" ? [] : o.split(/\s+/), n === "" ? [] : n.split(/\s+/) ),
                oSpace = o.match(/\s+/g),
                nSpace = n.match(/\s+/g);

            if ( oSpace == null ) {
                oSpace = [ " " ];
            }
            else {
                oSpace.push( " " );
            }

            if ( nSpace == null ) {
                nSpace = [ " " ];
            }
            else {
                nSpace.push( " " );
            }

            if ( out.n.length === 0 ) {
                for ( i = 0; i < out.o.length; i++ ) {
                    str += "<del>" + out.o[i] + oSpace[i] + "</del>";
                }
            }
            else {
                if ( out.n[0].text == null ) {
                    for ( n = 0; n < out.o.length && out.o[n].text == null; n++ ) {
                        str += "<del>" + out.o[n] + oSpace[n] + "</del>";
                    }
                }

                for ( i = 0; i < out.n.length; i++ ) {
                    if (out.n[i].text == null) {
                        str += "<ins>" + out.n[i] + nSpace[i] + "</ins>";
                    }
                    else {
                        // `pre` initialized at top of scope
                        pre = "";

                        for ( n = out.n[i].row + 1; n < out.o.length && out.o[n].text == null; n++ ) {
                            pre += "<del>" + out.o[n] + oSpace[n] + "</del>";
                        }
                        str += " " + out.n[i].text + nSpace[i] + pre;
                    }
                }
            }

            return str;
        };
    }());

// for CommonJS enviroments, export everything
    if ( typeof exports !== "undefined" ) {
        extend( exports, QUnit );
    }

// get at whatever the global object is, like window in browsers
}( (function() {return this;}.call()) ));
define("qunit", (function (global) {
    return function () {
        var ret, fn;
       fn = function () {
                QUnit.config.autoload = false;
                QUnit.config.autostart = false;
            };
        ret = fn.apply(global, arguments);
        return ret || global.QUnit;
    };
}(this)));

/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Tests for the donation-model
 *
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('tests/model/donation',[
    'jquery',
    'underscore',
    'backbone',
    'model/donation'
], function ($, _, Backbone, DonationModel) {
    

    var run = function () {
        module('About the donation-model', {
            setup: function () {
            }
        });
        /* Test default values */


        /* Test changed values */

        /* Test session storage values */

        test('Changing the donation-amount after comma.', function () {
            var model = new DonationModel();
            model.set({donationAmountAfterComma: 22});

            ok(22 === model.get('donationAmountAfterComma'));
        });
        test('Changing the donation-amount before comma.', function () {
            var model = new DonationModel();
            model.set({donationAmountAbsolute: 150});

            ok(150 === model.get('donationAmountAbsolute'));
        });
        test('Change before and after value and receive the correct complete donation-value.', function () {
            var model = new DonationModel();
            model.set({donationAmountAbsolute: 55});
            model.set({donationAmountAfterComma: 99});
            ok('55,99' === model.get('donationAmount').toString());
        });
        test('Change the currency-delimiter and receive the correct donation-amount with new delimiter.', function () {
            var model = new DonationModel();
            model.set({donationAmountAbsolute: 50});
            model.set({donationAmountAfterComma: 50});
            model.set({currencyDelimiter: ','});

            ok('50,50' === model.get('donationAmount').toString());
        });
        test('Change the currency and receive the correct currency.', function () {
            var model = new DonationModel();
            model.set({currency: '€'});

            ok('€' === model.get('currency'));
        });
    };
    return {run: run};
});
/*global define*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Initialize the router
 *
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('tests/testMain',[
    'qunit',
    'tests/model/donation'
], function (QUnit, donationTest) {
    
    return {
        init: function () {
            QUnit.stop();

            // start QUnit.
            QUnit.load();
            QUnit.start();

            // run the tests.
            donationTest.run();
        }
    };
});
/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Defines the routes of the appliation
 *
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('router',[
    'jquery',
    'underscore',
    'backbone',
    'view/donationModule',
    'model/donation',
    'collection/shareModule',
    'collection/receiver',
    'view/donationForm',
    'view/shareModule',
    'tests/testMain'
], function ($, _, Backbone, DonationModuleView, DonationModel, ShareModuleCollection, ReceiverCollection, DonationFormView, ShareModuleView, TestEnvironment) {
    
    var AppRouter = Backbone.Router.extend({
        routes: {
            '*actions': 'defaultAction'
        }
    }),
        initialize = function () {
            var app_router = new AppRouter();
            app_router.on('route:defaultAction', function () {

                var donationModel = new DonationModel(),
                    receiverCollection = new ReceiverCollection(null, {'clientID' : 1001}),
                    shareModuleCollection = new ShareModuleCollection(),
                    donationFormView = new DonationFormView({model: donationModel, collection: receiverCollection});

                shareModuleCollection.add({
                    'imgSrc'        :       'https://0ce8ff584bf613ee6639-c1fc539e0df6af03ccc14b5020ab4161.ssl.cf1.rackcdn.com/share_on_facebook.png',
                    'service'       :       'facebook'
                });

                shareModuleCollection.add({
                    'imgSrc'        :       'https://0ce8ff584bf613ee6639-c1fc539e0df6af03ccc14b5020ab4161.ssl.cf1.rackcdn.com/tweet_on_twitter.png',
                    'service'       :       'twitter'
                });

                var donModule = new DonationModuleView({model: donationModel, receiverCollection: receiverCollection}),
                    shareModule = new ShareModuleView({collection: shareModuleCollection});

                donationFormView.render();
                shareModule.render();
                donModule.render();

                TestEnvironment.init();
            });
            Backbone.history.start();
        };
    return {
        initialize: initialize
    };
});
/*global define*/
/*jslint nomen: true*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Initialize the router
 *
 * @author roland@elefunds.de (Roland Luckenhuber)
 */
define('app',[
    'jquery',
    'underscore',
    'backbone',
    'router'
], function ($, _, Backbone, Router) {
    
    var initialize = function () {
        Router.initialize();
    };

    return {
        initialize: initialize
    };
});
/*global require*/

/**
 * elefunds API Frontend SDK
 *
 * Copyright (c) 2013, elefunds GmbH <hello@elefunds.de>.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *
 *   * Neither the name of the elefunds GmbH nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 * FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 */

/**
 * Entry-point of the application
 * Initializes the application
 *
 * @author roland@elefunds.de (Roland Luckenhuber)
 */

require.config({
    paths: {
        jquery: '../lib/zepto',
        underscore: '../lib/underscore',
        backbone: '../lib/backbone',
        qunit: '../lib/qunit',
        sliderPlugin: '../lib/slider'
    },
    shim: {
        underscore: {
            exports: '_'
        },
        jquery: {
            exports: '$'
        },
        qunit: {
            exports: 'QUnit',
            init: function() {
                QUnit.config.autoload = false;
                QUnit.config.autostart = false;
            }
        },
        backbone: {
            deps: ["underscore", "jquery"],
            exports: "Backbone"
        },
        sliderPlugin: {
            deps: ["jquery"],
            exports: "SliderPlugin"
        }
    },
    /**
     * Sets the locale for handling translations
     */
    locale: 'en'
});

require([
    'app'
], function (App) {
    
    App.initialize();
});
define("main", function(){});

//@ sourceMappingURL=lfnds_application.js.map
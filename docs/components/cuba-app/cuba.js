var cuba;
(function (cuba) {
    var apps = [];
    function initializeApp(config) {
        if (getApp(config.name) != null) {
            throw new Error("Cuba app is already initialized");
        }
        var cubaApp = new CubaApp(config.name, config.apiUrl, config.restClientId, config.restClientSecret, config.defaultLocale);
        apps.push(cubaApp);
        return cubaApp;
    }
    cuba.initializeApp = initializeApp;
    function getApp(appName) {
        var nameToSearch = appName == null ? "" : appName;
        for (var i = 0; i < apps.length; i++) {
            if (apps[i].name === nameToSearch) {
                return apps[i];
            }
        }
        return null;
    }
    cuba.getApp = getApp;
    var CubaApp = (function () {
        function CubaApp(name, apiUrl, restClientId, restClientSecret, defaultLocale) {
            if (name === void 0) { name = ""; }
            if (apiUrl === void 0) { apiUrl = '/app/rest/'; }
            if (restClientId === void 0) { restClientId = 'client'; }
            if (restClientSecret === void 0) { restClientSecret = 'secret'; }
            if (defaultLocale === void 0) { defaultLocale = 'en'; }
            this.name = name;
            this.apiUrl = apiUrl;
            this.restClientId = restClientId;
            this.restClientSecret = restClientSecret;
            this.defaultLocale = defaultLocale;
            this.tokenExpiryListeners = [];
            this.messagesLoadingListeners = [];
            this.enumsLoadingListeners = [];
            this.localeChangeListeners = [];
        }
        Object.defineProperty(CubaApp.prototype, "restApiToken", {
            get: function () {
                return localStorage.getItem(this.name + "_" + CubaApp.REST_TOKEN_STORAGE_KEY);
            },
            set: function (token) {
                localStorage.setItem(this.name + "_" + CubaApp.REST_TOKEN_STORAGE_KEY, token);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(CubaApp.prototype, "locale", {
            get: function () {
                var storedLocale = localStorage.getItem(this.name + "_" + CubaApp.LOCALE_STORAGE_KEY);
                return storedLocale ? storedLocale : this.defaultLocale;
            },
            set: function (locale) {
                var _this = this;
                localStorage.setItem(this.name + "_" + CubaApp.LOCALE_STORAGE_KEY, locale);
                this.localeChangeListeners.forEach(function (l) { return l(_this.locale); });
            },
            enumerable: true,
            configurable: true
        });
        CubaApp.prototype.login = function (login, password) {
            var _this = this;
            if (login == null)
                login = '';
            if (password == null)
                password = '';
            var fetchOptions = {
                method: 'POST',
                headers: this._getBasicAuthHeaders(),
                body: 'grant_type=password&username=' + encodeURIComponent(login) + '&password=' + encodeURIComponent(password)
            };
            var loginRes = fetch(this.apiUrl + 'v2/oauth/token', fetchOptions)
                .then(this.checkStatus)
                .then(function (resp) { return resp.json(); })
                .then(function (data) {
                _this.restApiToken = data.access_token;
                return data;
            });
            return loginRes;
        };
        CubaApp.prototype.logout = function () {
            var fetchOptions = {
                method: 'POST',
                headers: this._getBasicAuthHeaders(),
                body: "token=" + encodeURIComponent(this.restApiToken),
            };
            this.clearAuthData();
            return fetch(this.apiUrl + 'v2/oauth/revoke', fetchOptions).then(this.checkStatus);
        };
        CubaApp.prototype.loadEntities = function (entityName, options) {
            return this.ajax('GET', 'v2/entities/' + entityName, options, { handleAs: 'json' });
        };
        CubaApp.prototype.loadEntity = function (entityName, id, options) {
            return this.ajax('GET', 'v2/entities/' + entityName + '/' + id, options, { handleAs: 'json' });
        };
        CubaApp.prototype.deleteEntity = function (entityName, id) {
            return this.ajax('DELETE', 'v2/entities/' + entityName + '/' + id);
        };
        CubaApp.prototype.commitEntity = function (entityName, entity) {
            if (entity.id) {
                return this.ajax('PUT', 'v2/entities/' + entityName + '/' + entity.id, JSON.stringify(entity), { handleAs: 'json' });
            }
            else {
                return this.ajax('POST', 'v2/entities/' + entityName, JSON.stringify(entity), { handleAs: 'json' });
            }
        };
        CubaApp.prototype.invokeService = function (serviceName, methodName, params, fetchOptions) {
            return this.ajax('POST', 'v2/services/' + serviceName + '/' + methodName, JSON.stringify(params), fetchOptions);
        };
        CubaApp.prototype.query = function (entityName, queryName, params) {
            return this.ajax('GET', 'v2/queries/' + entityName + '/' + queryName, params, { handleAs: 'json' });
        };
        CubaApp.prototype.queryCount = function (entityName, queryName, params) {
            return this.ajax('GET', 'v2/queries/' + entityName + '/' + queryName + '/count', params);
        };
        CubaApp.prototype.loadMetadata = function () {
            return this.ajax('GET', 'v2/metadata/entities', null, { handleAs: 'json' });
        };
        CubaApp.prototype.loadEntityMetadata = function (entityName) {
            return this.ajax('GET', 'v2/metadata/entities' + '/' + entityName, null, { handleAs: 'json' });
        };
        CubaApp.prototype.loadEntitiesMessages = function () {
            var _this = this;
            var fetchRes = this.ajax('GET', 'v2/messages/entities', null, { handleAs: 'json' });
            fetchRes.then(function (messages) {
                _this.messagesCache = messages;
                _this.messagesLoadingListeners.forEach(function (l) { return l(messages); });
            });
            return fetchRes;
        };
        CubaApp.prototype.loadEnums = function () {
            var _this = this;
            var fetchRes = this.ajax('GET', 'v2/metadata/enums', null, { handleAs: 'json' });
            fetchRes.then(function (enums) {
                _this.enumsCache = enums;
                _this.enumsLoadingListeners.forEach(function (l) { return l(enums); });
            });
            return fetchRes;
        };
        CubaApp.prototype.getPermissions = function () {
            return this.ajax('GET', 'v2/permissions', null, { handleAs: 'json' });
        };
        CubaApp.prototype.getUserInfo = function () {
            return this.ajax('GET', 'v2/userInfo', null, { handleAs: 'json' });
        };
        CubaApp.prototype._getBasicAuthHeaders = function () {
            return {
                "Accept-Language": this.locale,
                "Authorization": "Basic " + btoa(this.restClientId + ':' + this.restClientSecret),
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
            };
        };
        CubaApp.prototype.clearAuthData = function () {
            localStorage.removeItem(this.name + "_" + CubaApp.REST_TOKEN_STORAGE_KEY);
            localStorage.removeItem(this.name + "_" + CubaApp.USER_NAME_STORAGE_KEY);
        };
        CubaApp.prototype.ajax = function (method, path, data, fetchOptions) {
            var _this = this;
            var url = this.apiUrl + path;
            var settings = {
                method: method,
                headers: {
                    "Accept-Language": this.locale
                }
            };
            if (this.restApiToken) {
                settings.headers["Authorization"] = "Bearer " + this.restApiToken;
            }
            if (method == 'POST' || method == 'PUT') {
                settings.body = data;
                settings.headers["Content-Type"] = "application/json; charset=UTF-8";
            }
            if (method == 'GET' && data && Object.keys(data).length > 0) {
                url += '?' + Object.keys(data)
                    .map(function (k) {
                    return encodeURIComponent(k) + "=" + (data[k] != null ? encodeURIComponent(data[k]) : '');
                }).join("&");
            }
            var handleAs = fetchOptions ? fetchOptions.handleAs : undefined;
            switch (handleAs) {
                case "text":
                    settings.headers["Accept"] = "text/html";
                    break;
                case "json":
                    settings.headers["Accept"] = "application/json";
                    break;
            }
            var fetchRes = fetch(url, settings).then(this.checkStatus);
            fetchRes.catch(function (error) {
                if (CubaApp.isTokenExpiredResponse(error.response)) {
                    _this.clearAuthData();
                    _this.tokenExpiryListeners.forEach(function (l) { return l(); });
                }
            });
            return fetchRes.then(function (resp) {
                switch (handleAs) {
                    case "text":
                        return resp.text();
                    case "blob":
                        return resp.blob();
                    case "json":
                        return resp.json();
                    default:
                        return resp.text();
                }
            });
        };
        CubaApp.prototype.onLocaleChange = function (c) {
            var _this = this;
            this.localeChangeListeners.push(c);
            return function () { return _this.localeChangeListeners.splice(_this.localeChangeListeners.indexOf(c), 1); };
        };
        CubaApp.prototype.onTokenExpiry = function (c) {
            var _this = this;
            this.tokenExpiryListeners.push(c);
            return function () { return _this.tokenExpiryListeners.splice(_this.tokenExpiryListeners.indexOf(c), 1); };
        };
        CubaApp.prototype.onEnumsLoaded = function (c) {
            var _this = this;
            this.enumsLoadingListeners.push(c);
            return function () { return _this.enumsLoadingListeners.splice(_this.enumsLoadingListeners.indexOf(c), 1); };
        };
        CubaApp.prototype.onMessagesLoaded = function (c) {
            var _this = this;
            this.messagesLoadingListeners.push(c);
            return function () { return _this.messagesLoadingListeners.splice(_this.messagesLoadingListeners.indexOf(c), 1); };
        };
        CubaApp.prototype.checkStatus = function (response) {
            if (response.status >= 200 && response.status < 300) {
                return response;
            }
            else {
                return Promise.reject({ message: response.statusText, response: response });
            }
        };
        CubaApp.isTokenExpiredResponse = function (resp) {
            return resp && resp.status === 401;
        };
        return CubaApp;
    }());
    CubaApp.REST_TOKEN_STORAGE_KEY = 'cubaAccessToken';
    CubaApp.USER_NAME_STORAGE_KEY = 'cubaUserName';
    CubaApp.LOCALE_STORAGE_KEY = 'cubaLocale';
    cuba.CubaApp = CubaApp;
})(cuba || (cuba = {}));

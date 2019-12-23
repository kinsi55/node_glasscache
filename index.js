const LRU = require("lru-cache");

function buildCacheKey(val, args) {
	//If we dont have any args in the function call we can skip serializing them
	if(args.length)
		return `\u1337 .${val} ${JSON.stringify(args)}`;
	else
		return `\u1337 .${val}\u1337`;
}

module.exports.GlassCache = (targetModel, options = {}) => {
	options = {
		instanceIdKey: targetModel.primaryKeyAttribute,
		instanceMethods: true,
		exposeCache: false,
		cacheOptions: {},
		...options
	};

	const theLru = new LRU({
		max: 1000,
		maxAge: 60000,
		...options.cacheOptions
	});

	if(options.exposeCache)
		targetModel._glasscache = theLru;

	let nextKey;
	let nextMaxAgeOverride;
	let nextTarget;

	function execProxy() {
		return execAndCache(nextKey, nextTarget, this, nextMaxAgeOverride, arguments);
	}

	function execAndCache(cacheKey, target, func, maxAgeOverride, args, isAutoCache = false) {
		let loaded = target[func](...args);
		if(!isAutoCache)
			//In userspace, .cache()<.func()> is what gets called. We need to cache an object containing that function as
			//further calls to the returned cache object will call that function again.
			theLru.set(cacheKey, {[func]: () => loaded}, maxAgeOverride);
		else
			theLru.set(cacheKey, loaded, maxAgeOverride);

		return loaded;
	}

	const catchAll = new Proxy({}, {
		//The bound function is what actually ends up being executed in userspace
		//We're hacking the "name" in trough "this" because `arguments` needs to be
		//passed by the user and we dont actually need a context
		get: (t, name) => execProxy.bind(name)
	});

	/* CLASS METHODS */
	targetModel.cache = (cacheKey, {maxAge, refresh} = {}) => {
		//Prepending user keys with u1338 so they dont collide with auto keys ever
		cacheKey = `\u1338 ${cacheKey}`;

		if(!refresh && theLru.has(cacheKey))
			return theLru.get(cacheKey);

		nextKey = cacheKey;
		nextMaxAgeOverride = maxAge;
		nextTarget = targetModel;

		return catchAll;
	};

	//The cacheAuto calls could be optimized to bypass the proxy
	//but its a difference of single digit to double digit millions of calls per sec.
	//Should not end up being the bottleneck and makes for cleaner code.
	targetModel.cacheAuto = (func, opts) => {
		return (...args) => targetModel.cache(buildCacheKey(func, args), opts)[func](...args);
	};

	/* INSTANCE METHODS */
	if(options.instanceMethods) {
		targetModel.prototype.cache = function(cacheKey, {maxAge, refresh} = {}) {
			if(!this[options.instanceIdKey])
				throw `"${options.instanceIdKey}" needs to be populated to use cache on instances`;

			cacheKey = `I${this[options.instanceIdKey]}\u1338 ${cacheKey}`;

			if(!refresh && theLru.has(cacheKey))
				return theLru.get(cacheKey);

			nextKey = cacheKey;
			nextMaxAgeOverride = maxAge;
			nextTarget = this;

			return catchAll;
		};

		targetModel.prototype.cacheAuto = function(func, opts) {
			return (...args) => {
				if(!this[options.instanceIdKey])
					throw `"${options.instanceIdKey}" needs to be populated to use auto cache on instances`;

				return this.cache(buildCacheKey(func, args), opts)[func](...args);
			};
		};
	}
};
# [Experimental] GlassCache - Highly compatible and easy to use caching solution for anything Promise based

## Why

The main difference of this caching solution compared to others is its broad compatability. I was looking for a caching solution for Sequelize and all solutions I found work by intercepting / handling *certain* function calls and had some drawbacks / issues. With ES6 Proxies being a thing I've asked myself, surely this can be done in a simpler and more transparent fashion. GlassCache aims to have a high compatability for most common use cases without the need to specifically implement them.

## Drawbacks

Due to the nature of how this module is built, adding a no frills way to automatically invalidate cached values might be a rather hard task to do - so keep that in mind when picking the amount of time you want values to be cached / when deciding what you want to cache because right now, once something is cached it stays cached until it expires.

## Usage

As mentioned before, I've built this as I was looking for a caching solution for [Sequelize](https://github.com/sequelize/sequelize), an ORM, so thats what I'll use as an example. It should be easily adaptable to other things.

### Enabling / Integrating GlassCache for a model

```js
const {GlassCache} = require("glasscache");

GlassCache(Foo[, {...glassCacheOptions}]); //Foo is your Model
```

### .cacheAuto() usage

Thankfully *most* Sequelize queries do not require chaining multiple function calls, that is what I've built the convenience method *cacheAuto* for which will construct a cache key by serializing the passed arguments (as JSON)
Notice how instead of actually calling a function called "findByPk" (Like you would with `.cache()`) you're instead calling the function that is returned by your `.cacheAuto()` call, to which you pass the name of the function that you actually want to call. It is built like this to maximize performance. I might add an option that allows for a `.cacheAuto().findByPk()` syntax instead, at the cost of performance.

```js
//Normal, uncached call
let foundFoo = await Foo.findByPk(42, {scope: "withBar"})

//Cached call
let foundFoo = await Foo.cacheAuto("findByPk"[, {...callOptions}])(42, {scope: "withBar"})

//cached instance method call
let bazes = await foundFoo.cacheAuto("getBazes"[, {...callOptions}])()
```

**Do NOT use cacheAuto if, in your contains non-primitive values**
Always make sure that the arguments to your function call can be properly serialized with JSON.stringify, if not you're going to encounter problems.

```js
let found = await Foo.findByPk(42, {include: {model: Bar}}) //Bar is a model, so a Class / function / object, and might get serialized incorrectly
```

If possible, you're better off creating a scope for your include, like in the example above. If unavoidable, you'll need to use the normal [.cache](#cache-usage) method

### .cache() usage

If you're using chained methodcalls in your query, or your query is too complex for cacheAuto *you* need to pass a guranteed unique key identifying your call.

```js
//Simple call
let found = await Foo.cache("42 include Bar where id 1337"[, {...callOptions}]).findByPk(42, {include: {model: Bar, where: {id: 1337}}})

//Chained call
let found = await Foo.unscoped().cache("unscoped 42 include Bar where id 1337"[, {...callOptions}]).findByPk(42, {include: {model: Bar, where: {id: 1337}}})
```

As you might've noticed, the `.cache` call is placed *before the **last call***, instead of before the first one. Due to chained calls being so rare with Sequelize I've not bothered to include special support for them for now, and even this usage is experimental. Use it at your own risk and do your tests.

## Options

### glassCacheOptions:

`instanceIdKey` (`String`): The name of the **unique** primary key to be used for building a cache key on instance calls. Defaults to *Model*.primaryKeyAttribute

`instanceMethods` (`boolean`): Whether GlassCache should be available for instances(Records) of your model. Defaults to **true**

`exposeCache` (`boolean`): Whether the underlying LRU Cache should be exposed on your model as `_glassCache`. Should only be used for debugging / testing purposes

`cacheOptions` (`Object`): Options to pass to the underlying LRU Cache. For the default see below.

### cacheOptions:

GlassCache uses [lru-cache](https://www.npmjs.com/package/lru-cache) internally for storing the cached things. The values passed to it by default are `max: 1000` (Store no more than 1000 values at once) and `maxAge: 60000` (Cached values expire after 1 minute). For further details / more available options check its documentation.

### callOptions:

`maxAge` (`number`): Milliseconds, overrides the models default amount of time this value should be cached. Directly passed to lru caches `set` method

`refresh` (`boolean`): When true, a possibly cached value is bypassed and instead a fresh one is loaded and cached.

## License

MIT
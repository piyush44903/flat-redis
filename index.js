var isBuffer = require('is-buffer')

module.exports = {
	flatten,
	unflatten
};

function flatten (target, opts) {
	opts = opts || { accBlankObjects: true, filterNulls: true };

	var delimiter = opts.delimiter || '.';
	let maxDepth = opts.maxDepth;
	const output = {};

	function step (object, prev, currentDepth) {
		currentDepth = currentDepth || 1
		Object.keys(object).forEach(function (key) {
			var value = object[key]
			var isarray = opts.safe && Array.isArray(value)
			var type = Object.prototype.toString.call(value)
			var isbuffer = isBuffer(value)
			var isobject = (
				type === '[object Object]' ||
				type === '[object Array]'
			)

			var newKey = prev
				? prev + delimiter + key
				: key

			if (!isarray && !isbuffer && isobject && Object.keys(value).length &&
				(!opts.maxDepth || currentDepth < maxDepth)) {
				return step(value, newKey, currentDepth + 1);
			}

			if (opts.accBlankObjects && isobject && Object.keys(value).length === 0) {
				if (Array.isArray(value)) {
					output[newKey] = 'E_ARR';
				} else {
					output[newKey] = 'E_OBJ';
				}
				if (newKey !== 'E_ARR' && newKey !== 'E_OBJ') {
					cpTarget['EMPTY_KEYS'] = cpTarget['EMPTY_KEYS'].concat([newKey]);
				}
				return;
			}

			if (opts.filterNulls && value !== null) {
				output[newKey] = value;
			}
		})
	}

	const cpTarget = {...target};
	cpTarget['EMPTY_KEYS'] = [];
	step(cpTarget);

	if (output['EMPTY_KEYS'] === 'E_ARR') {
		output['EMPTY_KEYS'] = [];
	}
	return output;
}

function unflatten (target, opts) {
	opts = opts || {}

	var delimiter = opts.delimiter || '.'
	var overwrite = opts.overwrite || false
	var result = {}

	var isbuffer = isBuffer(target)
	if (isbuffer || Object.prototype.toString.call(target) !== '[object Object]') {
		return target
	}

	// safely ensure that the key is
	// an integer.
	function getkey (key) {
		var parsedKey = Number(key)

		return (
			isNaN(parsedKey) ||
			key.indexOf('.') !== -1 ||
			opts.object
		) ? key
			: parsedKey
	}

	var sortedKeys = Object.keys(target).sort(function (keyA, keyB) {
		return keyA.length - keyB.length
	})

	sortedKeys.forEach(function (key) {
		var split = key.split(delimiter)
		var key1 = getkey(split.shift())
		var key2 = getkey(split[0])
		var recipient = result

		while (key2 !== undefined) {
			var type = Object.prototype.toString.call(recipient[key1])
			var isobject = (
				type === '[object Object]' ||
				type === '[object Array]'
			)

			// do not write over falsey, non-undefined values if overwrite is false
			if (!overwrite && !isobject && typeof recipient[key1] !== 'undefined') {
				return
			}

			if ((overwrite && !isobject) || (!overwrite && recipient[key1] == null)) {
				recipient[key1] = (
					typeof key2 === 'number' &&
					!opts.object ? [] : {}
				)
			}

			recipient = recipient[key1]
			if (split.length > 0) {
				key1 = getkey(split.shift())
				key2 = getkey(split[0])
			}
		}

		// unflatten again for 'messy objects'
		recipient[key1] = unflatten(target[key], opts)
	})

	const emap = { 'E_OBJ': {}, 'E_ARR': [] };
	result = result['EMPTY_KEYS'].reduce((acc, ek) => {
		const pathTo = ek.split('.');
		let brefp = acc;
		let bref = acc;
		pathTo.forEach(pk => {
			brefp = bref;
			bref = bref[pk];
		});
		brefp[pathTo.pop()] = emap[bref];
		return acc;
	}, result);

	delete result['EMPTY_KEYS'];

	return result;
}

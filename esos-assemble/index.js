currentPos = 0;
currentFile = "<root>";
if(!Array.prototype.flatMap) Array.prototype.flatMap = function flatMap(f, thisArg=this) {
	let result =  [];
	for(let i = 0; i < this.length; i++) {
		result.push(...f.call(thisArg, this[i], i, this));
	}
	return result;
}
WIDTH = 640;
HEIGHT = 360;
include = (function() {
	let nextAsmObf = 0;
	return function include(file) {
		let oldCurFile = currentFile;
		try {
			if(include.includedBefore.includes(file)) return "";
			currentFile = file;
			include.includedBefore.push(file);
			let str = require("fs").readFileSync(file, "utf-8");
			let asm = require("./asm.js");
			asm.parse.obf = nextAsmObf++;
			asm.parse.deferred = [];
			let myObf = asm.parse.obf;
			let {items, deferred} = asm.parse(str);
			let output = [];
			for(let item of items) {
				if(item.type === "js") {
					let savePos = currentPos;
					let r = eval(item.value);
					asm.parse.obf = myObf;
					item.result = arraywrap(r);
					if(currentPos > savePos + item.result.length) {
						console.warn(`\
WARNING: currentPos was incremented more than the result length, \
are you incorrectly changing currentPos?
    - additional info:
		  - the error occured while processing a JS expression
    eval error:\n${item.value}`);
					}
					currentPos = savePos + item.result.length;
				} else if(item.type === "deferred") {
					item.cpos = currentPos;
					currentPos += (item.value.length = eval(item.value.length));
					console.log("currentPos deferred increase by", item.value.length);
				} else {
					item.result = intoBytes(item.value);
					currentPos += 4;
					console.log("currentPos number increase by 4");
				}
			}
			//console.log(items);
			for(let item of deferred) {
				//console.log("eval:", item);
				let savePos = currentPos;
				currentPos = item.cpos;
				let r = eval(item.value.code);
				item.result = arraywrap(r);
				if(currentPos > savePos + item.result.length) {
					console.warn(`\
WARNING: currentPos was incremented more than the result length, \
are you incorrectly changing currentPos?
    - additional info:
		  - the error occurred while processing a deferred JS expression
    eval error:\n${item.value}`);
				}
				currentPos = savePos;
				//console.log("result:", r);
				asm.parse.obf = myObf;
				if(item.result.length !== item.value.length) {
					let msg = "Deferred JS expression result's length was not equal to specified length\n";
					msg += `    expected length: ${item.value.length}\n    actual length: ${item.result.length}\n    returned value: ${require('util').inspect(item.result, {depth: null})}`;
					throw new Error(msg);
				}
			}
			for(let item of items) {
				for(let r of item.result) {
					output.push(r);
				}
			}
			currentFile = oldCurFile;
			return output;
		} catch(e) {
			e.message += "\n    ";
			if(e.location) e.message += `at line ${e.location.start.line} column ${e.location.start.column} `;
			e.message += `in file ${currentFile}`;
			currentFile = oldCurFile;
			throw e;
		}
	};
})();
include.includedBefore = [];

let ___$oldeval___ = eval;
// Remove local context from eval (is this needed?)
eval = function eval(x) {
	try {
		return ___$oldeval___(x);
	} catch(e) {
		e.message += `\n    eval error:\n${x}`;
		throw e;
	}
}

intoBytes = function intoBytes(value) {
	if(Array.isArray(value)) return value.flatMap(intoBytes);
	let b = new ArrayBuffer(4);
	let a32 = new Int32Array(b);
	let a8 = new Uint8Array(b);
	a32[0] = value;
	return a8;
}

arraywrap = function arraywrap(r) {
	return r == undefined ? [] : r.length == undefined ? [r] : r;
}

let __$fixedaddrs = new Map();
fixedAddr = function fixedAddr(x) {
	if(__$fixedaddrs.has(x)) return __$fixedaddrs.get(x);
	throw new Error("Tried to access fixed address " + x + " which is not yet registered. Try calling registerFixedAddr(0, ...)");
}

registerFixedAddr = function registerFixedAddr(x, a) {
	if(__$fixedaddrs.has(x)) return false;
	__$fixedaddrs.set(x, a);
	return true;
}

isFixedAddrRegistered = function isFixedAddrRegistered(x) {
	return __$fixedaddrs.has(x);
}
try {
	eval(process.argv.slice(4).join(" "));
	require("fs").writeFileSync(process.argv[3] || "./out.bbj", Buffer.from(include(process.argv[2] || "./in.bbj")));
} catch(e) {
	if(e.p) {
		console.error(e.message);
		process.exit(1);
	} else {
		console.error("GLOBAL DUMP");
		for(let f in global) {
			console.log(f + ":", global[f].toString());
		}
		throw e;
	}
}

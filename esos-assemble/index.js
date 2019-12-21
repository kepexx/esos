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
					let r = eval(item.value);
					asm.parse.obf = myObf;
					item.result = r == undefined ? [] : Array.isArray(r) ? r : [r];
					currentPos += item.result.length;
				} else if(item.type !== "deferred") {
					item.result = intoBytes(item.value);
					currentPos += 4;
				} else {
					currentPos += 4; // this isn't really right. a deferred
					// function could add more than 4 to currentPos but
					// the only `defer` used in asm.pegjs increases by 4.
					// this WILL break for user-defined defers, if they are
					// added
				}
			}
			//console.log(items);
			for(let item of deferred) {
				//console.log("eval:", item);
				let r = eval(item.value);
				//console.log("result:", r);
				asm.parse.obf = myObf;
				item.obj.result = r == undefined ? [] : Array.isArray(r) ? r : [r];
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
			if(e.p) e.message += `at line ${e.location.start.line} column ${e.location.start.column} `;
			e.message += `in file ${currentFile} (${e.p ? e.file : "<abnormal error>"})`;
			currentFile = oldCurFile;
			throw e;
		}
	};
})();
include.includedBefore = [];

let ___$oldeval___ = eval;
// Remove local context from eval (is this needed?)
eval = function eval(x) {
	return ___$oldeval___(x);
}

intoBytes = function intoBytes(value) {
	if(Array.isArray(value)) return value.flatMap(intoBytes);
	return [value & 0xFF, value >> 8 & 0xFF, value >> 16 & 0xFF, value >> 24 & 0xFF];
}

try {
	require("fs").writeFileSync(process.argv[3] || "./out.bbj", Buffer.from(include(process.argv[2] || "./in.bbj")));
} catch(e) {
	if(e.p) {
		console.error(e.message);
		process.exit(1);
	}
	else throw e;
}

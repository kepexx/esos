currentPos = 0;
require("./asm.js").parse.obf = 0;
include.includedBefore = [];
currentFile = "<root>";
WIDTH = 640;
HEIGHT = 360;
try {
	require("fs").writeFileSync(process.argv[3] || "./out.bbj", Buffer.from(include(process.argv[2] || "./in.bbj")));
} catch(e) {
	if(e.p) console.error(e.message);
	else throw e;
}

function include(file) {
	let oldCurFile = currentFile;
	try {
		if(include.includedBefore.includes(file)) return "";
		currentFile = file;
		include.includedBefore.push(file);
		let str = require("fs").readFileSync(file, "utf-8");
		let asm = require("./asm.js");
		asm.obf++;
		let {items, deferred} = asm.parse(str);
		let output = [];
		for(let item of items) {
			if(item.type === "js") {
				let r = eval(item.value);
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
		for(let item of deferred) {
			let r = eval(item.value);
			item.obj.result = r == undefined ? [] : Array.isArray(r) ? r : [r];
		}
		for(let item of items) {
			output.push(...item.result);
		}
		currentFile = oldCurFile;
		return output;
	} catch(e) {
		e.message += `\n    at line ${e.location.start.line} column ${e.location.start.column} in file ${e.file}`;
		currentFile = oldCurFile;
		throw e;
	}
}

function intoBytes(value) {
	if(Array.isArray(value)) return value.flatMap(intoBytes);
	return [value & 0xFF, value >> 8 & 0xFF, value >> 16 & 0xFF, value >> 24 & 0xFF];
}

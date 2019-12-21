currentPos = 0;
currentFile = process.argv[2] || "./in.bbj";
require("./asm.js").parse.obf = 0;
include.includedBefore = [];
try {
	require("fs").writeFileSync(process.argv[3] || "./out.bbj", Buffer.from(include(currentFile)));
} catch(e) {
	if(e.p) console.error(e.message);
	else throw e;
}

function include(file) {
	try {
		if(include.includedBefore.includes(file)) return "";
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
				console.log(item.result);
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
		console.log("BEFORE DEFER");
		console.log(items);
		console.log("DEFERRED:", deferred);
		for(let item of deferred) {
			let r = eval(item.value);
			item.obj.result = r == undefined ? [] : Array.isArray(r) ? r : [r];
			console.log(item);
		}
		console.log("AFTER DEFER");
		console.log(items);
		for(let item of items) {
			console.log(item);
			output.push(...item.result);
		}
		return output;
	} catch(e) {
		if(e.p) {
			e.message += `\n    at line ${e.location.start.line} column ${e.location.start.column} in file ${e.file}`;
		}
		throw e;
	}
}

function intoBytes(value) {
	if(Array.isArray(value)) return value.map(intoBytes);
	return [value & 0xFF, value >> 8 & 0xFF, value >> 16 & 0xFF, value >> 24 & 0xFF];
}

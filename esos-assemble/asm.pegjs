{
	function defer(x, value) {
		let obj = {type: "deferred", value: x};
		(peg$parse.deferred || (peg$parse.deferred = [])).push({obj, value});
		return obj;
	}
	function makeLabelGetCode(label) {
		return `
		if(global.${label} !== undefined) {
			intoBytes(${label});
		} else {
			let err = new Error();
			err.p = true;
			err.location = ${JSON.stringify(location())};
			err.file = currentFile;
			err.message = "Label \`${deobf(label)}\` is not defined";
			throw err;
		}`;
	}
	function makeLabelCode(label) {
		return `global.${label} = currentPos; []`;
	}
	function deobf(label) {
		return label.split("___").pop();
	}
}

Program "program" = _ head:Item tail:(__ s:Item {return s})* _ {
	let newItems = [];
	let items = [head].concat(tail);
	for(let item of items) {
		if(item.label) {
			newItems.push({type: "js", value: makeLabelCode(item.label)});
		}
		newItems.push(item.item);
	}
	return {items: newItems, deferred: peg$parse.deferred || []};
}

Item "item" = label:(l:Id _ ":" _ {return l})? item:(Number / Label / JSExpr) {
	return {label, item};
}

Number "integer" = "-"? ("0x" [0-9A-Fa-f]+ / "0o" [0-7]+ / "0b" [01]+ / [0-9]+) {return {value: Number(text())}}

Label "label" = id:Id {
	return defer({type: "label", id}, makeLabelGetCode(id));
}

JSExpr "JS expression" = "{{" x:Braced "}}" {
	return {type: "js", value: x};
}

Braced = ([^{}] / "{" Braced "}")* {return text()}

Id "identifier" = [A-Za-z$_][A-Za-z0-9$_]* {
	return `_M${peg$parse.obf}___${text()}`;
}

__ "whitespace" = [ \t\r\n]+
_ "optional whitespace" = __?

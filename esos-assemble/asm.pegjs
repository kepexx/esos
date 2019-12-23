{
	function defer(x, value) {
		let obj = {type: "deferred", value: x};
		(peg$parse.deferred || (peg$parse.deferred = [])).push({obj, value});
		return obj;
	}
	function makeLabelGetCode(label) {
		return `
		if(global.${label} !== undefined) {
			if(global.$__ismacro__${label} !== undefined) {
				let err = new Error();
				err.p = true;
				err.location = ${JSON.stringify(location())};
				err.file = currentFile;
				err.message = "Tried to reference \`${deobf(label)}\`, which is a macro, not a label\\n    ## compiler details:\\n        - mangled name: \`${label}\`\\n        - $__ismacro__: \`" + $__ismacro__${label} + "\`";
				throw err;
			} else {
				intoBytes(${label});
			}
		} else {
			let err = new Error();
			err.p = true;
			err.location = ${JSON.stringify(location())};
			err.file = currentFile;
			err.message = "Label \`${deobf(label)}\` is not defined\\n    ## compiler details:\\n        - mangled name: \`${label}\`\\n        - $__ismacro__: \`" + $__ismacro__${label} + "\`";
			throw err;
		}`;
	}
	function makeLabelCode(label) {
		return `global.${label} = currentPos; []`;
	}
	function makeMacroCreation(name, c) {
		return `global.${name} = ${c}; global.$__ismacro__${name} = true; []`;
	}
	function makeMacroUseCode(name, args) {
		return `
		if(global.${name} !== undefined) {
			if(global.$__ismacro__${name} !== undefined) {
				${name}(${args});
			} else {
				let err = new Error();
				err.p = true;
				err.location = ${JSON.stringify(location())};
				err.file = currentFile;
				err.message = "Tried to call \`${deobf(name)}\`, which is a label, not a macro\\n    ## compiler details:\\n        - mangled name: \`${name}\`\\n        - $__ismacro__: \`" + $__ismacro__${label} + "\`";
				throw err;
			}
		} else {
			let err = new Error();
			err.p = true;
			err.location = ${JSON.stringify(location())};
			err.file = currentFile;
			err.message = "Macro \`${deobf(name)}\` is not defined\\n    ## compiler details:\\n        - mangled name: \`${name}\`";
			throw err;
		}`;
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

Item "item" = label:(l:Id _ ":" _ {return l})? item:(Number / Label / JSExpr / Macro) {
	return {label, item};
}

Number "integer" = "-"? ("0x" [0-9A-Fa-f]+ / "0o" [0-7]+ / "0b" [01]+ / [0-9]+) {return {value: Number(text())}}

Label "label" = id:Id {
	return defer({type: "label", id}, makeLabelGetCode(id));
}

JSExpr "JS expression" = "{{" x:Braced "}}" {
	return {type: "js", value: x};
}

Macro "macro definition" = "{" _ id:Id __ x:Braced "}" {
	return {type: "js", value: makeMacroCreation(id, x)};
}

MacroUse "macro invocation" = "<" _ id:Id _ "(" x:Braced ")" _ ">" {
	return defer({type: "macrouse", id}, makeMacroUseCode(id, x));
}

Braced = ([^{}] / "{" Braced "}")* {return text()}

Id "identifier" = extern:("extern" __)? [A-Za-z$_][A-Za-z0-9$_]* {
	return extern ? text() : `_M${peg$parse.obf}___${text()}`;
}

__ "whitespace" = [ \t\r\n]+
_ "optional whitespace" = __?

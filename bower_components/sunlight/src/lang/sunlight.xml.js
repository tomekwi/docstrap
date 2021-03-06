(function(sunlight, undefined){

	if (sunlight === undefined || sunlight["registerLanguage"] === undefined) {
		throw "Include sunlight.js before including language files";
	}

	function isInsideOpenBracket(context) {
		var token, 
			index = context.count();
		
		while (token = context.token(--index)) {
			if (token.name === "operator") {
				if (token.value === ">" || token.value === "/>" || token.value === "</") {
					return false;
				}
			}
			
			if (token.name === "tagName" || token.name === "xmlOpenTag") {
				return true;
			}
		}
		
		return false;
	}
	
	sunlight.registerLanguage("xml", {
		caseInsensitive: true,
		
		scopes: {
			comment: [ ["<!--", "-->"], ["<%--", "--%>"] ],
			cdata: [ ["<![CDATA[", "]]>"] ],
			doctype: [ ["<!DOCTYPE", ">"] ]
		},
		
		punctuation: /(?!x)x/,
		numberParser: function() {},
		
		customTokens: {
			xmlOpenTag: { values: ["<?xml"], boundary: "" },
			xmlCloseTag: { values: ["?>"], boundary: "" },
			aspOpenTag: { values: ["<%@", "<%$", "<%#", "<%=", "<%"], boundary: "" },
			aspCloseTag: { values: ["%>"], boundary: "" }
		},
		
		customParseRules: [
			//tag names
			function(context) {
				var current = context.reader.current(),
					prevToken,
					peek,
					tagName = current,
					line = context.reader.getLine(), 
					column = context.reader.getColumn();
				if (!/[A-Za-z_]/.test(current)) {
					return null;
				}
				
				prevToken = context.token(context.count() - 1);
				if (!prevToken || prevToken.name !== "operator" || !sunlight.util.contains(["<", "</"], prevToken.value)) {
					return null;
				}
				
				//read the tag name
				while (peek = context.reader.peek()) {
					//allow periods in tag names so that ASP.NET web.config files
					//work correctly
					if (!/[.\w-]/.test(peek)) {
						break;
					}
					
					tagName += context.reader.read();
				}
				
				return context.createToken("tagName", tagName, line, column);
			},
			
			//strings (attribute values)
			function(context) {
				var delimiter = context.reader.current(),
					stringValue,
					peek,
					line = context.reader.getLine(), 
					column = context.reader.getColumn();
				
				if (delimiter !== "\"" && delimiter !== "'") {
					return null;
				}
				
				if (!isInsideOpenBracket(context)) {
					return null;
				}
				
				//read until the delimiter
				stringValue = delimiter;
				while (peek = context.reader.peek()) {
					stringValue += context.reader.read();
					
					if (peek === delimiter) {
						break;
					}
				}
				
				return context.createToken("string", stringValue, line, column);
			},
			
			//attributes
			function(context) {
				var current = context.reader.current(),
					peek,
					count = 1,
					attribute,
					line = context.reader.getLine(), 
					column = context.reader.getColumn();
				
				if (!/[A-Za-z_]/.test(current)) {
					return null;
				}
				
				//must be between < and >
				
				if (!isInsideOpenBracket(context)) {
					return null;
				}
				
				//look forward for >
				peek = context.reader.peek();
				while (peek.length === count) {
					if (/<$/.test(peek)) {
						return null;
					}
					
					if (/>$/.test(peek)) {
						attribute = attribute || current + peek.substring(0, peek.length - 1);
						context.reader.read(attribute.length - 1);
						return context.createToken("attribute", attribute, line, column);
					}
					
					if (!attribute && /[=\s:]$/.test(peek)) {
						attribute = current + peek.substring(0, peek.length - 1);
					}
					
					peek = context.reader.peek(++count);
				}
				
				return null;
			},
			
			//entities
			function(context) {
				var current = context.reader.current(),
					count = 1,
					peek,
					line = context.reader.getLine(), 
					column = context.reader.getColumn();
				if (current !== "&") {
					return null;
				}
				
				//find semicolon, or whitespace, or < or >
				peek = context.reader.peek(count);
				while (peek.length === count) {
					if (peek.charAt(peek.length - 1) === ";") {
						return context.createToken("entity", current + context.reader.read(count), line, column);
					}
					
					if (!/[A-Za-z0-9]$/.test(peek)) {
						break;
					}
					
					peek = context.reader.peek(++count);
				}
				
				return null;
			},
			
			//asp.net server side comments: <%-- --%>
			function(context) {
				var peek, 
					value = "<%--", 
					line = context.reader.getLine(), 
					column = context.reader.getColumn();
				
				//have to do these manually or else they get swallowed by the open tag: <%
				if (context.reader.current() !== "<" || context.reader.peek(3) !== "%--") {
					return null;
				}
				
				context.reader.read(3);
				while (peek = context.reader.peek()) {
					if (context.reader.peek(4) === "--%>") {
						value += context.reader.read(4);
						break;
					}
					
					value += context.reader.read();
				}
				
				return context.createToken("comment", value, line, column);
			}
		],
		
		embeddedLanguages: {
			css: {
				switchTo: function(context) {
					var prevToken = context.token(context.count() - 1),
						index;
						
					if (!prevToken || context.reader.current() + context.reader.peek(6) === "</style") {
						return false;
					}
					
					if (prevToken.name !== "operator" || prevToken.value !== ">") {
						return false;
					}
					
					//look backward for a tag name, if it's "style", then we go to css mode
					index = context.count() - 1;
					while (prevToken = context.token(--index)) {
						if (prevToken.name === "tagName") {
							if (prevToken.value === "style") {
								//make sure it's not a closing tag
								prevToken = context.token(--index);
								if (prevToken && prevToken.name === "operator" && prevToken.value === "<") {
									return true;
								}
							}
							
							break;
						}
					}
					
					return false;
				},
				
				switchBack: function(context) {
					return context.reader.peek(7) === "</style";
				}
			},
			
			javascript: {
				switchTo: function(context) {
					var prevToken = context.token(context.count() - 1),
						index;
						
					if (!prevToken || context.reader.current() + context.reader.peek(7) === "</script") {
						return false;
					}
					
					if (prevToken.name !== "operator" || prevToken.value !== ">") {
						return false;
					}
					
					//look backward for a tag name, if it's "script", then we go to javascript mode
					index = context.count() - 1;
					while (prevToken = context.token(--index)) {
						if (prevToken.name === "tagName") {
							if (prevToken.value === "script") {
								//make sure it's not a closing tag
								prevToken = context.token(--index);
								if (prevToken && prevToken.name === "operator" && prevToken.value === "<") {
									return true;
								}
							}
							
							break;
						}
					}
					
					return false;
				},
				
				switchBack: function(context) {
					return context.reader.peek(8) === "</script";
				}
			},
			
			php: {
				switchTo: function(context) {
					var peek4 = context.reader.peek(4);
					return context.reader.current() === "<" && (peek4 === "?php" || /^\?(?!xml)/.test(peek4));
				},
				
				switchBack: function(context) {
					var prevToken = context.token(context.count() - 1);
					return prevToken && prevToken.name === "closeTag";
				}
			},
			
			csharp: {
				switchTo: function(context) {
					var prevToken = context.token(context.count() - 1);
					return prevToken && prevToken.name === "aspOpenTag";
				},
				
				switchBack: function(context) {
					return context.reader.peek(2) === "%>";
				}
			},
			
			scala: {
				switchTo: function(context) {
					if (!context.options.enableScalaXmlInterpolation) {
						return false;
					}
					
					if (context.reader.current() === "{") {
						return true;
					}
					
					return false;
				},
				
				switchBack: function(context) {
					var prevToken = context.token(context.count() - 1);
					
					if (prevToken.name === "punctuation") {
						if (prevToken.value === "{") {
							context.items.scalaBracketNestingLevel++;
						} else if (prevToken.value === "}") {
							context.items.scalaBracketNestingLevel--;
							if (context.items.scalaBracketNestingLevel === 0) {
								return true;
							}
						}
					}
					
					return false;
				}
			}
		},
		
		contextItems: {
			scalaBracketNestingLevel: 0
		},

		operators: [
			"=", "/>", "</", "<", ">", ":"
		]

	});
}(this["Sunlight"]));
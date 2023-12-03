const token_types = {
    WHITESPACE: 0,
    NEWLINE: 1,
    L_BRACE: 2,
    R_BRACE: 3,
    L_BRACKET: 4,
    R_BRACKET: 5,
    COLON: 6,
    COMMA: 7,
    BOOLEAN: 8,
    RAW_STRING: 9,
    NUMBER: 10,
    EOF: 11
};

const token_cats = {
    GROUPING: 0,
    VALUE: 1,
    DILEMITER: 2
};

function lex(source_str, ignore = []) {
    // To resolve 1 char look ahead issue.
    // This lexer will look ahead by one charachter often, 
    // if the string is near the end an error will rise. 
    source_str += "\0";

    function build_token(value, type, category) {
        return { value, type, category };
    }
    
    function char_is_number(ch) {
        let symbols = "0123456789.".split("");
        return symbols.includes(ch);
    }

    function is_letter(str) {
        return str.length === 1 && str.match(/[a-z]/i);
    }

    const out_tokens = [];

    let buffer = "";
    let escaping = false;
    let populate_buffer = false;
    let populate_number = false;
    let populate_boolean = false;
    let number_str = "";
    let boolean = "";

    function print_debug(char, index) {
        console.log("-- Char: " + char);
        console.log("-- Index: " + index);
        console.log("-- Buffer: " + buffer);
        console.log("-- Escape Depth: " + escaping);
        console.log("-- Populate Buffer: " + populate_buffer);

        console.log(out_tokens);
    }

    function add_token(token) {
        if (ignore.length == 0 || !ignore.includes(token.type)) {
            out_tokens.push(token);
        }
    }

    function check_number(index, chars) {
        if (!char_is_number(chars[index + 1])) {
            // Check multiple decimal places
            const old_str = number_str.replace(".", "");
            const new_str = old_str.replace(".", "");
            
            if (old_str.length > new_str.length) {
                process.exit(1);
                print_debug();
            }
            
            const true_num = Number(number_str);
            add_token(build_token(true_num, token_types.NUMBER, token_cats.VALUE));

            populate_number = false;
            number_str = "";
        }
    }

    source_str
        .split("")
        .forEach((char, index, chars) => {
            if (populate_boolean) {
                if (!is_letter(chars[index + 1])) {
                    boolean += char;
                    const b_str = boolean.toLowerCase();
                    let bool = false;

                    if (b_str === "true") {
                        bool = true;
                    } else if (b_str === "false") {
                        bool = false;
                    } else {
                        console.log("JSON parse error");
                        console.log("-- Error: Unrecognized keyword: " + boolean);
                        print_debug();
                        process.exit(1);
                    }

                    add_token(build_token(bool, token_types.BOOLEAN, token_cats.VALUE));

                    populate_boolean = false;
                    boolean = "";
                } else {
                    boolean += char;
                }
            } else if (populate_number) {
                number_str += char;
                check_number(index, chars);
            } else if (populate_buffer) {
                /**
                 * Store string associated charachters and handle escape logic
                 */
                if (escaping) {
                    /**
                     * An odd number of escape symbols means the charachter after the last escape will be affected.
                     */
                    buffer += char;
                    escaping = false;
                } else if (char === "\\") {
                    escaping = true;
                } else if (char === "\n") {
                    console.log("JSON parse error");
                    console.log("-- Error: String may not contain new lines");
                    print_debug(char, index);

                    process.exit(1);
                } else if (char === "\"") {
                    add_token(build_token(buffer, token_types.RAW_STRING, token_cats.VALUE));
                    populate_buffer = false;
                    buffer = "";
                } else {
                    buffer += char;
                }
            } else {
                /**
                 * Deal with simple capture symbols
                 */
                if (char === "\0") {
                    add_token(build_token(char, token_types.EOF, token_cats.VALUE));
                } else if (char === "{") {
                    add_token(build_token(char, token_types.L_BRACE, token_cats.GROUPING));
                } else if (char === "}") {
                    add_token(build_token(char, token_types.R_BRACE, token_cats.GROUPING));
                } else if (char === "[") {
                    add_token(build_token(char, token_types.L_BRACKET, token_cats.GROUPING));
                } else if (char === "]") {
                    add_token(build_token(char, token_types.R_BRACKET, token_cats.GROUPING));
                } else if (char === "\n") {
                    add_token(build_token(char, token_types.NEWLINE, token_cats.DILEMITER));
                } else if (char === " " || char === "\t") {
                    add_token(build_token(char, token_types.WHITESPACE, token_cats.DILEMITER));
                } else if (char === ":") {
                    add_token(build_token(char, token_types.COLON, token_cats.DILEMITER));
                } else if (char === ",") {
                    add_token(build_token(char, token_types.COMMA, token_cats.DILEMITER));
                } else if (char === "\"" && !populate_buffer) {
                    populate_buffer = true;
                } else if (char_is_number(char)) {
                    /**
                     * Elsewise a number
                     */
                    populate_number = true;
                    number_str += char;

                    check_number(index, chars);
                } else if (
                    char === "t" 
                    || char === "T"
                    || char === "f"
                    || char === "F"
                ) {
                    populate_boolean = true;
                    boolean += char;
                } else {
                    console.log("JSON parse error");
                    console.log("Error: Unexpected symbol: " + char);

                    process.exit(1);
                }
            }
        });

    return out_tokens;
}

function iterate(array, callback) {
    let index = 0;
    let end = false;

    while (index < array.length && !end) {
        const sig = {
            halt: () => {
                end = true;
            },
            jump: (i) => {
                index = i;
            },
            skip: (i) => {
                index += i - 1;
            }
        }
        
        callback(array[index], index, sig)
        index++;
    }
}

let enable_logging = false;

function log(text) {
    if (enable_logging) {
        if (Array.isArray(text)) {
            text.forEach((line) => console.log(line));
        } else {
            console.log(text);
        }
    }
}

const context_type = {
    OBJECT: 0,
    ARRAY: 1,
    PROPERTY: 2,
    ROOT: 3
}

function after(arr, ind) {
    return arr.filter((_, i) => i > ind);
}

function resolve(ast = {}, length = 0) {
    return { ast, length, error: false, started: true }
}

function elog(text, started = false) {
    log(text);
    return { error: true, ast: null, message: text, started };
}

function parse_value(tokens) {
    if (!(tokens.length >= 1))
        return elog("[VALUE] Could not parse, value does not have 1 element avaliable");

    const value = tokens[0];
    if (
        value.type != token_types.RAW_STRING
        && value.type != token_types.BOOLEAN
        && value.type != token_types.NUMBER
    ) {
        const object_data = parse_object(tokens);
        const array_data = parse_array(tokens);

        if (object_data.started || object_data.error)
            return object_data;
        if (array_data.started || array_data.error)
            return array_data;
        if (object_data.error && array_data.error)
            return elog("[VALUE] Unexpected: " + JSON.stringify(value)), true;

        return elog("Invalid value: " + JSON.stringify(value));
    }

    return resolve({ value: tokens[0] }, 1);
}

function parse_object(tokens) {
    if (!(tokens.length >= 2))
        return elog("[OBJECT] Could not parse, object does not possible contain the 2 neccessary basics ({ and })");

    const l_curly = tokens[0];
    
    if (l_curly.type != token_types.L_BRACE) 
        return elog("[OBJECT] Could not parse, object does not start with L_CURLY");

    // Only 2 things may pass
    // - COMMA
    // - Property

    let properties = [];
    let error_data = null;
    let expecting_property = false;
    let length = 1;

    iterate(after(tokens, 0), (token, index, sig) => {
        if (token.type == token_types.COMMA) {
            if (expecting_property) {
                sig.halt();
                return error_data = elog("[OBJECT] Unexpected comma while expecting property", true);
            }

            length += 1;
            expecting_property = true;
            return;
        }

        if (token.type == token_types.R_BRACE && !expecting_property) {
            length += 1;
            expecting_property = false;
            return sig.halt();
        }

        const property_data = parse_property(after(tokens, index));
        if (!property_data.error) {
            expecting_property = false;
            length += property_data.length;
            properties.push(property_data.ast)
            return sig.skip(property_data.length);
        }
        
        if (!expecting_property) {
            sig.halt();
            return error_data = elog("[OBJECT] Unexpected data, unterminated object", true);
        }

        sig.halt();
        error_data = elog("[OBJECT] Unexpected: " + JSON.stringify(token), true);
    });

    if (error_data != null)
        return error_data;

    return resolve({
        value: properties,
        type: "object"
    }, length);
}

function parse_array(tokens) {
    return elog("No", false);
}

function parse_property(tokens) {
    if (!(tokens.length >= 3)) 
        return elog("[PROPERTY] Could not parse, property does not have 3 elements avaliable");

    const property_data = tokens[0];
    const colon_data = tokens[1];
    const value_data = parse_value(after(tokens, 1));
    
    if (
        property_data.type != token_types.RAW_STRING
        || colon_data.type != token_types.COLON
        || value_data.error
    )
        return elog([
            "[PROPERTY] Could not parse, property does not meet JSON standard of (PROP_NAME, COLON, PROP_VALUE)",
            `-- ${value_data.message}`
        ]);

    if (Array.isArray(value_data.ast.value)) {
        return resolve({
            key: property_data.value,
            value: value_data.ast.value,
            type: value_data.ast.type
        }, 1 + value_data.length);
    }

    return resolve({
        key: property_data.value,
        value: value_data.ast.value.value,
        type: "property"
    }, 3);
}

function parse_root(tokens) {
    const object_data = parse_object(after(tokens, -1));
    const array_data = parse_array(after(tokens, -1));
    
    if (!object_data.error)
        return object_data;
    if (!array_data.error)
        return array_data;
    else {
        if (object_data.started)
            return object_data;
        else if (array_data.started)
            return array_data;
        else 
            return elog("[ROOT] Unexpected: " + JSON.stringify(tokens[0]) + ` OBJECT: ${!object_data.error}, ARRAY: ${!array_data.error}`);
    }
} 

function generate_object(ast) {
    let out_object = null;

    if (ast.key && !Array.isArray(ast.value)) {
        throw new Error("Cannot convert prop to ast");
    }

    if (ast.type == "object") {
        out_object = {};

        ast.value.forEach((val) => {
            if (val.type == "property") {
                out_object[val.key] = val.value;
            } else if (val.type == "object") {
                out_object[val.key] = generate_object(val);
            }
        })
    }

    return out_object;
}

const a_str = `"a": { "b": true, "are": true }`;

function JSONparser(json_in) {
    const lexed = lex(json_in, [ token_types.WHITESPACE, token_types.NEWLINE ]);
    const parsed = parse_value(lexed);
    const object = generate_object(parsed.ast);

    return object;
}

const b_str = `{ "c": { "a": true, "b": 1, "none": { "greet": "hii" } } }`

console.clear();
// enable_logging = true;
const parsed = JSONparser(b_str);
console.log(JSON.stringify(parsed, null, 4));

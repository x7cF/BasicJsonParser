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
    NUMBER: 10
};

const token_cats = {
    GROUPING: 0,
    VALUE: 1,
    DILEMITER: 2
};

function lex(source_str, ignore = []) {
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

    source_str
        .split("")
        .forEach((char, index, chars) => {
            if (populate_boolean) {
                if (!is_letter(char)) {
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
                if (!char_is_number(char)) {
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
                } else {
                    number_str += char;
                }
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
                if (char === "{") {
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

function parse(source_str) {
    const tokens = lex(source_str, [ token_types.NEWLINE, token_types.WHITESPACE ]);
    console.log(tokens);
}

parse(`{
    "name": "Rayyan Khan \\"A programmer\\"",
    "age": 16,
    "Has A Job": true
}`);

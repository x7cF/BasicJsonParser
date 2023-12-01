const source_str = `{
    "name": "Rayyan",
    "age": 16
}`;

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

function build_token(value, type, category) {
    return { value, type, category };
}

function char_is_number(ch) {
    let symbols = "0123456789.".split("");
    return symbols.includes(ch);
}

function lex() {
    const out_tokens = [];

    let buffer = "";
    let escaping = false;
    let populate_buffer = false;
    let populate_number = false;
    let number_str = "";

    function print_debug(char, index) {
        console.log("-- Char: " + char);
        console.log("-- Index: " + index);
        console.log("-- Buffer: " + buffer);
        console.log("-- Escape Depth: " + escaping);
        console.log("-- Populate Buffer: " + populate_buffer);

        console.log(out_tokens);
    }

    source_str
        .split("")
        .forEach((char, index, chars) => {
            if (populate_number) {
                if (!char_is_number(char)) {
                    // Check multiple decimal places
                    const old_str = number_str.replace(".", "");
                    const new_str = old_str.replace(".", "");
                    
                    if (old_str.length > new_str.length) {
                        process.exit(1);
                        print_debug();
                    }
                    
                    const true_num = Number(number_str);
                    out_tokens.push(build_token(true_num, token_types.NUMBER, token_cats.VALUE));

                    populate_number = false;
                    number_str = "";
                } else {
                    number_str += char;
                    console.log(char)
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
                    out_tokens.push(build_token(buffer, token_types.RAW_STRING, token_cats.VALUE));
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
                    out_tokens.push(build_token(char, token_types.L_BRACE, token_cats.GROUPING));
                } else if (char === "}") {
                    out_tokens.push(build_token(char, token_types.R_BRACE, token_cats.GROUPING));
                } else if (char === "[") {
                    out_tokens.push(build_token(char, token_types.L_BRACKET, token_cats.GROUPING));
                } else if (char === "]") {
                    out_tokens.push(build_token(char, token_types.R_BRACKET, token_cats.GROUPING));
                } else if (char === "\n") {
                    out_tokens.push(build_token(char, token_types.NEWLINE, token_cats.DILEMITER));
                } else if (char === " " || char === "\t") {
                    out_tokens.push(build_token(char, token_types.WHITESPACE, token_cats.DILEMITER));
                } else if (char === ":") {
                    out_tokens.push(build_token(char, token_types.COLON, token_cats.DILEMITER));
                } else if (char === ",") {
                    out_tokens.push(build_token(char, token_types.COMMA, token_cats.DILEMITER));
                } else if (char === "\"" && !populate_buffer) {
                    populate_buffer = true;
                } else if (char_is_number(char)) {
                    /**
                     * Elsewise a number
                     */
                    populate_number = true;
                    number_str += char;
                }
            }
        });

    return out_tokens;
}

// Test the lexer
const tokens = lex();
console.log(tokens);

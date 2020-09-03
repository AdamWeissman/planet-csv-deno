import { BufReader } from "../io/bufio.ts";
import { TextProtoReader } from "../textproto/mod.ts";
import { StringReader } from "../io/readers.ts";
import { assert } from "../_util/assert.ts";
const INVALID_RUNE = ["\r", "\n", '"'];
export const ERR_BARE_QUOTE = 'bare " in non-quoted-field';
export const ERR_QUOTE = 'extraneous or missing " in quoted-field';
export const ERR_INVALID_DELIM = "Invalid Delimiter";
export const ERR_FIELD_COUNT = "wrong number of fields";
export class ParseError extends Error {
    constructor(start, line, column, message) {
        super();
        this.startLine = start;
        this.column = column;
        this.line = line;
        if (message === ERR_FIELD_COUNT) {
            this.message = `record on line ${line}: ${message}`;
        }
        else if (start !== line) {
            this.message =
                `record on line ${start}; parse error on line ${line}, column ${column}: ${message}`;
        }
        else {
            this.message =
                `parse error on line ${line}, column ${column}: ${message}`;
        }
    }
}
function chkOptions(opt) {
    if (!opt.comma) {
        opt.comma = ",";
    }
    if (!opt.trimLeadingSpace) {
        opt.trimLeadingSpace = false;
    }
    if (INVALID_RUNE.includes(opt.comma) ||
        (typeof opt.comment === "string" && INVALID_RUNE.includes(opt.comment)) ||
        opt.comma === opt.comment) {
        throw new Error(ERR_INVALID_DELIM);
    }
}
async function readRecord(startLine, reader, opt = { comma: ",", trimLeadingSpace: false }) {
    const tp = new TextProtoReader(reader);
    let line = await readLine(tp);
    let lineIndex = startLine + 1;
    if (line === null)
        return null;
    if (line.length === 0) {
        return [];
    }
    if (opt.comment && line[0] === opt.comment) {
        return [];
    }
    assert(opt.comma != null);
    let fullLine = line;
    let quoteError = null;
    const quote = '"';
    const quoteLen = quote.length;
    const commaLen = opt.comma.length;
    let recordBuffer = "";
    const fieldIndexes = [];
    parseField: for (;;) {
        if (opt.trimLeadingSpace) {
            line = line.trimLeft();
        }
        if (line.length === 0 || !line.startsWith(quote)) {
            const i = line.indexOf(opt.comma);
            let field = line;
            if (i >= 0) {
                field = field.substring(0, i);
            }
            if (!opt.lazyQuotes) {
                const j = field.indexOf(quote);
                if (j >= 0) {
                    const col = runeCount(fullLine.slice(0, fullLine.length - line.slice(j).length));
                    quoteError = new ParseError(startLine + 1, lineIndex, col, ERR_BARE_QUOTE);
                    break parseField;
                }
            }
            recordBuffer += field;
            fieldIndexes.push(recordBuffer.length);
            if (i >= 0) {
                line = line.substring(i + commaLen);
                continue parseField;
            }
            break parseField;
        }
        else {
            line = line.substring(quoteLen);
            for (;;) {
                const i = line.indexOf(quote);
                if (i >= 0) {
                    recordBuffer += line.substring(0, i);
                    line = line.substring(i + quoteLen);
                    if (line.startsWith(quote)) {
                        recordBuffer += quote;
                        line = line.substring(quoteLen);
                    }
                    else if (line.startsWith(opt.comma)) {
                        line = line.substring(commaLen);
                        fieldIndexes.push(recordBuffer.length);
                        continue parseField;
                    }
                    else if (0 === line.length) {
                        fieldIndexes.push(recordBuffer.length);
                        break parseField;
                    }
                    else if (opt.lazyQuotes) {
                        recordBuffer += quote;
                    }
                    else {
                        const col = runeCount(fullLine.slice(0, fullLine.length - line.length - quoteLen));
                        quoteError = new ParseError(startLine + 1, lineIndex, col, ERR_QUOTE);
                        break parseField;
                    }
                }
                else if (line.length > 0 || !(await isEOF(tp))) {
                    recordBuffer += line;
                    const r = await readLine(tp);
                    lineIndex++;
                    line = r ?? "";
                    fullLine = line;
                    if (r === null) {
                        if (!opt.lazyQuotes) {
                            const col = runeCount(fullLine);
                            quoteError = new ParseError(startLine + 1, lineIndex, col, ERR_QUOTE);
                            break parseField;
                        }
                        fieldIndexes.push(recordBuffer.length);
                        break parseField;
                    }
                    recordBuffer += "\n";
                }
                else {
                    if (!opt.lazyQuotes) {
                        const col = runeCount(fullLine);
                        quoteError = new ParseError(startLine + 1, lineIndex, col, ERR_QUOTE);
                        break parseField;
                    }
                    fieldIndexes.push(recordBuffer.length);
                    break parseField;
                }
            }
        }
    }
    if (quoteError) {
        throw quoteError;
    }
    const result = [];
    let preIdx = 0;
    for (const i of fieldIndexes) {
        result.push(recordBuffer.slice(preIdx, i));
        preIdx = i;
    }
    return result;
}
async function isEOF(tp) {
    return (await tp.r.peek(0)) === null;
}
function runeCount(s) {
    return Array.from(s).length;
}
async function readLine(tp) {
    let line;
    const r = await tp.readLine();
    if (r === null)
        return null;
    line = r;
    if ((await isEOF(tp)) && line.length > 0 && line[line.length - 1] === "\r") {
        line = line.substring(0, line.length - 1);
    }
    if (line.length >= 2 &&
        line[line.length - 2] === "\r" &&
        line[line.length - 1] === "\n") {
        line = line.substring(0, line.length - 2);
        line = line + "\n";
    }
    return line;
}
export async function readMatrix(reader, opt = {
    comma: ",",
    trimLeadingSpace: false,
    lazyQuotes: false,
}) {
    const result = [];
    let _nbFields;
    let lineResult;
    let first = true;
    let lineIndex = 0;
    chkOptions(opt);
    for (;;) {
        const r = await readRecord(lineIndex, reader, opt);
        if (r === null)
            break;
        lineResult = r;
        lineIndex++;
        if (first) {
            first = false;
            if (opt.fieldsPerRecord !== undefined) {
                if (opt.fieldsPerRecord === 0) {
                    _nbFields = lineResult.length;
                }
                else {
                    _nbFields = opt.fieldsPerRecord;
                }
            }
        }
        if (lineResult.length > 0) {
            if (_nbFields && _nbFields !== lineResult.length) {
                throw new ParseError(lineIndex, lineIndex, null, ERR_FIELD_COUNT);
            }
            result.push(lineResult);
        }
    }
    return result;
}
export async function parse(input, opt = {
    header: false,
}) {
    let r;
    if (input instanceof BufReader) {
        r = await readMatrix(input, opt);
    }
    else {
        r = await readMatrix(new BufReader(new StringReader(input)), opt);
    }
    if (opt.header) {
        let headers = [];
        let i = 0;
        if (Array.isArray(opt.header)) {
            if (typeof opt.header[0] !== "string") {
                headers = opt.header;
            }
            else {
                const h = opt.header;
                headers = h.map((e) => {
                    return {
                        name: e,
                    };
                });
            }
        }
        else {
            const head = r.shift();
            assert(head != null);
            headers = head.map((e) => {
                return {
                    name: e,
                };
            });
            i++;
        }
        return r.map((e) => {
            if (e.length !== headers.length) {
                throw `Error number of fields line:${i}`;
            }
            i++;
            const out = {};
            for (let j = 0; j < e.length; j++) {
                const h = headers[j];
                if (h.parse) {
                    out[h.name] = h.parse(e[j]);
                }
                else {
                    out[h.name] = e[j];
                }
            }
            if (opt.parse) {
                return opt.parse(out);
            }
            return out;
        });
    }
    if (opt.parse) {
        return r.map((e) => {
            assert(opt.parse, "opt.parse must be set");
            return opt.parse(e);
        });
    }
    return r;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3N2LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY3N2LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQU1BLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUMzQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDdEQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQ2hELE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUU1QyxNQUFNLFlBQVksR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFdkMsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHLDRCQUE0QixDQUFDO0FBQzNELE1BQU0sQ0FBQyxNQUFNLFNBQVMsR0FBRyx5Q0FBeUMsQ0FBQztBQUNuRSxNQUFNLENBQUMsTUFBTSxpQkFBaUIsR0FBRyxtQkFBbUIsQ0FBQztBQUNyRCxNQUFNLENBQUMsTUFBTSxlQUFlLEdBQUcsd0JBQXdCLENBQUM7QUFNeEQsTUFBTSxPQUFPLFVBQVcsU0FBUSxLQUFLO0lBUW5DLFlBQ0UsS0FBYSxFQUNiLElBQVksRUFDWixNQUFxQixFQUNyQixPQUFlO1FBRWYsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUVqQixJQUFJLE9BQU8sS0FBSyxlQUFlLEVBQUU7WUFDL0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxrQkFBa0IsSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO1NBQ3JEO2FBQU0sSUFBSSxLQUFLLEtBQUssSUFBSSxFQUFFO1lBQ3pCLElBQUksQ0FBQyxPQUFPO2dCQUNWLGtCQUFrQixLQUFLLHlCQUF5QixJQUFJLFlBQVksTUFBTSxLQUFLLE9BQU8sRUFB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
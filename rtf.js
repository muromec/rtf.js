'use strict';

var copy = function(ops) {
    var ret = {};
    Object.keys(ops).map(function (key) {
        ret[key] = ops[key];
    });
    return ret;
};

var Block = function (parent) {
    this.s = [];
    this.parent = parent;
    if (parent) {
        parent.s.push(this);
        this.ops = copy(parent.ops);
    } else {
        this.ops = {};
    }
};

var Text = function (text, ops) {
    this.text = text;
    this.ops = copy(ops);
};

var STATE_EMPTY = 0,
    STATE_READ_OP = 1,
    STATE_READ_ARG = 2,
    STATE_CONTENT = 8;

var tokenise = function (buf) {
    if (!buf || !Buffer.isBuffer(buf)) {
        throw new Error("Pass rtf as buffer");
    }
    var ret = [];
    var idx = 0;
    var end = buf.length;
    var cr;
    var state = STATE_CONTENT;
    var op_name;
    var op_arg;
    var content;
    var start_ct = 0;
    if (buf[idx] !== 0x7B) {
        throw new Error("Broken header");
    }

    while (idx < end) {
        cr = buf[idx];

        switch(state) {
        case STATE_CONTENT:
            if (cr === 0x5C) { // ord('\\')
                state = STATE_READ_OP;
                op_name = new Buffer(20);
                op_name.pos = 0;
            } else if (cr === 0x7B) { // ord('{')
                start_ct = idx + 1;
                state = STATE_CONTENT;
                ret.push({block: 'push'});
            } else if (cr === 0x7D) { // ord('}')
                start_ct = idx + 1;
                ret.push({block: 'pop'});
            }

            if (state !== STATE_CONTENT && start_ct !== idx) {
                content = buf.slice(start_ct, idx);
                ret.push({text: content});
            }

            idx ++;
            break;
        case STATE_READ_OP:
            if (op_name.pos > 20) {
                throw new Error("OP too long " + op_name.pos);
            }
            if (cr > 0x60 && cr < 0x7B) {
                op_name[op_name.pos++] = cr;
                idx ++;
            } else {
                state = STATE_READ_ARG;
                op_name = op_name.slice(0, op_name.pos).toString();
                op_arg = new Buffer(100);
                op_arg.pos = 0;
            }
            break;
        case STATE_READ_ARG:
            if (cr === 0x20 && op_arg.pos === 0) {
                idx ++;
                state = STATE_CONTENT;
                start_ct = idx;
                ret.push({tag: op_name, arg: 1});
            } else if (cr >= 0x30 && cr <= 0x39) {
                op_arg[op_arg.pos++] = cr;
                idx ++;
            } else if (cr === 0x2D) {
                op_arg[op_arg.pos++] = cr;
                idx ++;
            } else {
                if (op_arg.pos === 0) {
                    ret.push({tag: op_name, arg: 1});
                } else {
                    op_arg = op_arg.slice(0, op_arg.pos).toString();
                    ret.push({tag: op_name, arg: Number(op_arg)});
                }
                state = STATE_CONTENT;
                start_ct = idx;
            }
            break;
        default:
            throw new Error("Unknown state", state);
        }

    }

    return ret;
};

var parse = function (buf) {
    var tokens = tokenise(buf);
    var tok;
    var idx;
    var len = tokens.length;
    var cr_block = new Block(null, 0);

    for (idx = 0; idx < len; idx++) {
        tok = tokens[idx];
        if (tok.block === 'push') {
            cr_block = new Block(cr_block, 0);
        } else if (tok.block === 'pop') {
            cr_block = cr_block.parent;
        } else if (tok.text) {
            cr_block.s.push(new Text(tok.text, cr_block.ops));
        } else if (tok.tag) {
            cr_block.ops[tok.tag] = tok.arg;
        }
    }

    cr_block = cr_block.s[0];
    delete cr_block.parent;
    return cr_block;
};

module.exports = {
    parse: parse,
    tokenise: tokenise,
};

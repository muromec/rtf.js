'use strict';

var copy = function(ops) {
    var ret = {};
    Object.keys(ops).map(function (key) {
        ret[key] = ops[key];
    });
    return ret;
};

var Block = function (parent, idx) {
    this.s = [];
    this.start_ct = idx;
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

var parse = function (buf) {
    if (!buf || !Buffer.isBuffer(buf)) {
        throw new Error("Pass rtf as buffer");
    }
    var idx = 0;
    var end = buf.length;
    var cr;
    var cr_block;
    var state = STATE_CONTENT;
    var op_name;
    var op_arg;
    var content;
    if (buf[idx] !== 0x7B) {
        throw new Error("Broken header");
    }

    cr_block = new Block(null, idx);

    while (idx < end) {
        cr = buf[idx];

        switch(state) {
        case STATE_CONTENT:
            if (cr === 0x5C) { // ord('\\')
                state = STATE_READ_OP;
                op_name = new Buffer(20);
                op_name.pos = 0;
            } else if (cr === 0x7B) { // ord('{')
                cr_block = new Block(cr_block, idx+1);
                state = STATE_CONTENT;
            } else if (cr === 0x7D) { // ord('}')
                cr_block = cr_block.parent;
                cr_block.start_ct = idx + 1;
            }

            if (state !== STATE_CONTENT && cr_block.start_ct !== idx) {
                content = buf.slice(cr_block.start_ct, idx);
                cr_block.s.push(new Text(content, cr_block.ops));
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
                cr_block.start_ct = idx;
            } else if (cr >= 0x30 && cr <= 0x39) {
                op_arg[op_arg.pos++] = cr;
                idx ++;
            } else if (cr === 0x2D) {
                op_arg[op_arg.pos++] = cr;
                idx ++;
            } else {
                if (op_arg.pos === 0) {
                    cr_block.ops[op_name] = 1;
                } else {
                    op_arg = op_arg.slice(0, op_arg.pos).toString();
                    cr_block.ops[op_name] = Number(op_arg);
                }
                state = STATE_CONTENT;
                cr_block.start_ct = idx;
            }
            break;
        default:
            throw new Error("Unknown state", state);
        }

    }

    cr_block = cr_block.s[0];
    delete cr_block.parent;
    return cr_block;
};

module.exports = {
    parse: parse,
};

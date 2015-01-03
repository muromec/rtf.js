'use strict';
var fs = require('fs');
var rtf = require('./rtf');
var inconv = require('iconv-lite');

var data = fs.readFileSync('file.rtf');

var root = rtf.parse(data);
var cr, idx = 0, text;

var cp = 'latin1';

if (root.meta.ansicpg) {
    cp = 'windows' + root.meta.ansicpg;
}
var st = [],
    pc = {idx: 0, ob: root};

var out = '';
while ((pc.idx < pc.ob.s.length) || (pc = st.pop())) {
    cr = pc.ob.s[pc.idx++];
    if (cr === undefined) {
        continue;
    }
    if (Buffer.isBuffer(cr.text)) {
        text = inconv.decode(cr.text, cp);
        out += text;
    } else if ((typeof cr.utext) === 'string') {
        out += cr.utext;
    } else if (cr.s) {
        st.push(pc);
        pc = {idx:0, ob: cr};
    } else if (cr.tag) {
        if (cr.tag === 'fonttbl' || cr.tag === 'colortbl') {
            pc = st.pop();
        }
        if (cr.tag === 'par') {
            out += '\n';
        }
        if (cr.tag === 'page') {
            out += '\n\n';
        }
    }
}

console.log(out);

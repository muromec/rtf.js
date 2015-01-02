'use strict';
var fs = require('fs');
var rtf = require('./rtf');
var inconv = require('iconv-lite');

var data = fs.readFileSync('file.rtf');

var root = rtf.parse(data);
var cr, idx = 0, text;

var cp = 'latin1';

if (root.ops.ansicpg) {
    cp = 'windows' + root.ops.ansicpg;
}
var st = [],
    pc = {idx: 0, ob: root};

while ((pc.idx < pc.ob.s.length) || (pc = st.pop())) {
    cr = pc.ob.s[pc.idx++];
    if (cr === undefined) {
        continue;
    }
    if (Buffer.isBuffer(cr.text)) {
        text = inconv.decode(cr.text, cp);
        console.log(cr.ops, text);
    } else if (cr.s) {
        st.push(pc);
        pc = {idx:0, ob: cr};
    }
}

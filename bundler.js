// bundle all the files together into one single JS file

const fs = require("fs");

let embed_js = fs.readFileSync("embed.js", {encoding: "utf-8"});
let timeline_css = fs.readFileSync("timeline.css", {encoding: "utf-8"});
let timeline_html = fs.readFileSync("timeline.html", {encoding: "utf-8"});
let timeline_js = fs.readFileSync("timeline.js", {encoding: "utf-8"});
embed_js = embed_js.replace('const TIMELINE_HTML = ``;', 'const TIMELINE_HTML = `' + timeline_html + '`;')
embed_js = embed_js.replace('const TIMELINE_CSS = ``;', 'const TIMELINE_CSS = `' + timeline_css + '`;')
embed_js = embed_js.replace('const TIMELINE_JS = ``;', 'const TIMELINE_JS = `' + timeline_js + '`;')
fs.writeFileSync("sil-anim-timeline.js", embed_js, {encoding: "utf-8"});


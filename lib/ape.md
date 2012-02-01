This is a doc line

```javascript
var fs = require('fs'),
    path = require('path');
```
This is a multi
  middle line
Line comment

Main function that passes code on for parsing

```javascript
exports.generate_doc = function (filename, callback) {
    var filetext;
    path.exists(filename, function (exists) {
        if (exists) {
            code = fs.readFileSync(filename).toString().split('\n')
            parse_code(filename, code, callback);
        } else {
            callback(new Error('file does not exist ' + filename));
        }
    });
};

```
Return the language object for the filename

```javascript
function get_language(filename) {
    var lang = languages[path.extname(filename)];
    return lang;
};

```
This function actually does the parsing

```javascript
function parse_code(filename, code, callback) {
    var parsed_code = [],
        this_line,
        in_comment,
        in_code,
        lang = get_language(filename);

    function start_code() {
        parsed_code.push('');
        parsed_code.push('```' + lang.name);
        in_code = true;
    }

    function end_code() {
        parsed_code.push('```');
        in_code = false;
    }

```
Loop through the lines

```javascript
    for (var i = 0, l = code.length; i < l; i++) {
        this_line = code[i];
        if (this_line.match(lang.comment) && !in_comment && !this_line.match(/#\!/)) {
            if (in_code) end_code(); 
            parsed_code.push(this_line.replace(lang.comment, ''));
        } else if (this_line.match(lang.start) && !in_comment) {
            if (in_code) end_code(); 
            in_comment = true;
            this_line = this_line.replace(lang.start, '');
            if (this_line.match(lang.end)) {
                this_line = this_line.replace(lang.end, '');
                in_comment = false;
            } 
            parsed_code.push(this_line);
        } else if (this_line.match(lang.end) && in_comment) {
            parsed_code.push(this_line.replace(lang.end, ''));
            in_comment = false;
        } else {
            if (in_comment) {
                parsed_code.push(this_line);
            } else {
                if (!in_code && this_line.trim() !== '') start_code(); 
                parsed_code.push(this_line);
            }
        }
    }
    if (in_code) end_code();
    write_md(filename, parsed_code, callback);
};

function write_md(filename, parsed_code, callback) {
    var outfile;
    outfile = filename.replace(path.extname(filename), '.md');
    fs.writeFileSync(outfile, parsed_code.join('\n'), 'utf8');
    callback(null, outfile);
};
```
testing one line multi-comment 

```javascript
var languages = {
    '.js': { name: 'javascript', comment: /^\s*\/\/\s?/, start: /^\s*\/\*\s?/, end: /\*\/\s*$/ },
    '.py': { name: 'python', comment: /^\s*#\s?/, start: /^\s*\"\"\"\s?/, end: /\"\"\"\s*$/ }
};

```
/*
## API docs? Nope, ape docs!

---
ape is a command line tool to generate documentation from your comments.
It parses your source code files, and strips markdown formatted comments out,
it then puts your code in github-flavored-markdown code blocks, and displays the comments in line.

It wasn't written to be fancy, but rather to have a simple, automated way of keeping docs on github up to date.

To use:

    sudo npm install -g ape
    ape [list of files or directories]
*/

// Require dependencies
var fs = require('fs'),
    path = require('path'),
    gfm = require('ghm'),
    hljs = require('hljs'),
    jade = require('jade');

// This is the exported function that does the actual parsing and documentation generation
exports.generate_doc = function (filename, outputFormat, outputPath, template, callback) {
    path.exists(filename, function (exists) {
        if (exists) {
            var code = fs.readFileSync(filename).toString().split('\n');
            parse_code(filename, code, outputFormat, outputPath, template, callback);
        } else {
            callback(new Error('file does not exist ' + filename));
        }
    });
};

/*
This function is a helper for frontends, to make it simpler to determine if a file can be processed by ape.
It returns a callback with a single boolean parameter indicating if the file is supported
*/
exports.supported = function (filename, callback) {
    var lang = languages[path.extname(filename)];
    if (typeof lang === 'undefined' ) {
        callback(false);
    } else {
        callback(true);
    }
};

// A simple helper function to return the dictionary of comment regexs, determined by the file extension
function get_language(filename) {
    var lang = languages[path.extname(filename)];
    return lang;
}

/*
This is the main function to parse the line array of source code, and return a new line array
containing the formatted text
*/
function parse_code(filename, code, outputFormat, outputPath, template, callback) {
    var parsed_code = [],
        this_line,
        in_comment,
        in_code,
        spaces,
        lang = get_language(filename),
        commentblock = [],
        codeblock = [],
        tempblock = [];

    if (typeof lang === 'undefined') return;
    
    function pushblock() {
        parsed_code.push({ code: codeblock.join('\n'), comment: commentblock.join('\n') });
        codeblock = [];
        commentblock = [];
        in_code = false;
    }

    for (var i = 0, l = code.length; i < l; i++) {
        this_line = code[i];
        if (this_line.match(lang.comment) && !in_comment && !this_line.match(/^#\!/)) {
            if (in_code) pushblock();
            commentblock.push(this_line.replace(lang.comment, ''))
        } else if (this_line.match(lang.start) && !in_comment) {
            if (lang.name === 'python' && in_code) {
                while (codeblock[codeblock.length - 1].trim() !== '') {
                    tempblock.push(codeblock.pop());
                }
            }
            if (in_code) pushblock(); 
            if (lang.name === 'python') {
                for (var ti = 0, tl = tempblock.length; ti < tl; ti++) {
                    codeblock.push(tempblock.pop());
                }
            }
            in_comment = true;
            spaces = this_line.match(/^\s+/);
            if (spaces) spaces = spaces[0].length;
            this_line = this_line.replace(lang.start, '');
            if (this_line.match(lang.end)) {
                this_line = this_line.replace(lang.end, '');
                in_comment = false;
            } 
            if (this_line.trim() !== '') commentblock.push(this_line);
        } else if (this_line.match(lang.end) && in_comment) {
            this_line = this_line.replace(lang.end, '');
            if (this_line.trim() !== '') commentblock.push(this_line);
            in_comment = false;
        } else if (this_line.trim() === '' && !in_comment && !in_code) {
            pushblock();
        } else {
            if (in_comment) {
                if (lang.name === 'python') this_line = this_line.substring(spaces);
                commentblock.push(this_line);
            } else {
                if (!in_code && this_line.trim() !== '') in_code = true; 
                codeblock.push(this_line);
            }
        }
    }

    pushblock();

    if (outputFormat === 'md') {
        write_md(filename, parsed_code, outputPath, callback);
    } else if (outputFormat === 'html') {
        write_html(filename, parsed_code, outputPath, template, callback);
    }
}

// This function writes the parsed output to a markdown file, matching the original source's filename but changing the extension to .md
function write_md(filename, parsed_code, outputPath, callback) {
    var outfile,
        outcode = '';
    
    if (typeof outputPath === 'undefined') {
        outfile = filename.replace(path.extname(filename), '.md');
    } else {
        outfile = path.join(outputPath, path.basename(filename).replace(path.extname(filename), '.md'));
    }

    for (var i = 0, l = parsed_code.length; i < l; i++) {
        if (parsed_code[i].comment !== '') outcode += parsed_code[i].comment + '\n\n';
        if (parsed_code[i].code !== '') outcode += '```' + get_language(filename).name + '\n' + parsed_code[i].code + '\n```\n\n';
    }

    fs.writeFileSync(outfile, outcode, 'utf8');
    callback(null, outfile);
}

// This function writes parsed output to html
function write_html(filename, parsed_code, outputPath, template, callback) {
    var outfile,
        templatePath,
        template;

    if (typeof outputPath === 'undefined') {
        outfile = filename.replace(path.extname(filename), '.html');
    } else {
        outfile = path.join(outputPath, path.basename(filename).replace(path.extname(filename), '.html'));
    }

    if (typeof template === 'undefined') {
        templatePath = path.join(__dirname, 'template.jade');
    } else {
        templatePath = template;
    }

    template = fs.readFileSync(__dirname + '/template.jade', 'utf-8');
    var fn = jade.compile(template);
    fs.writeFileSync(outfile, fn({ gfm: gfm, data: parsed_code, hljs: hljs, lang: get_language(filename).name }));
    callback(null, outfile);
}

/*
Here we define our supported languages. Each language is a dictionary, keyed on the file extension. Inside the dictionary
we have the the following items:

* 'name': the identifier that we output to the markdown for code blocks
* 'comment': is a regex that will match a single line comment for the specific language, but does NOT include the text on the line, only the comment
* 'start': a regular expression to match the beginning of a multi-line commment block. 'start' should only match if it's on the beginning
of a line
* 'end': the partner regex to 'start' matching the end of a multi-line comment only if the match is at the end of a line.
*/
var languages = {
    '.js': { name: 'javascript', comment: /^\s*\/\/\s?/, start: /^\s*\/\*\s?/, end: /\*\/\s*$/ },
    '.py': { name: 'python', comment: /^\s*#\s?/, start: /^\s*\"\"\"\s?/, end: /\"\"\"\s*$/ },
    '.rb': { name: 'ruby', comment: /^\s*#\s?/, start: /^\s*\=begin\s?/, end: /\=end\s*$/ },
    '.lua': { name: 'lua', comment: /^\s*--\s?/, start: /^\s*--\[\[\s?/, end: /--\]\]\s*$/ },
    '.coffee': { name: 'coffeescript', comment: /^\s*#(?!##)\s?/, start: /^\s*###\s?/, end: /###\s*$/ }
};

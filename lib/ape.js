/*
## API docs? Nope, ape docs!
---
ape is a command line tool to generate documentation from your comments.
It parses your source code files, and strips markdown formatted comments out,
it then puts your code in github-flavored-markdown code blocks, and displays the comments in line.

It wasn't written to be fancy, but rather to have a simple, automated way of keeping docs on github up to date.

To use:

    git clone https://github.com/andyet/ape.git
    cd ape
    npm install
    bin/ape [list of files or directories]

I'll be making the package npm installable soon
*/

var fs = require('fs'),
    path = require('path');

// This is the exported function that does the actual parsing and documentation generation
exports.generate_doc = function (filename, callback) {
    path.exists(filename, function (exists) {
        if (exists) {
            // Convert the source file to a line array
            var code = fs.readFileSync(filename).toString().split('\n')
            parse_code(filename, code, callback);
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
}

// A simple helper function to return the dictionary of comment regexs, determined by the file extension
function get_language(filename) {
    var lang = languages[path.extname(filename)];
    return lang;
};

/*
This is the main function to parse the line array of source code, and return a new line array
containing the formatted text
*/
function parse_code(filename, code, callback) {
    var parsed_code = [],
        this_line,
        in_comment,
        in_code,
        lang = get_language(filename);

    if (typeof lang === 'undefined') return;
    
    // This function outputs a blank line, and then a github-flavored-markdown beginner for a code block
    function start_code() {
        parsed_code.push('');
        parsed_code.push('```' + lang.name);
        in_code = true;
    }

    // Here we end the gfm code block
    function end_code() {
        parsed_code.push('```');
        in_code = false;
    }

    // Loop through the lines
    for (var i = 0, l = code.length; i < l; i++) {
        this_line = code[i];
        // If the line matches the single-line comment regex, and is not a shebang (ie: #!/bin/bash), we strip out the comment delimiter and append it to the output
        if (this_line.match(lang.comment) && !in_comment && !this_line.match(/#\!/)) {
            if (in_code) end_code(); 
            parsed_code.push(this_line.replace(lang.comment, ''));
        // If the line matches the first line of a multi-line comment, and we're not already in a comment
        } else if (this_line.match(lang.start) && !in_comment) {
            if (in_code) end_code(); 
            in_comment = true;
            // Strip out the comment delimiter, append to parsed output
            this_line = this_line.replace(lang.start, '');
            if (this_line.match(lang.end)) {
                this_line = this_line.replace(lang.end, '');
                in_comment = false;
            } 
            parsed_code.push(this_line);
        // End a multi-line comment
        } else if (this_line.match(lang.end) && in_comment) {
            parsed_code.push(this_line.replace(lang.end, ''));
            in_comment = false;
        } else {
            // If we're in a comment, then we push the line as-is so as not to break markdown
            if (in_comment) {
                parsed_code.push(this_line);
            } else {
                // If we're not in a comment, and the line isn't blank, then we're in a code block. If we're not already in one, start one, if we are just append the code.
                if (!in_code && this_line.trim() !== '') start_code(); 
                parsed_code.push(this_line);
            }
        }
    }
    // Make sure we end a code block if we're in one
    if (in_code) end_code();
    write_md(filename, parsed_code, callback);
};

// This function writes the parsed output to an actual file, matching the original source's filename but changing the extension to .md
function write_md(filename, parsed_code, callback) {
    var outfile;
    outfile = filename.replace(path.extname(filename), '.md');
    fs.writeFileSync(outfile, parsed_code.join('\n'), 'utf8');
    callback(null, outfile);
};

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
    '.py': { name: 'python', comment: /^\s*#\s?/, start: /^\s*\"\"\"\s?/, end: /\"\"\"\s*$/ }
};

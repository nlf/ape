ape
===

API docs? Nope, ape docs!

ape generates API documentation in github-flavored-markup from comments in your code, and places them in line with the actual code. This allows for very easy integration with github.
Optionally, ape can also output to html with a built-in jade template, or one you specify.

    Usage: node ./bin/ape [input file|directory list]

    Options:
      --md            Output as markdown        [boolean]  [default: true]
      --html          Output as HTML            [boolean]  [default: false]
      --template, -t  Template for HTML output  [string]
      --output, -o    Output directory          [string]

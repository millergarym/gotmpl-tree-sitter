; Syntax highlighting for the Go template language.
;
; Capture names follow the tree-sitter / nvim-treesitter highlight conventions
; (see https://tree-sitter.github.io/tree-sitter/syntax-highlighting).

; ----------------------------------------------------------------------------
; Comments
; ----------------------------------------------------------------------------
(comment) @comment @spell

; ----------------------------------------------------------------------------
; Delimiters and punctuation
; ----------------------------------------------------------------------------
(ldelim) @punctuation.bracket
(rdelim) @punctuation.bracket
["(" ")"] @punctuation.bracket
"," @punctuation.delimiter
"|" @operator
[":=" "="] @operator

; ----------------------------------------------------------------------------
; Keywords (see queries/rainbow.scm for depth-based "rainbow" colouring)
; ----------------------------------------------------------------------------
[
  "if"
  "else"
  "end"
] @keyword.conditional

[
  "range"
] @keyword.repeat

[
  "break"
  "continue"
] @keyword.repeat

[
  "with"
  "block"
  "define"
  "template"
] @keyword

; ----------------------------------------------------------------------------
; Names of defined / referenced templates
; ----------------------------------------------------------------------------
(define_statement name: (_) @string.special)
(block_statement name: (_) @string.special)
(template_action name: (_) @string.special)

; ----------------------------------------------------------------------------
; Data access
; ----------------------------------------------------------------------------
(dot) @variable.builtin
(field) @property
(variable) @variable

; ----------------------------------------------------------------------------
; Function / method calls: the first operand of a command is the function.
; ----------------------------------------------------------------------------
(command . (identifier) @function.call)

; Built-in template functions.
((identifier) @function.builtin
  (#any-of? @function.builtin
    "and" "or" "not" "eq" "ne" "lt" "le" "gt" "ge"
    "len" "index" "slice" "print" "printf" "println"
    "html" "js" "urlquery" "call"))

; Any other bare identifier (e.g. an argument) is a variable-ish name.
(identifier) @variable

; ----------------------------------------------------------------------------
; Literals
; ----------------------------------------------------------------------------
(string) @string
(raw_string) @string
(char) @character
(number) @number
(boolean) @boolean
(nil) @constant.builtin

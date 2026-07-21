; Rainbow-delimiter query for the Go template language.
;
; Designed for https://github.com/HiPhish/rainbow-delimiters.nvim
;
; Each control-flow block is a `@container`; its opening/closing keywords
; ("if"/"range"/"with"/"block"/"define" ... "else" ... "end") are the
; `@delimiter`s. rainbow-delimiters.nvim then colours every delimiter inside a
; container according to that container's nesting depth, so a `{{range}}`
; nested inside an `{{if}}` gets the next colour in the rainbow, its `{{end}}`
; matches its opener, and so on.
;
; Because the keywords are direct children of their statement node, the pattern
; below only ever matches a block's *own* control keywords — the keywords of an
; inner block belong to that inner block's container.

(if_statement
  [
    "if"
    "else"
    "end"
  ] @delimiter) @container

(range_statement
  [
    "range"
    "else"
    "end"
  ] @delimiter) @container

(with_statement
  [
    "with"
    "else"
    "end"
  ] @delimiter) @container

(block_statement
  [
    "block"
    "end"
  ] @delimiter) @container

(define_statement
  [
    "define"
    "end"
  ] @delimiter) @container

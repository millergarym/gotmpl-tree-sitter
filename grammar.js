/**
 * @file Tree-sitter grammar for the Go template language (text/template & html/template).
 * @author Gary Miller <garym@nettex.com.au>
 * @license MIT
 * @see https://pkg.go.dev/text/template
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Built-in template functions (text/template global funcmap). Highlighted as
// builtins by queries/highlights.scm; here only for documentation.
// and or not eq ne lt le gt ge len index slice print printf println
// html js urlquery call slicefunc

module.exports = grammar({
  name: 'gotmpl',

  // Treat `identifier` as the keyword-extraction word so that `if`, `range`,
  // `true`, `nil`, ... are only lexed as keywords when they stand alone
  // (e.g. `ranger` is one identifier, not `range` + `r`).
  word: $ => $.identifier,

  // The control words are truly reserved: Go's template lexer maps them to
  // keyword items, so they can never be an identifier / function name. Without
  // this, `{{else}}` would be ambiguous — parseable as a bare action printing
  // an identifier called "else" instead of the else-clause delimiter.
  reserved: {
    global: _ => [
      'if', 'else', 'end', 'range', 'with',
      'block', 'define', 'template', 'break', 'continue',
    ],
  },

  // Whitespace between tokens *inside* actions is insignificant. Whitespace
  // inside template `text` is preserved because `text` is matched as a single
  // greedy token.
  extras: _ => [/\s/],

  // Benign nested-`repeat` conflicts: a control statement's body `repeat($._node)`
  // and the following `{{else}}`/`{{end}}` clause can be split two equivalent
  // ways. Both parses yield identical trees, so let the GLR parser pick.
  conflicts: $ => [
    [$._else_if_clause],
    [$._else_clause],
  ],

  rules: {
    template: $ => repeat($._node),

    _node: $ => choice(
      $.text,
      $.comment,
      $.if_statement,
      $.range_statement,
      $.with_statement,
      $.block_statement,
      $.define_statement,
      $.template_action,
      $.break_action,
      $.continue_action,
      $.action,
    ),

    // Literal template text living outside of `{{ ... }}` actions. Matches runs
    // of non-`{` characters, plus a `{` that is not the start of a `{{` action.
    text: _ => token(prec(-1, /([^{]+|\{[^{])+/)),

    // {{/* ... */}} with optional trim markers. Matched as one token so the
    // `}}` inside the comment body cannot terminate it early. The inner regex
    // is the classic C block-comment body used by tree-sitter-c.
    comment: _ => token(seq(
      '{{', optional('-'), /\s*/,
      '/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/',
      /\s*/, optional('-'), '}}',
    )),

    // Action delimiters. `{{-` / `-}}` are the whitespace-trim variants.
    ldelim: _ => token(choice('{{-', '{{')),
    rdelim: _ => token(choice('-}}', '}}')),

    // {{if pipeline}} T {{else if pipeline}} T {{else}} T {{end}}
    if_statement: $ => seq(
      $.ldelim, 'if', $.pipeline, $.rdelim,
      repeat($._node),
      repeat($._else_if_clause),
      optional($._else_clause),
      $.ldelim, 'end', $.rdelim,
    ),

    _else_if_clause: $ => seq(
      $.ldelim, 'else', 'if', $.pipeline, $.rdelim, repeat($._node),
    ),

    _else_clause: $ => seq(
      $.ldelim, 'else', $.rdelim, repeat($._node),
    ),

    // {{range pipeline}} T {{else}} T {{end}}
    range_statement: $ => seq(
      $.ldelim, 'range', $.pipeline, $.rdelim,
      repeat($._node),
      optional(seq($.ldelim, 'else', $.rdelim, repeat($._node))),
      $.ldelim, 'end', $.rdelim,
    ),

    // {{with pipeline}} T {{else}} T {{end}}
    with_statement: $ => seq(
      $.ldelim, 'with', $.pipeline, $.rdelim,
      repeat($._node),
      optional(seq($.ldelim, 'else', $.rdelim, repeat($._node))),
      $.ldelim, 'end', $.rdelim,
    ),

    // {{block "name" pipeline}} T {{end}}
    block_statement: $ => seq(
      $.ldelim, 'block', field('name', $._template_name), optional($.pipeline), $.rdelim,
      repeat($._node),
      $.ldelim, 'end', $.rdelim,
    ),

    // {{define "name"}} T {{end}}
    define_statement: $ => seq(
      $.ldelim, 'define', field('name', $._template_name), $.rdelim,
      repeat($._node),
      $.ldelim, 'end', $.rdelim,
    ),

    // {{template "name" pipeline}}
    template_action: $ => seq(
      $.ldelim, 'template', field('name', $._template_name), optional($.pipeline), $.rdelim,
    ),

    _template_name: $ => choice($.string, $.raw_string),

    break_action: $ => seq($.ldelim, 'break', $.rdelim),
    continue_action: $ => seq($.ldelim, 'continue', $.rdelim),

    // A bare action that evaluates and prints a pipeline: {{ .Foo | printf "%q" }}
    action: $ => seq($.ldelim, $.pipeline, $.rdelim),

    // pipeline := [ decl ] command ( "|" command )*
    pipeline: $ => seq(
      optional($._declaration),
      $.command,
      repeat(seq('|', $.command)),
    ),

    // $x := ...   |   $x = ...   |   $k, $v := ... (range)
    _declaration: $ => seq(
      commaSep1($.variable),
      field('operator', choice(':=', '=')),
    ),

    // A space-separated function/argument list. The first operand is the
    // function or the value being piped; the rest are arguments.
    command: $ => prec.left(repeat1($._operand)),

    _operand: $ => choice(
      $.parenthesized_pipeline,
      $.variable,
      $.field,
      $.dot,
      $.string,
      $.raw_string,
      $.char,
      $.number,
      $.boolean,
      $.nil,
      $.identifier,
    ),

    parenthesized_pipeline: $ => seq('(', $.pipeline, ')'),

    // .Field access. `.Foo.Bar` lexes as two adjacent `field` tokens.
    field: _ => token(seq('.', /[\p{L}_][\p{L}\p{Nd}_]*/)),

    // The cursor / data root: `.`
    dot: _ => '.',

    // $var or the bare `$` (the initial data).
    variable: _ => token(seq('$', optional(/[\p{L}_][\p{L}\p{Nd}_]*/))),

    identifier: _ => /[\p{L}_][\p{L}\p{Nd}_]*/,

    number: _ => token(/(0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?i?)/),

    string: _ => token(seq('"', repeat(choice(/[^"\\]/, /\\./)), '"')),

    raw_string: _ => token(seq('`', /[^`]*/, '`')),

    char: _ => token(seq("'", repeat(choice(/[^'\\]/, /\\./)), "'")),

    boolean: _ => choice('true', 'false'),

    nil: _ => 'nil',
  },
});

/**
 * Comma-separated list of at least one `rule`.
 * @param {RuleOrLiteral} rule
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

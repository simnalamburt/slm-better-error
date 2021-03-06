var Lab = require('lab'),
    Template = require('../../lib/template'),
    assertHtml = require('../helper').assertHtml;

var suite   = Lab.experiment;
var before  = Lab.before;
var after   = Lab.after;
var test    = Lab.test
var assert  = Lab.assert

suite('Html structure', function() {
  var template;
  before(function(done) {
    template = new Template
    done();
  });

  test('simple render', function(done) {
    assertHtml(template, [
      'html',
      '  head',
      '    title Simple Test Title',
      '  body ',
      '    p Hello World, meet Slim.'
      ],
      '<html><head><title>Simple Test Title</title></head><body><p>Hello World, meet Slim.</p></body></html>',
      {}, done);
  });

  test('html tag with text and empty line', function(done) {
    assertHtml(template, [
      'p Hello',
      '',
      'p World'
      ],
      '<p>Hello</p><p>World</p>',
      {}, done);
  });

  test('html namespaces', function(done) {
    assertHtml(template, [
      'html:body',
      '  html:p html:id="test" Text'
      ],
      '<html:body><html:p html:id="test">Text</html:p></html:body>',
      {}, done);
  });

  test('doctype', function(done) {
    assertHtml(template, [
      'doctype 1.1',
      'html'
      ],
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html></html>',
      {}, done);
  });

  test('render with shortcut attributes', function(done) {
    assertHtml(template, [
      'h1#title This is my title',
      '#notice.hello.world',
      '  = this.helloWorld'
      ],
      '<h1 id="title">This is my title</h1><div class="hello world" id="notice">Hello World from @env</div>',
      {}, done);
  });

  test('render with text block', function(done) {
    assertHtml(template, [
      'p',
      '  |',
      '   Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
      ],
      '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>',
      {}, done);
  });

   test('render with text block with subsequent markup', function(done) {
    assertHtml(template, [
      'p',
      '  |',
      '    Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'p Some more markup'
      ],
      '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p><p>Some more markup</p>',
      {}, done);
  });

  test('render with text block with subsequent markup', function(done) {
    assertHtml(template, [
      'p',
      '  |',
      '    Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      'p Some more markup'
      ],
      '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p><p>Some more markup</p>',
      {}, done);
  });

  test('render with text block with trailing whitespace', function(done) {
    assertHtml(template, [
      '. this is',
      '  a link to',
      'a href="link" page',
      ],
      "this is\na link to <a href=\"link\">page</a>",
      {}, done);
  });

  test('render with text block with trailing whitespace', function(done) {
    assertHtml(template, [
      'p',
      ' |',
      '  This is line one.',
      '   This is line two.',
      '    This is line three.',
      '     This is line four.',
      'p This is a new paragraph.'
      ],
      "<p>This is line one.\n This is line two.\n  This is line three.\n   This is line four.</p><p>This is a new paragraph.</p>",
      {}, done);
  });

  test('nested text with nested html one same line', function(done) {
    assertHtml(template, [
      'p',
      ' | This is line one.',
      '    This is line two.',
      ' span.bold This is a bold line in the paragraph.',
      ' |  This is more content.'
      ],
      "<p>This is line one.\n This is line two.<span class=\"bold\">This is a bold line in the paragraph.</span> This is more content.</p>",
      {}, done);
  });

  test('nested text with nested html one same line 2', function(done) {
    assertHtml(template, [
      'p',
      ' |This is line one.',
      '   This is line two.',
      ' span.bold This is a bold line in the paragraph.',
      ' |  This is more content.'
      ],
      "<p>This is line one.\n This is line two.<span class=\"bold\">This is a bold line in the paragraph.</span> This is more content.</p>",
      {}, done);
  });

  test('nested text with nested html', function(done) {
    assertHtml(template, [
      'p',
      ' |',
      '  This is line one.',
      '   This is line two.',
      '    This is line three.',
      '     This is line four.',
      ' span.bold This is a bold line in the paragraph.',
      ' |  This is more content.'
      ],
      "<p>This is line one.\n This is line two.\n  This is line three.\n   This is line four.<span class=\"bold\">This is a bold line in the paragraph.</span> This is more content.</p>",
      {}, done);
  });

  test('simple paragraph with padding', function(done) {
    assertHtml(template, [
      'p    There will be 3 spaces in front of this line.'
      ],
      '<p>   There will be 3 spaces in front of this line.</p>',
      {}, done);
  });

  test('paragraph with nested text', function(done) {
    assertHtml(template, [
      'p This is line one.',
      '   This is line two.'
      ],
      "<p>This is line one.\n This is line two.</p>",
      {}, done);
  });

  test('paragraph with padded nested text', function(done) {
    assertHtml(template, [
      'p  This is line one.',
      '   This is line two.'
      ],
      "<p> This is line one.\n This is line two.</p>",
      {}, done);
  });

  test('labels with with br', function(done) {
    assertHtml(template, [
      'label',
      '  . Название',
      '  input name="name" type="text" value=1',
      'br',
      '',
      'label',
      '  . Название 2',
      '  input name="name" type="text" value=2',
      ],
      '<label>Название <input name="name" type="text" value="1" /></label><br /><label>Название 2 <input name="name" type="text" value="2" /></label>',
      {}, done);
  });

  test('with inline mustashe', function(done) {
    assertHtml(template, [
      'label {{title}}'
      ],
      '<label>{{title}}</label>',
      {}, done);
  });

  test('paragraph with attributes and nested text', function(done) {
    assertHtml(template, [
      'p#test class="paragraph" This is line one.',
      '                         This is line two.'
      ],
      "<p class=\"paragraph\" id=\"test\">This is line one.\nThis is line two.</p>",
      {}, done);
  });

  test('output_code_with_leading_spaces', function(done) {
    assertHtml(template, [
      'p= this.helloWorld',
      'p = this.helloWorld',
      'p    = this.helloWorld'
      ],
      '<p>Hello World from @env</p><p>Hello World from @env</p><p>Hello World from @env</p>',
      {}, done);
  });

  test('single quoted attributes', function(done) {
    assertHtml(template, [
      "p class='underscored_class_name' = this.outputNumber"
      ],
      '<p class="underscored_class_name">1337</p>',
      {}, done);
  });

  test('nonstandard shortcut attributes', function(done) {
    assertHtml(template, [
      'p#dashed-id.underscored_class_name = this.outputNumber'
      ],
      '<p class="underscored_class_name" id="dashed-id">1337</p>',
      {}, done);
  });

  test('dashed attributes', function(done) {
    assertHtml(template, [
      'p data-info="Illudium Q-36" = this.outputNumber'
      ],
      '<p data-info="Illudium Q-36">1337</p>',
      {}, done);
  });

  test('dashed attributes with shortcuts', function(done) {
    assertHtml(template, [
      'p#marvin.martian data-info="Illudium Q-36" = this.outputNumber'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="marvin">1337</p>',
      {}, done);
  });

  test('parens around attributes', function(done) {
    assertHtml(template, [
      'p(id="marvin" class="martian" data-info="Illudium Q-36") = this.outputNumber'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="marvin">1337</p>',
      {}, done);
  });

  test('square brackets around attributes', function(done) {
    assertHtml(template, [
      'p[id="marvin" class="martian" data-info="Illudium Q-36"] = this.outputNumber'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="marvin">1337</p>',
      {}, done);
  });

  test('parens around attributes with equal sign snug to right paren', function(done) {
    assertHtml(template, [
      'p(id="marvin" class="martian" data-info="Illudium Q-36")= this.outputNumber'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="marvin">1337</p>',
      {}, done);
  });

  test('closed tag', function(done) {
    assertHtml(template, [
      'closed/'
      ],
      '<closed />',
      {}, done);
  });

  test('attributes with parens and spaces', function(done) {
    assertHtml(template, [
      "label[ for='filter' ]= this.helloWorld"
      ],
      '<label for="filter">Hello World from @env</label>',
      {}, done);
  });

  test('attributes with parens and spaces 2', function(done) {
    assertHtml(template, [
      "label[ for='filter' ] = this.helloWorld"
      ],
      '<label for="filter">Hello World from @env</label>',
      {}, done);
  });

  test('attributes with multiple spaces', function(done) {
    assertHtml(template, [
      "label  for='filter'  class=\"test\" = this.helloWorld"
      ],
      '<label class="test" for="filter">Hello World from @env</label>',
      {}, done);
  });

  test('closed tag with attributes', function(done) {
    assertHtml(template, [
      'closed id="test" /'
      ],
      '<closed id="test" />',
      {}, done);
  });

  test('closed tag with attributes and parens', function(done) {
    assertHtml(template, [
      'closed(id="test")/'
      ],
      '<closed id="test" />',
      {}, done);
  });

  test('render with html comments', function(done) {
    assertHtml(template, [
      'p Hello',
      '/! This is a comment',
      '',
      '   Another comment',
      'p World'
      ],
      '<p>Hello</p><!--This is a comment\n\nAnother comment--><p>World</p>',
      {}, done);
  });

  test('render with html conditional and tag', function(done) {
    assertHtml(template, [
      '/[ if IE ]',
      ' p Get a better browser.'
      ],
      '<!--[if IE]><p>Get a better browser.</p><![endif]-->',
      {}, done);
  });

  test('render with html conditional and method output', function(done) {
    assertHtml(template, [
      "/[ if IE ]",
      " = this.message('hello')"
      ],
      '<!--[if IE]>hello<![endif]-->',
      {}, done);
  });

  test('multiline attributes with method', function(done) {
    assertHtml(template, [
      'p(id="marvin"',
      'class="martian"',
      ' data-info="Illudium Q-36") = this.outputNumber'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="marvin">1337</p>',
      {}, done);
  });

  test('multiline attributes with text on same line', function(done) {
    assertHtml(template, [
      'p[id="marvin"',
      '  class="martian"',
      ' data-info="Illudium Q-36"] THE space modulator'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="marvin">THE space modulator</p>',
      {}, done);
  });

  test('multiline attributes with nested text', function(done) {
    assertHtml(template, [
      'p(id="marvin"',
      '  class="martian"',
      'data-info="Illudium Q-36")',
      '  | THE space modulator'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="marvin">THE space modulator</p>',
      {}, done);
  });

  test('multiline attributes with dynamic attr', function(done) {
    assertHtml(template, [
      'p[id=this.idHelper',
      '  class="martian"',
      '  data-info="Illudium Q-36"]',
      '  | THE space modulator'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="notice">THE space modulator</p>',
      {}, done);
  });

  test('multiline attributes with nested tag', function(done) {
    assertHtml(template, [
      'p(id=this.idHelper',
      '  class="martian"',
      '  data-info="Illudium Q-36")',
      '  span.emphasis THE',
      '  |  space modulator'
      ],
      '<p class="martian" data-info="Illudium Q-36" id="notice"><span class="emphasis">THE</span> space modulator</p>',
      {}, done);
  });

  test('multiline attributes with nested text and extra indentation', function(done) {
    assertHtml(template, [
      'li( id="myid"',
      '    class="myclass"',
      'data-info="myinfo")',
      '  a href="link" My Link'
      ],
      '<li class="myclass" data-info="myinfo" id="myid"><a href="link">My Link</a></li>',
      {}, done);
  });

  test('block expansion support', function(done) {
    assertHtml(template, [
      "ul",
      "  li.first: a href='a' foo",
      "  li:       a href='b' bar",
      "  li.last:  a href='c' baz"
      ],
      '<ul><li class=\"first\"><a href=\"a\">foo</a></li><li><a href=\"b\">bar</a></li><li class=\"last\"><a href=\"c\">baz</a></li></ul>',
      {}, done);
  });

  test('block expansion class attributes', function(done) {
    assertHtml(template, [
      '.a: .b: #c d'
      ],
      '<div class="a"><div class="b"><div id="c">d</div></div></div>',
      {}, done);
  });

  test('block expansion nesting', function(done) {
    assertHtml(template, [
      'html: body: .content',
      '  | Text'
      ],
      '<html><body><div class=\"content\">Text</div></body></html>',
      {}, done);
  });

  test('eval attributes once', function(done) {
    assertHtml(template, [
      'input[value=++this.x]',
      'input[value=++this.x]'
      ],
      '<input value="1" /><input value="2" />',
      {}, done);
  });

  test('html line indicator', function(done) {
    assertHtml(template, [
      '<html>',
      '  head',
      '    meta name="keywords" content=this.helloWorld',
      '  - if true',
      '    <p>${this.helloWorld}</p>',
      '      span = this.helloWorld',
      '</html>'
    ],
    '<html><head><meta content="Hello World from @env" name="keywords" /></head><p>Hello World from @env</p><span>Hello World from @env</span></html>',
    {}, done);
  });

  test('test context', function(done) {
    var Ctx = require('../../lib/ctx');
    Ctx.cache = {};

    var ctx = new Ctx();
    ctx.filename = 'script'

    Ctx.cache['layout.slm'] = template.exec([
      'html',
      '  head',
      '    = content("head")',
      '  body',
      '    = content()'
      ].join('\n'), {}, ctx);

    Ctx.cache['partialLayout.slm'] = template.exec([
      'p Partial Layout',
      '= content()'
      ].join('\n'), {}, ctx);

    Ctx.cache['partialWorld.slm'] = template.exec([
      '- extend("partialLayout")',
      '- if this.what',
      '  strong The partial is ${this.what}',
      '= content("partial.override")',
      '= content()'
      ].join('\n'), {}, ctx);

    var src = [
    '- extend("layout")',
    '= content("head");',
    '  meta name="keywords" content=this.who',
    'p Hello, ${this.who}',
    '= partial("partial" + this.who, {what: this.what})',
    '  = content("partial.override")',
    '    p nice',
    '  strong super!!! ${this.who}'
    ].join('\n')


    var result = template.eval(src, {who: 'World', what: 'the best'}, {}, ctx);
    assert.deepEqual(result, '<html><head><meta content="World" name="keywords" /></head><body><p>Hello, World</p><p>Partial Layout</p><strong>The partial is the best</strong><p>nice</p><strong>super!!! World</strong></body></html>');
    done();
  });

});

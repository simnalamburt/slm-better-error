var Engine = require('./engine'),
  Parser = require('./parser'),
  Embeddeds = require('./filters/embedded'),
  Interpolate = require('./filters/interpolate'),
  Brackets = require('./filters/brackets'),
  Controls = require('./filters/controls'),
  AttrMerge = require('./filters/attr_merge'),
  CodeAttributes = require('./filters/code_attributes'),
  AttrRemove = require('./filters/attr_remove'),
  FastHtml = require('./html/fast'),
  Escape = require('./filters/escape'),
  ControlFlow = require('./filters/control_flow'),
  MultiFlattener = require('./filters/multi_flattener'),
  StaticMerger = require('./filters/static_merger'),
  StringGenerator = require('./generators/string'),
  Runtime = require('./runtime'),
  Ctx = require('./ctx');

function Template() {
  this._engine = new Engine();
  this.Embeddeds = Embeddeds;

  this._embedded = new Embeddeds.Embedded();

  this.registerEmbedded('script',     new Embeddeds.Javascript);
  this.registerEmbedded('javascript', new Embeddeds.Javascript({typeAttribute: true}));
  this.registerEmbedded('css',        new Embeddeds.CSS);

  var filters = [
    new Parser,
    this._embedded,
    new Interpolate,
    new Brackets,
    new Controls,
    new AttrMerge,
    new CodeAttributes,
    new AttrRemove,
    new FastHtml,
    new Escape,
    new ControlFlow,
    new MultiFlattener,
    new StaticMerger,
    new StringGenerator,
  ];
  for (var i = 0, f; f = filters[i]; i++) {
    this._engine.use(f);
  }
}

Template.prototype.registerEmbedded = function(name, engine) {
  this._embedded.register(name, engine);
};

Template.prototype.registerEmbeddedFunction = function(name, renderer) {
  var engine = new this.Embeddeds.InterpolateEngine(renderer);
  this.registerEmbedded(name, engine);
};

Template.prototype.eval = function(src, model, options, ctx) {
  ctx = ctx || new Ctx();

  ctx._content = ctx.content.bind(ctx);
  ctx._extend = ctx.extend.bind(ctx);
  ctx._partial = ctx.partial.bind(ctx);
  var rt = Runtime;
  ctx.rt = rt;

  var fn = eval(this.src(src, options))[0];

  return fn.call(model, ctx);
};

Template.prototype.exec = function(src, options, ctx) {
  ctx = ctx || new Ctx();

  var content = ctx.content.bind(ctx);
  var extend = ctx.extend.bind(ctx);
  var partial = ctx.partial.bind(ctx);
  var rt = Runtime;

  return eval(this.src(src, options))[0];
};

Template.prototype.src = function(src, compileOptions) {
  return [
    '[function(c) {',
    'c.m = this;',
    'var sp = c.stack.length, content = c._content, extend = c._extend, partial = c._partial;',
    this._engine.exec(src, compileOptions),
    'c.res=_b;return c.pop(sp);}]'
  ].join('');
}

Template.prototype.compile = function(src, compileOptions) {
  compileOptions = compileOptions || {};

  var ctx = new Ctx();
  if (compileOptions.useCache !== undefined && !compileOptions.useCache) {
    ctx._load = ctx._loadWithoutCache;
  }

  ctx.template = this;
  ctx.basePath = compileOptions['basePath'];
  ctx.filename = compileOptions['filename'];

  ctx._content = ctx.content.bind(ctx);
  ctx._extend = ctx.extend.bind(ctx);
  ctx._partial = ctx.partial.bind(ctx);
  var rt = Runtime;
  ctx.rt = rt;

  var code = this.src(src, compileOptions);
  try {
    var fn = eval(code)[0];
  } catch(e) {
    if (e instanceof SyntaxError) {
      var _msg = '';
      function msg(s) { _msg += s + '\n'; }

      msg(ctx.filename);
      msg('(from immediate code)');

      var lines = code.split('\n');
      function ch(s,n) { return new Array(n).join(s); }
      +function() {
        try {
          return require('esprima')
            .parse(code, { tolerant: true, loc: true })
            .errors;
        } catch(err) {
          return [err];
        }
      }().forEach(function(err) {
        var num = err.lineNumber - 1;
        var width = 3 + (num+'').length;
        function line(i) {
          return ch(' ', width - (i+'').length + 1) + i + '| ' + lines[i];
        }

        var radius = 3;
        var i   = Math.max(num - radius, 0);
        var end = Math.min(num + radius + 1, lines.length);
        while (i < num) { msg(line(i++)); }
        msg(line(i++));
        msg(ch('-', width + 2 + err.column) + '^');
        while (i < end) { msg(line(i++)); }
        msg('');
        msg(err.description);
        msg('');
      });

      e.message = _msg.trim();
    }

    throw e;
  }

  var fnWrap = function(context, runtimeOptions) {
    var res = fn.call(context, ctx);
    ctx.reset();
    return res;
  };
  return fnWrap;
};


module.exports = Template;

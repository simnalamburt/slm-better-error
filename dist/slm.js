(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Path = require('path');
var FS = require('fs');

function Ctx() {
  this.reset();
  this.template = null;
  this.basePath = null;
}

Ctx.cache = {};

var CtxProto = Ctx.prototype;

CtxProto.reset = function() {
  this.contents = {};
  this.res = '';
  this.stack = [];
  this.m = null;
}

CtxProto.pop = function(sp) {
  var l = this.stack.length;
  var oldFilename = this.filename;
  while(sp < l--) {
    var path = this.resolvePath(this.stack.pop());
    var fn = this.load(path);
    this.filename = path;
    fn.call(this.m, this);
  }
  this.filename = oldFilename;
  return this.res;
}

CtxProto.partial = function(path, model, cb) {
  if (cb) {
    this.res = cb.call(this.m, this);
  }

  path = this.resolvePath(path);

  var f = this.load(path), oldModel = this.m, oldFilename = this.filename;
  this.filename = path;
  var res = this.rt.safe(f.call(this.m = model, this));
  this.m = oldModel;
  this.filename = oldFilename;
  return res;
}

CtxProto.extend = function(path) {
  this.stack.push(path);
}

CtxProto.content = function() {
  switch(arguments.length) {
    case 0:
      return this.rt.safe(this.res);
    case 1:
      return this.contents[arguments[0]] || '';
    case 2:
      var name = arguments[0], cb = arguments[1];
      if (name) {
        // capturing block
        this.contents[name] = cb.call(this.m);
        return '';
      } else {
        return cb.call(this.m);
      }
  }
}

CtxProto.load = function(path) {
  var fn = Ctx.cache[path];
  if (fn) {
    return fn;
  }

  var src = FS.readFileSync(path, 'utf8');
  Ctx.cache[path] = fn = this.template.exec(src)
  return fn;
};

CtxProto.resolvePath = function(path) {
  var dirname  = Path.dirname,
      basename = Path.basename,
      join = Path.join;

  if (path[0] !== '/' && !this.filename)
    throw new Error('the "filename" option is required to use with "relative" paths');

  if (path[0] === '/' && !this.basePath)
    throw new Error('the "basePath" option is required to use with "absolute" paths');

  path = join(path[0] === '/' ? this.basePath : dirname(this.filename), path);

  if (basename(path).indexOf('.') === -1) {
    path += '.slm';
  }

  return path;
};

module.exports = Ctx;

},{"fs":25,"path":26}],2:[function(require,module,exports){
function Node() {
  this.method = null;
  this.children = {};
}

Node.prototype.compile = function(level, callMethod) {

  if (this.method) {
    callMethod = 'this.' + this.method + '(exps)';
  }

  var code = 'switch(exps[' + level + ']) {';
  var empty = true;

  for(var key in this.children) {
    empty = false;
    code += "\ncase '" + key +"':\n";
    code +=  this.children[key].compile(level + 1, callMethod) + ';';
  }

  if (empty) {
    return 'return ' + callMethod;
  }

  code += '\ndefault:\nreturn ' + (callMethod || 'exps') + ';}';

  return code;
}

function Dispatcher() {
  this.methodSplitRE = /_/;
  this.methodRE = /^on(_[a-zA-Z0-9]+)*$/;
}

var DispatcherProto = Dispatcher.prototype;


// Dispatching

DispatcherProto.exec = function(exp) {
  return this.compile(exp);
}

DispatcherProto.compile = function(exp) {
  return this.dispatcher(exp);
}

DispatcherProto.dispatcher = function(exp) {
  return this.replaceDispatcher(exp);
}

DispatcherProto.dispatchedMethods = function() {
  var res = [];

  for (var key in this) {
    if (this.methodRE.test(key)) {
      res.push(key);
    }
  }
  return res;
}

DispatcherProto.replaceDispatcher = function(exp) {
  var tree = new Node;
  var dispatchedMethods = this.dispatchedMethods();
  for (var i = 0, method; method = dispatchedMethods[i]; i++) {
    var types = method.split(this.methodSplitRE);
    var node = tree;
    for (var j = 1, type; type = types[j]; j++) {
      var n = node.children[type];
      node = node.children[type] = n || new Node;
    }
    node.method = method;
  }
  this.dispatcher = Function('exps', tree.compile(0));
  return this.dispatcher(exp);
}

module.exports = Dispatcher;

},{}],3:[function(require,module,exports){
function Engine() {
  this.chain = [];
}

var EngineProto = Engine.prototype;

EngineProto.use = function(filter) {
  this.chain.push(filter);
}

EngineProto.exec = function(src, options) {
  var res = src;
  for (var i = 0, f; f = this.chain[i]; i++) {
    res = f.exec(res, options);
  }

  return res;
}

module.exports = Engine;

},{}],4:[function(require,module,exports){
var Template = require('./template');

var template = new Template();

exports.compile = function(src, options) {
  return template.compile(src, options);
};

},{"./template":24}],5:[function(require,module,exports){
var Dispatcher = require('./dispatcher');

function Filter() {};
var FilterProto = Filter.prototype = new Dispatcher;

var _uniqueName = 0;

// Tools

FilterProto.isEmptyExp = function(exp) {
  switch (exp[0]) {
  case 'multi':
    for (var i = 1, l = exp.length; i < l; i++) {
      if (!this.isEmptyExp(exp[i])) {
        return false;
      }
    }
    return true;
  case 'newline':
    return true;
  default:
    return false;
  }
}

FilterProto.uniqueName = function() {
  _uniqueName++;
  return '$lm' + _uniqueName.toString(16);
}

// Core

FilterProto.on_multi = function(exps) {
  for (var i = 1, l = exps.length; i < l; i++) {
    exps[i] = this.compile(exps[i]);
  }
  return exps;
}

FilterProto.on_capture = function(exps) {
  return ['capture', exps[1], exps[2], this.compile(exps[3])];
}

// Control Flow

FilterProto.on_if = function(exps) {
  for (var i = 2, l = exps.length; i < l; i++) {
    exps[i] = this.compile(exps[i]);
  }
  return exps;
}

FilterProto.on_switch = function(exps) {
  for (var i = 2, l = exps.length; i < l; i++) {
    var exp = exps[i];
    exps[i] = [exp[0], this.compile(exp[1])];
  }
  return exps;
}

FilterProto.on_block = function(exps) {
  return ['block', exps[1], this.compile(exps[2])];
}

// Escaping

FilterProto.on_escape = function(exps) {
  return ['escape', exps[1], this.compile(exps[2])];
};

module.exports = Filter;

},{"./dispatcher":2}],6:[function(require,module,exports){
var Slm = require('./slm');

function AttrMerge() {
  this.mergeAttrs = {'id' : '-', 'class' : ' '};
}

AttrMerge.prototype = new Slm;

AttrMerge.prototype.on_html_attrs = function(exps) {
  var names = [], values = {};
  for (var i = 2, l = exps.length; i < l; i++) {
    var attr = exps[i];
    var name = attr[2].toString(), value = attr[3];
    if (values[name]) {
      if (!this.mergeAttrs[name]) {
        throw new Error('Multiple ' + name + ' attributes specified');
      }

      values[name].push(value);
    } else {
      values[name] = [value];
      names.push(name);
    }
  }

  names.sort();

  var attrs = [];
  for (var i = 0, name; name = names[i]; i++) {
    var value = values[name], delimiter;
    if ((delimiter = this.mergeAttrs[name]) && value.length > 1) {
      var exp = ['multi'];
      var all = false;
      for (var j = 0, v; v = value[j]; j++) {
        all = this.isContainNonEmptyStatic(v);
        if (!all) {
          break;
        }
      }
      if (all) {
        for (var j = 0, v; v = value[j]; j++) {
          if (j !== 0) {
            exp.push(['static', delimiter]);
          }
          exp.push(v);
        }
        attrs[i] = ['html', 'attr', name, exp];
      } else {
        var captures = this.uniqueName();
        exp.push(['code', 'var ' + captures + '=[];']);
        for (var j = 0, v; v = value[j]; j++) {
          exp.push(['capture', captures + '[' + j + ']', captures + '[' + j + ']' + "='';", v]);
        }
        exp.push(['dynamic', 'rt.rejectEmpty('+captures +').join("' + delimiter + '")']);
        attrs[i] = ['html', 'attr', name, exp];
      }
    } else {
      attrs[i] = ['html', 'attr', name, value[0]];
    }
  }

  return ['html', 'attrs'].concat(attrs);
}

module.exports = AttrMerge;

},{"./slm":16}],7:[function(require,module,exports){
var Slm = require('./slm');

function AttrRemove() {
  this.removeEmptyAttrs = ['id', 'class'];
}

AttrRemove.prototype = new Slm;

AttrRemove.prototype.on_html_attr = function(exps) {
  var name = exps[2], value = exps[3];
  if (this.removeEmptyAttrs.indexOf(name.toString()) === -1) {
    return Slm.prototype.on_html_attr.call(this, exps);
  }

  if (this.isEmptyExp(value)) {
    return value;
  } else if (this.isContainNonEmptyStatic(value)) {
    return ['html', 'attr', name, value];
  } else {
    var tmp = this.uniqueName();
    return [
      'multi',
        ['capture', tmp, "var " + tmp + "='';", this.compile(value)],
        ['if', tmp + '.length',
          ['html', 'attr', name, ['dynamic', tmp]]
        ]
    ];
  }
}

module.exports = AttrRemove;

},{"./slm":16}],8:[function(require,module,exports){
var Slm = require('./slm');

function Brackets() {
  this.blockRe = /^(case|default)\b/;
  this.wrapCondRe = /^(for|switch|catch|while|if|else\s+if)\s+(?!\()((\S|\s\S)*)\s*$/
  this.ifRe = /^(if|switch|while|for|else|finally|catch)\b/
  this.callbackRe = /(function\s*\([^\)]*\)\s*)[^\{]/;
}

var BracketsProto = Brackets.prototype = new Slm;

BracketsProto.on_slm_control = function(exps) {
  var code = exps[2], content = exps[3], m;

  if (m = this.wrapCondRe.exec(code)) {
    code = code.replace(m[2], '(' + m[2] + ')');
  }

  code = this.expandCallback(code, content);
  return ['slm', 'control', code, this.compile(content)]
}

BracketsProto.on_slm_output = function(exps) {
  var code = exps[3], content = exps[4], postCode = '}', m;
  code = this.expandCallback(code, content);
  return ['slm', 'output', exps[2], code, this.compile(content)];
}

BracketsProto.expandCallback = function(code, content) {
  var postCode = '}', m, index;
  if (!this.blockRe.test(code) && !this.isEmptyExp(content)) {
    if (!this.ifRe.test(code)) {
      if (m = this.callbackRe.exec(code)) {
        index = m.index + m[1].length;
        postCode += code.slice(index);
        code = code.slice(0, index);
      } else if ((index = code.lastIndexOf(')')) !== -1) {
        var firstIndex = code.indexOf('(');
        if (firstIndex !== -1) {
          var args = code.slice(firstIndex + 1, index);
          postCode += code.slice(index);
          if (/^\s*$/.test(args)) {
            code = code.slice(0, index) + 'function()';
          } else {
            code = code.slice(0, index) + ',function()';
          }
        }
      }
    }
    code += '{';
    content.push(['code', postCode]);

  }
  return code;
}

module.exports = Brackets;

},{"./slm":16}],9:[function(require,module,exports){
var Slm = require('./slm');

function CodeAttributes() {
  this.attr = null;
  this.mergeAttrs = {'class':' '};
}

var CodeAttributesProto = CodeAttributes.prototype = new Slm;

CodeAttributesProto.on_html_attrs = function(exps) {
  var res = ['multi'];
  for (var i = 2, l = exps.length; i < l; i++) {
    res.push(this.compile(exps[i]));
  }
  return res;
}

CodeAttributesProto.on_html_attr = function(exps) {
  var name = exps[2], value = exps[3];
  if (value[0] === 'slm' && value[1] === 'attrvalue' && !this.mergeAttrs[name]) {
    // We handle the attribute as a boolean attribute
    var escape = value[2], code = value[3];
    switch(code) {
    case 'true':
      return ['html', 'attr', name, ['multi']];
    case 'false':
    case 'null':
    case 'undefined':
      return ['multi'];
    default:
      var tmp = this.uniqueName();
      return ['multi',
       ['code', 'var ' + tmp + '=' + code],
       ['switch', tmp,
        ['true', ['multi',
          ['html', 'attr', name, ['multi']],
          ['code', 'break']]],
        ['false', ['multi']],
        ['undefined', ['multi']],
        ['null', ['code', 'break']],
        ['default', ['html', 'attr', name, ['escape', escape, ['dynamic', tmp]]]]]];
    }
  } else {
    // Attribute with merging
    this.attr = name;
    return Slm.prototype.on_html_attr.call(this, exps);
  }
}

CodeAttributesProto.on_slm_attrvalue = function(exps) {
  var escape = exps[2], code = exps[3];
  // We perform attribute merging on Array values
  var delimiter = this.mergeAttrs[this.attr]
  if (delimiter) {
    var tmp = this.uniqueName();
    return ['multi',
     ['code', 'var ' + tmp + '=' + code + ';'],
     ['if', tmp + ' instanceof Array',
      ['multi',
        ['code',  tmp + '=rt.rejectEmpty(rt.flatten(' + tmp + '));'],
       ['escape', escape, ['dynamic', tmp + '.join("'+ delimiter +'")']]],
      ['escape', escape, ['dynamic', tmp]]]]
  } else {
    return ['escape', escape, ['dynamic', code]];
  }
}

module.exports = CodeAttributes;

},{"./slm":16}],10:[function(require,module,exports){
var Slm = require('./slm');

function ControlFlow() {}

var FlowProto = ControlFlow.prototype = new Slm;

FlowProto.on_switch = function(exps) {
  var arg = exps[1],
      res = ['multi', ['code', "switch(" + arg + "){"]],
      len = exps.length;
  for (var i = 2; i < len; i++) {
    var exp = exps[i];
    res.push(['code', exp[0] === 'default' ? 'default:' : 'case ' + exp[0] + ':']);
    res.push(this.compile(exp[1]));
  }

  res.push(['code', '}'])
  return res;
}

FlowProto.on_if = function(exps) {
  var condition = exps[1], yes = exps[2], no = exps[3];

  var result = ['multi', ['code', "if(" + condition + "){"], this.compile(yes)]
  while (no && no[0] === 'if') {
    result.push(['code', "}else if(" + no[1] + "){"]);
    result.push(this.compile(no[2]));
    no = no[3];
  }
  if (no) {
    result.push(['code', '}else{']);
    result.push(this.compile(no));
  }
  result.push(['code', '}']);
  return result;
}

FlowProto.on_block = function(exps) {
  var code = exps[1], exp = exps[2];
  return ['multi', ['code', code], this.compile(exp)];
}

module.exports = ControlFlow;

},{"./slm":16}],11:[function(require,module,exports){
var Slm = require('./slm');

function Control() {
  this.ifRe = /^(if)\b|{\s*$/;
}

var ControlProto = Control.prototype = new Slm;

ControlProto.on_slm_control = function(exps) {
  return ['multi', ['code', exps[2]], this.compile(exps[3])];
}

ControlProto.on_slm_output = function(exps) {
  var escape = exps[2], code = exps[3], content = exps[4];
  if (this.ifRe.test(code)) {
    var tmp = this.uniqueName();
    var tmp2 = this.uniqueName();
    content = this.compile(content);
    content.splice(content.length - 1, 0, ['code', 'return rt.safe(' + tmp2 + ');']);
    return ['multi',
      // Capture the result of the code in a variable. We can't do
      // `[:dynamic, code]` because it's probably not a complete
      // expression (which is a requirement for Temple).
      ['block', 'var ' + tmp + '=' + code,

        // Capture the content of a block in a separate buffer. This means
        // that `yield` will not output the content to the current buffer,
        // but rather return the output.
        //
        // The capturing can be disabled with the option :disable_capture.
        // Output code in the block writes directly to the output buffer then.
        // Rails handles this by replacing the output buffer for helpers.
        // options[:disable_capture] ? compile(content) : [:capture, unique_name, compile(content)]],
        ['capture', tmp2, "var " + tmp2 + "='';", content]],

       // Output the content.
      ['escape', 'escape', ['dynamic', tmp]]
    ];
  } else {
    return ['multi', ['escape', escape, ['dynamic', code]], content];
  }
}

ControlProto.on_slm_text = function(exps) {
  return this.compile(exps[2]);
}

module.exports = Control;

},{"./slm":16}],12:[function(require,module,exports){
var Slm = require('./slm');

function TextCollector() {}
var TextProto = TextCollector.prototype = new Slm();

TextProto.exec = function(exp) {
  this.collected = ''
  Slm.prototype.exec.call(this, exp);
  return this.collected;
}

TextProto.on_slm_interpolate = function(exps) {
  this.collected += exps[2];
  return null;
}

function NewlineCollector() {}
var NewlineProto = NewlineCollector.prototype = new Slm();

NewlineProto.exec = function(exp) {
  this.collected = ['multi'];
  Slm.prototype.exec.call(this, exp);
  return this.collected;
}

NewlineProto.on_newline = function() {
  this.collected.push(['newline']);
  return null;
}

function Engine() {
  this.textCollector = new TextCollector();
  this.newlineCollector = new NewlineCollector();
}
var EngineProto = Engine.prototype = new Slm();

EngineProto.collectText = function(body) {
  return this.textCollector.exec(body);
}

EngineProto.collectNewlines = function(body) {
  return this.newlineCollector.exec(body);
}

function JavascriptEngine() {}
JavascriptEngine.prototype = new Engine();

JavascriptEngine.prototype.on_slm_embedded = function(exps) {
  var engine = exps[2], body = exps[3];
  return ['html', 'tag', 'script',['html', 'attrs',
    ['html', 'attr', 'type', ['static', 'text/javascript']]], body];
}

function CSSEngine(){}
CSSEngine.prototype = new Engine();

CSSEngine.prototype.on_slm_embedded = function(exps) {
  var engine = exps[2], body = exps[3];
  return ['html', 'tag', 'style', ['html', 'attrs',
    ['html', 'attr', 'type', ['static', 'text/css']]], body];
}

function Embedded() {
  this.engines = {}
}

var EmbeddedProto = Embedded.prototype = new Slm();

EmbeddedProto.register = function(name, filter) {
  this.engines[name] = filter;
};

EmbeddedProto.on_slm_embedded = function(exps) {
  var name = exps[2], body = 3;
  var engine = this.engines[name];
  if (!engine) {
    throw new Error('Embedded engine ' + name + ' is not registered.')
  }
  return this.engines[name].on_slm_embedded(exps);
}

exports.Embedded = Embedded;
exports.JavascriptEngine = JavascriptEngine;
exports.CSSEngine = CSSEngine;
exports.TextCollector = TextCollector;
exports.NewlineCollector = NewlineCollector;

},{"./slm":16}],13:[function(require,module,exports){
var Filter = require('../filter'),
    Runtime = require('../runtime');

function Escape() {
  this.disableEscape = false;
  this.escape = false;
  this.escaper = Runtime.escape;
}

var EscapeProto = Escape.prototype = new Filter;

EscapeProto.escapeCode = function(v) {
  return 'rt.escape(' + v.replace(/;+$/, '') + ')';
}

EscapeProto.on_escape = function(exps) {
  var old = this.escape;
  this.escape = exps[1] && !this.disableEscape;
  try {
    return this.compile(exps[2]);
  } finally {
    this.escape = old;
  }
}

EscapeProto.on_static = function(exps) {
  return ['static', this.escape ? this.escaper(exps[1]) : exps[1]];
}

EscapeProto.on_dynamic = function(exps) {
  return ['dynamic', this.escape ? this.escapeCode(exps[1]) : exps[1]];
}

module.exports = Escape;

},{"../filter":5,"../runtime":23}],14:[function(require,module,exports){
var Slm = require('./slm');

function Interpolation() {
  this.escapedInterpolationRe = /^\\\$\{/;
  this.interpolationRe = /^\$\{/;
  this.staticTextRe = /^([\$\\]|[^\$\\]*)/;
}

var InterpolationProto = Interpolation.prototype = new Slm;

InterpolationProto.on_slm_interpolate = function(exps) {
  var str = exps[2], m, code;

  // Interpolate variables in text (#{variable}).
  // Split the text into multiple dynamic and static parts.
  var block = ['multi'];
  do {
    // Escaped interpolation
    if (m = this.escapedInterpolationRe.exec(str)) {
      block.push(['static', '${']);
      str = str.slice(m[0].length);
    } else if (m = this.interpolationRe.exec(str)) {
      // Interpolation
      var res = this.parseExpression(str.slice(m[0].length));
      str = res[0], code = res[1];
      var escape = code[0] !== '=';
      block.push(['slm', 'output', escape, escape ? code : code.slice(1), ['multi']]);
    } else if (m = this.staticTextRe.exec(str)) {
      // Interpolation
      block.push(['static', m[0]]);
      str = str.slice(m[0].length);
    }
  } while (str.length);

  return block;
}

InterpolationProto.parseExpression = function(str) {
  for (var count = 1, i = 0, l = str.length; i < l && count; i++) {
    if (str[i] === '{') {
      count ++;
    } else if (str[i] === '}') {
      count --;
    }
  }

  if (count) {
    throw new Error('Text interpolation: Expected closing }');
  }

  var code = str.substring(0, i - 1);
  return [str.slice(i), code];
}

module.exports = Interpolation;

},{"./slm":16}],15:[function(require,module,exports){
var Filter = require('../filter');

// Flattens nested multi expressions

function MultiFlattener() {}
MultiFlattener.prototype = new Filter;

MultiFlattener.prototype.on_multi = function(exps) {
  // If the multi contains a single element, just return the element
  var len = exps.length;
  if (len === 2) {
    return this.compile(exps[1]);
  }

  var result = ['multi'];

  for (var i = 1; i < len; i++) {
    var exp = exps[i];
    exp = this.compile(exp);
    if (exp[0] === 'multi') {
      for (var j = 1, l = exp.length; j < l; j++) {
        result.push(exp[j]);
      }
    } else {
      result.push(exp);
    }
  }

  return result;
}

module.exports = MultiFlattener;

},{"../filter":5}],16:[function(require,module,exports){
var Filter = require('../html/html');

function Slm() {}
var SlmProto = Slm.prototype = new Filter;

// Pass-through handlers
SlmProto.on_slm_text = function(exps) {
  exps[2] = this.compile(exps[2]);
  return exps;
}

SlmProto.on_slm_embedded = function(exps) {
  exps[3] = this.compile(exps[3]);
  return exps;
}

SlmProto.on_slm_control = function(exps) {
  exps[3] = this.compile(exps[3]);
  return exps;
}

SlmProto.on_slm_output = function(exps) {
  exps[4] = this.compile(exps[4]);
  return exps;
}

module.exports = Slm;

},{"../html/html":21}],17:[function(require,module,exports){
var Filter = require('../filter');

/**
* Merges several statics into a single static.  Example:
*
*   ['multi',
*     ['static', "Hello "],
*     ['static', "World!"]]
*
* Compiles to:
*
*   ['static', "Hello World!"]
*/

function StaticMerger() {}
StaticMerger.prototype = new Filter;

StaticMerger.prototype.on_multi = function(exps) {
  var res = ['multi'], node;

  for (var i = 1, l = exps.length; i < l; i++) {
    var exp = exps[i];
    if (exp[0] === 'static') {
      if (node) {
        node[1] += exp[1];
      } else {
        node = ['static', exp[1]];
        res.push(node)
      }
    } else {
      res.push(this.compile(exp));
      if (exp[0] !== 'newline') {
        node = null;
      }
    }
  }

  return res.length == 2 ? res[1] : res;
}

module.exports = StaticMerger;

},{"../filter":5}],18:[function(require,module,exports){
var Dispatcher = require('./dispatcher');

function Generator() {
  this.buffer = '_b';
}

var GeneratorProto = Generator.prototype = new Dispatcher();

GeneratorProto.exec = function(exp) {
  return [this.preamble(), this.compile(exp)].join('\n');
}

GeneratorProto.on = function(exp) {
  throw new Error('Generator supports only core expressions - found ' + JSON.stringify(exp));
}

GeneratorProto.on_multi = function(exps) {
  var res = [];
  for (var i = 1, l = exps.length; i < l; i++) {
    res[i] = this.compile(exps[i]);
  }
  return res.join('\n');
}

GeneratorProto.on_newline = function() {
  return '\n';
}

GeneratorProto.on_static = function(exps) {
  return this.concat(JSON.stringify(exps[1]));
}

GeneratorProto.on_dynamic = function(exps) {
  return this.concat(exps[1]);
}

GeneratorProto.on_code = function(exps) {
  return exps[1];
}

GeneratorProto.concat = function(str) {
  return this.buffer + '+=' + str + ';';
}

module.exports = Generator;

},{"./dispatcher":2}],19:[function(require,module,exports){
var Generator = require('../generator');

function StringGenerator(name, capture, initializer) {
  this.buffer = name || '_b';
  this.capture = capture;
  this.initializer = initializer;
}
var StringGeneratorProto = StringGenerator.prototype = new Generator;

StringGeneratorProto.preamble = function() {
  if (this.capture && this.initializer) {
    return this.initializer;
  }
  return "var " + this.buffer + "='';";
}

StringGeneratorProto.on_capture = function(exps) {
  var generator = new StringGenerator(exps[1], true, exps[2]);
  generator.dispatcher = this.dispatcher;
  return generator.exec(exps[3]);
}

module.exports = StringGenerator;

},{"../generator":18}],20:[function(require,module,exports){
var Html = require('./html');

function Fast(options) {

  this.format = 'xhtml';
  this.attrQuote = '"';
  this.autoclose  = 'base basefont bgsound link meta area br embed img keygen wbr input menuitem param source track hr col frame'.split(/\s/);
  this.jsWrapper = 'guess';

  this.HTML = ['html', 'html4', 'html5'];

  if (this.jsWrapper === 'guess') {
    if (this.format === 'xhtml') {
      this.jsWrapper = 'cdata';
    } else {
      this.jsWrapper = 'comment';
    }
  }

  switch(this.jsWrapper) {
    case 'comment':
      this.jsWrapper = ['<!--\n', '\n//-->'];
      break;
    case 'cdata':
      this.jsWrapper = ['\n//<![CDATA[\n', '\n//]]>\n'];
      break;
    case 'both':
      this.jsWrapper = ['<!--\n//<![CDATA[\n', '\n//]]>\n//-->'];
  }
}

var FastProto = Fast.prototype = new Html;

FastProto.on_html_doctype = function(exps) {
  var type = exps[2];

  var XHTML_DOCTYPES = {
    '1.1'          : '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">',
    'html'         : '<!DOCTYPE html>',
    'strict'       : '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">',
    'frameset'     : '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Frameset//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-frameset.dtd">',
    'basic'        : '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML Basic 1.1//EN" "http://www.w3.org/TR/xhtml-basic/xhtml-basic11.dtd">',
    'transitional' : '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    'svg'          : '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'
  }

  var HTML_DOCTYPES = {
    'html'         : '<!DOCTYPE html>',
    'strict'       : '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">',
    'frameset'     : '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Frameset//EN" "http://www.w3.org/TR/html4/frameset.dtd">',
    'transitional' : '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">',
  }

  type = type.toString().toLowerCase();
  var m, str;

  if (m = /^xml(\s+(.+))?$/.exec(type)) {
    if (this.format !== 'xhtml') {
      throw new Error('Invalid xml directive in html mode');
    }
    var w = this.attrQuote;
    str = "<?xml version=" + w + "1.0" + w + " encoding=" + w + (m[2] || 'utf-8') + w + " ?>";
  } else if (this.format !== 'xhtml') {
    str = HTML_DOCTYPES[type];
    if (!str) {
      throw new Error("Invalid html doctype " + type);
    }
  } else {
    str = XHTML_DOCTYPES[type];
    if (!str) {
      throw new Error("Invalid xhtml doctype " + type);
    }
  }

  return ['static', str];
}

FastProto.on_html_comment = function(exps) {
  return ['multi', ['static', '<!--'], this.compile(exps[2]), ['static', '-->']];
}

FastProto.on_html_condcomment = function(exps) {
  return this.on_html_comment(['html', 'comment', [
    'multi',
      ['static', '[' + exps[2] + ']>'], exps[3], ['static', '<![endif]']]]);
}

FastProto.on_html_tag = function(exps) {
  var name = exps[2].toString(), attrs = exps[3], content = exps[4];

  var closed = !content || (this.isEmptyExp(content) && this.autoclose.indexOf(name) !== -1);

  var res = [
    'multi',
      ['static', '<' + name],
      this.compile(attrs),
      ['static', (closed && this.format === 'xhtml' ? ' /' : '') + '>']
    ];

  if (content) {
    res.push(this.compile(content));
  }
  if (!closed) {
    res.push(['static', "</" + name + ">"]);
  }
  return res;
}

FastProto.on_html_attrs = function(exps) {
  var res = ['multi'];

  for (var i = 2, l = exps.length; i < l; i++) {
    res.push(this.compile(exps[i]));
  }
  return res;
}

FastProto.on_html_attr = function(exps) {
  var name = exps[2], value = exps[3];

  if (this.format !== 'xhtml' && this.isEmptyExp(value)) {
    return ['static', ' ' + name];
  } else {
    return ['multi',
     ['static', ' ' + name + '=' + this.attrQuote],
     this.compile(value),
     ['static', this.attrQuote]]
  }
}

FastProto.on_html_js = function(exps) {
  var content = exps[2];

  if (this.jsWrapper) {
    return ['multi',
     ['static', this.jsWrapper[0]],
     this.compile(content),
     ['static', this.jsWrapper[1]]]
  } else {
    return this.compile(content);
  }
}

module.exports = Fast;

},{"./html":21}],21:[function(require,module,exports){
var Filter = require('../filter');

function Html() {}
var HtmlProto = Html.prototype = new Filter;

HtmlProto.on_html_attrs = function(exps) {
  var len = exps.length;
  for (var i = 2; i < len; i++) {
    exps[i] = this.compile(exps[i]);
  }
  return exps;
}

HtmlProto.on_html_attr = function(exps) {
  return ['html', 'attr', exps[2], this.compile(exps[3])];
}

HtmlProto.on_html_comment = function(exps) {
  return ['html', 'comment', this.compile(exps[2])];
}

HtmlProto.on_html_condcomment = function(exps) {
  return ['html', 'condcomment', exps[2], this.compile(exps[3])];
}

HtmlProto.on_html_js = function(exps) {
  return ['html', 'js', this.compile(exps[2])];
}

HtmlProto.on_html_tag = function(exps) {
  var content = exps[4];
  var res = ['html', 'tag', exps[2], this.compile(exps[3])];
  if (content) {
    res.push(this.compile(content));
  }
  return res;
}

HtmlProto.isContainNonEmptyStatic = function(exp) {
  switch (exp[0]) {
  case 'multi':
    for (var i = 1, l = exp.length; i < l; i++) {
      if (this.isContainNonEmptyStatic(exp[i])) {
        return true;
      }
    }
    return false;
  case 'escape':
    return this.isContainNonEmptyStatic(exp[exp.length - 1]);
  case 'static':
    return exp[1].length
  default:
    return false;
  }
}

module.exports = Html;

},{"../filter":5}],22:[function(require,module,exports){

function Parser() {
  this.file = null;
  this.lineno = 0;
  this.lines = [];
  this.indents = [0];
  this.line = null;
  this.origLine = null;

  this.tagShortcut = {
    '.': 'div',
    '#': 'div',
  };
  this.attrShortcut = {
    '#': ['id'],
    '.': ['class']
  };
  this.attrDelims = {
    '(' : ')',
    '[' : ']'
  };

  this.tagRe = /^(?:#|\.|\*(?=[^\s]+)|(\w+(?:\w+|:|-)*\w|\w+))/
  this.attrShortcutRe = /^([\.#]+)((?:\w+|-)*)/;

  this.attrName = "^\\s*(\\w+(?:\\w+|:|-)*)";
  this.quotedAttrRe = new RegExp(this.attrName + '\\s*=(=?)\\s*("|\')');
  this.codeAttrRe = new RegExp(this.attrName + '\\s*=(=?)\\s*');

  this.delimRe = /^[\(\)\[\]]/;
  this.attrDelimRe = /^\s*([\(\)\[\]])/;
  this.newLineRe = /\r?\n/;
  this.emptyLineRe = /^\s*$/;
  this.htmlCommentRe = /^\/!(\s?)/;
  this.htmlConditionalCommentRe = /^\/\[\s*(.*?)\s*\]\s*$/;
  this.blockExpressionRe = /^\s*:\s*/;
  this.doctypeRe = /^doctype\s+/i;
  this.textBlockRe = /^((\.)(\s|$))|((\|)(\s?))/;
  this.outputBlockRe = /^=(=?)([.<>]*)/;
  this.outputCodeRe  = /^\s*=(=?)([.<>]*)/;
  this.embededRe = /^(\w+):\s*$/;
  this.closedTagRe = /^\s*\/\s*/;
  this.textContentRe = /^( ?)(.*)$/;
  this.indentRegex  = /^[ \t]+/;
  this.indentationRe = /^\s+/;
  this.nextLineRe = /[,\\]$/;
  this.tabRe = /\t/g;
}

var ParserProto = Parser.prototype;

ParserProto.escapeRegExp = function(str) {
  if (!str) {
    return '';
  }
  return str.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, '\\$&');
}

ParserProto.reset = function(lines, stacks) {
  this.stacks = stacks || [];
  this.indents = [0];
  this.indents.last = this.stacks.last = function() {
    return this[this.length - 1];
  }
  this.lineno = 0;
  this.lines = lines;
  this.line = this.origLine = null;
}

ParserProto.pushOnTop = function(item) {
  this.stacks.last().push(item);
}

ParserProto.nextLine = function() {
  if (this.lines.length) {
    this.origLine = this.lines.shift();
    this.lineno += 1;
    return this.line = this.origLine;
  } else {
    return this.origLine = this.line = null;
  }
}

ParserProto.getIndent = function(line) {
  var m = line.match(this.indentRegex);
  return m ? m[0].replace(this.tabRe, ' ').length : 0
}

ParserProto.exec = function(str, options) {
  if (options && options['file']) {
    this.file = options['file'];
  } else {
    this.file = null;
  }
  var result = ['multi'];
  this.reset(str.split(this.newLineRe), [result]);

  while (this.nextLine() !== null) {
    this.parseLine()
  }

  this.reset();

  return result;
}

ParserProto.parseLine = function() {

  if (this.emptyLineRe.test(this.line)) {
    this.pushOnTop(['newline']);
    return;
  }

  var indent = this.getIndent(this.line);

  // Remove the indentation
  this.line = this.line.replace(this.indentationRe, '');

  // If there's more stacks than indents, it means that the previous
  // line is expecting this line to be indented.
  var expectingIndentation = this.stacks.length > this.indents.length;

  if (indent > this.indents.last()) {
    // This line was actually indented, so we'll have to check if it was
    // supposed to be indented or not.

    if (!expectingIndentation) {
      this.syntaxError('Unexpected indentation');
    }

    this.indents.push(indent);
  } else {
    // This line was *not* indented more than the line before,
    // so we'll just forget about the stack that the previous line pushed.
    if (expectingIndentation) {
      this.stacks.pop();
    }

    // This line was deindented.
    // Now we're have to go through the all the indents and figure out
    // how many levels we've deindented.
    while(indent < this.indents.last()) {
      this.indents.pop();
      this.stacks.pop();
    }

    // This line's indentation happens lie "between" two other line's
    // indentation:
    //
    //   hello
    //       world
    //     this      # <- This should not be possible!

    if (indent !== this.indents.last()) {
      this.syntaxError('Malformed indentation');
    }
  }

  this.parseLineIndicators();
}

ParserProto.parseLineIndicators = function() {
  do {
    var m;

    // HTML comment
    if (m = this.htmlCommentRe.exec(this.line)) {
      this.pushOnTop(['html', 'comment',
        [
          'slm',
          'text',
          this.parseTextBlock(this.line.slice(m[0].length),
          this.indents.last() + m[1].length + 2)
        ]
      ]);
      break;
    }

    // HTML conditional comment
    if (m = this.htmlConditionalCommentRe.exec(this.line)) {
      var block = ['multi'];
      this.pushOnTop(['html', 'condcomment', m[1], block]);
      this.stacks.push(block);
      break;
    }

    var firstChar = this.line[0];

    // Slm comment
    if (firstChar === '/') {
      this.parseCommentBlock();
      break;
    }

    // Text block.
    if (m = this.textBlockRe.exec(this.line)) {
      var char, space;
      if (m[2] === undefined) {
        char = m[5];
        space = m[6];
      } else {
        char = m[2];
        space = m[3];
      }
      var trailingWS = char === '.';

      this.pushOnTop([
        'slm',
        'text',
        this.parseTextBlock(this.line.slice(m[0].length),
        this.indents.last() + space.length + 1)
      ]);

      if (trailingWS) {
        this.pushOnTop(['static', ' ']);
      }

      break;
    }

    // Inline html
    if (firstChar === '<') {
      var block = ['multi'];
      this.pushOnTop(['multi', ['slm', 'interpolate', this.line], block]);
      this.stacks.push(block);
      break;
    }

    // Code block.
    if (firstChar === '-') {
      // We expect the line to be broken or the next line to be indented.
      this.line = this.line.slice(1);
      var block = ['multi'];
      this.pushOnTop(['slm', 'control', this.parseBrokenLine(), block]);
      this.stacks.push(block);
      break;
    }

    // Output block.
    if (m = this.outputBlockRe.exec(this.line)) {
      // We expect the line to be broken or the next line to be indented.
      this.line = this.line.slice(m[0].length);

      var trailingWS = m[2].indexOf('.') !== -1 || m[2].indexOf('>') !== -1;
      var block = ['multi'];
      if (m[2].indexOf('<') !== -1) {
        this.pushOnTop(['static', ' ']);
      }
      this.pushOnTop(['slm', 'output', m[1].length === 0, this.parseBrokenLine(), block]);
      if (trailingWS) {
        this.pushOnTop(['static', ' ']);
      }
      this.stacks.push(block);

      break;
    }

    // Embedded template.
    if (m = this.embededRe.exec(this.line)) {
      // It is treated as block.
      this.pushOnTop(['slm', 'embedded', m[1], this.parseTextBlock()]);
      break;
    }

    // Doctype declaration
    if (m = this.doctypeRe.exec(this.line)) {
      var value = this.line.slice(m[0].length).trim();
      this.pushOnTop(['html', 'doctype', value]);
      break;
    }

    // HTML tag
    if (m = this.tagRe.exec(this.line)) {
      if (m[1]) {
        this.line = this.line.slice(m[0].length);
      }
      this.parseTag(m[0]);

      break;
    }

    this.syntaxError('Unknown line indicator')


  } while (false);

  this.pushOnTop(['newline']);
}

ParserProto.parseTag = function(tag) {
  var m;
  if (this.tagShortcut[tag]) {
    if (!this.attrShortcut[tag]) {
      this.line = this.line.slice(0, tag.length);
    }

    tag = this.tagShortcut[tag];
  }


  // Find any shortcut attributes
  var attributes = ['html', 'attrs'];
  while (m = this.attrShortcutRe.exec(this.line)) {
    // The class/id attribute is :static instead of 'slm' 'interpolate',
    // because we don't want text interpolation in .class or #id shortcut
    var shortcut = this.attrShortcut[m[1]];
    if (!shortcut) {
      this.syntaxError('Illegal shortcut');
    }

    for (var i = 0, a; a = shortcut[i]; i++) {
      attributes.push(['html', 'attr', a, ['static', m[2]]]);
    }

    this.line = this.line.slice(m[0].length);
  }

  var trailingWS, leadingWS;

  if (m =/^[<>.]+/.exec(this.line)) {
    this.line = this.line.slice(m[0].length);
    trailingWS = m[0].indexOf('.') >= 0 || m[0].indexOf('>') >= 0;
    leadingWS = m[0].indexOf('<') >=0;
  }

  this.parseAttributes(attributes);

  tag = ['html', 'tag', tag, attributes];

  if (leadingWS) {
    this.pushOnTop(['static', ' ']);
  }
  this.pushOnTop(tag);
  if (trailingWS) {
    this.pushOnTop(['static', ' ']);
  }

  do {
    // Block expansion
    if (m = this.blockExpressionRe.exec(this.line)) {
      this.line = this.line.slice(m[0].length);
      if (!(m = this.tagRe.exec(this.line))) {
        this.syntaxError('Expected tag');
      }

      if (m[1]) {
        this.line = this.line.slice(m[0].length);
      }

      var content = ['multi'];
      tag.push(content);

      var i = this.stacks.length;
      this.stacks.push(content);
      this.parseTag(m[0]);
      this.stacks.splice(i, 1);

      break;
    }

    // Handle output code
    if (m = this.outputCodeRe.exec(this.line)) {

      this.line = this.line.slice(m[0].length);
      var trailingWS2 = m[2].indexOf('.') >= 0 || m[2].indexOf('>') >= 0;
      var leadingWS2 = m[2].indexOf('<') >= 0;

      var block = ['multi'];

      if (!leadingWS && leadingWS2) {
        var lastStack = this.stacks.last();
        lastStack.insert(lastStack.length - 2, 0, ['static', ' ']);
      }

      tag.push(['slm', 'output', m[1] !== '=', this.parseBrokenLine(), block]);
      if (!trailingWS && trailingWS2) {
        this.pushOnTop(['static', ' ']);
      }
      this.stacks.push(block);
      break;
    }

    // Closed tag. Do nothing
    if (m = this.closedTagRe.exec(this.line)) {
      this.line = this.line.slice(m[0].length);
      if (this.line.length) {
        this.syntaxError('Unexpected text after closed tag')
      }
      break;
    }

    // Empty content
    if (this.emptyLineRe.test(this.line)) {
      var content = ['multi'];
      tag.push(content);
      this.stacks.push(content);
      break;
    }

    // Text content
    if (m = this.textContentRe.exec(this.line)) {
      tag.push(['slm', 'text', this.parseTextBlock(m[2], this.origLine.length - this.line.length + m[1].length, true)]);
      break;
    }

  } while (false);
}

ParserProto.parseAttributes = function(attributes) {
  // Check to see if there is a delimiter right after the tag name
  var delimiter, m;

  if (m = this.attrDelimRe.exec(this.line)) {
    delimiter = this.attrDelims[m[1]];
    this.line = this.line.slice(m[0].length);
  }

  var booleanAttrRe, endRe;
  if (delimiter) {
    booleanAttrRe = new RegExp(this.attrName + '(?=(\\s|' + this.escapeRegExp(delimiter) + '|$))');
    endRe = new RegExp('^\\s*'+ this.escapeRegExp(delimiter));
  }

  while (true) {
    // Value is quoted (static)
    if (m = this.quotedAttrRe.exec(this.line)) {
      this.line = this.line.slice(m[0].length);
      attributes.push(['html', 'attr', m[1],
                      ['escape', m[2].length === 0, ['slm', 'interpolate', this.parseQuotedAttribute(m[3])]]]);
      continue;
    }

    // Value is JS code
    if (m = this.codeAttrRe.exec(this.line)) {
      this.line = this.line.slice(m[0].length);
      var name = m[1];
      var escape = m[2].length === 0;

      var value = this.parseJSCode(delimiter);
      if (!value.length) {
        this.syntaxError('Invalid empty attribute');
      }
      attributes.push(['html', 'attr', name, ['slm', 'attrvalue', escape, value]]);
      continue;
    }

    if (!delimiter) {
      break;
    }

    // Boolean attribute
    if (m = booleanAttrRe.exec(this.line)) {
      this.line = this.line.slice(m[0].length);
      attributes.push(['html', 'attr', m[1], ['multi']]);
      continue;
    }
    // Find ending delimiter
    if (m = endRe.exec(this.line)) {
      this.line = this.line.slice(m[0].length);
      break;
    }

    // Found something where an attribute should be
    this.line = this.line.replace(this.indentationRe, '');
    if (this.line.length) {
      this.syntaxError('Expected attribute');
    }

    // Attributes span multiple lines
    this.pushOnTop(['newline']);

    if (!this.lines.length) {
      this.syntaxError('Expected closing delimiter ' + delimiter);
    }
    this.nextLine();
  }
}

ParserProto.parseTextBlock = function(firstLine, textIndent, inTag) {
  var result = ['multi'];

  if (!firstLine || !firstLine.length) {
    textIndent = null;
  } else {
    result.push(['slm', 'interpolate', firstLine]);
  }

  var emptyLines = 0;

  while (this.lines.length) {
    if (this.emptyLineRe.test(this.lines[0])) {
      this.nextLine();
      result.push(['newline']);

      if (textIndent) {
        emptyLines++;
      }
    } else {
      var indent = this.getIndent(this.lines[0]);

      if (indent <= this.indents.last()) {
        break;
      }

      if (emptyLines) {
        result.push(['slm', 'interpolate', new Array(emptyLines + 1).join('\n')]);
        emptyLines = 0;
      }

      this.nextLine();
      this.line = this.line.replace(this.indentationRe, '');

      // The text block lines must be at least indented
      // as deep as the first line.

      var offset = textIndent ? indent - textIndent : 0;

      if (offset < 0) {
        this.syntaxError('Text line not indented deep enough.\n' +
                         'The first text line defines the necessary text indentation.' +
                         (inTag ? '\nAre you trying to nest a child tag in a tag containing text? Use | for the text block!' : ''))
      }

      result.push(['newline'])
      result.push(['slm', 'interpolate', (textIndent ? "\n" : '') + new Array(offset + 1).join(' ') + this.line]);

      // The indentation of first line of the text block
      // determines the text base indentation.
      textIndent = textIndent || indent;
    }
  }

  return result;
}

ParserProto.parseCommentBlock = function() {
  while (this.lines.length) {
    var indent = this.emptyLineRe.test(this.lines[0]) ? 0 : this.getIndent(this.lines[0]);

    if (indent <= this.indents.last()) {
      break;
    }

    this.nextLine();
    this.pushOnTop(['newline']);
  }
}

ParserProto.parseBrokenLine = function() {
  var brokenLine = this.line.trim(), m;
  while (m = this.nextLineRe.exec(brokenLine)) {
    this.expectNextLine();
    if (m[0] === '\\') {
      brokenLine = brokenLine.slice(0, brokenLine.length - 2);
    }
    brokenLine += '\n' + this.line;
  }
  return brokenLine;
}

ParserProto.parseJSCode = function(outerDelimeter) {
  var code = '', count = 0, delimiter, closeDelimiter, m;

  // Attribute ends with space or attribute delimiter
  var endRe = new RegExp('^[\\s' +this.escapeRegExp(outerDelimeter) + ']');

  while (this.line.length && (count || !endRe.test(this.line))) {
    if (this.nextLineRe.test(this.line)) {
      code += this.line + '\n';
      this.expectNextLine();
    } else {
      if (count > 0) {
        if (this.line[0] === delimiter[0]) {
          count++;
        } else if (this.line[0] === closeDelimiter[0]) {
          count--;
        }
      } else if (m = this.delimRe.exec(this.line)) {

        count = 1;
        delimiter = m[0];
        closeDelimiter = this.attrDelims[m[0]];
      }

      code = code + this.line[0];
      this.line = this.line.slice(1);
    }
  }

  if (count) {
    this.syntaxError('Expected closing delimiter ' + closeDelimiter);
  }
  return code;
}

ParserProto.parseQuotedAttribute = function(quote) {
  var value = '', count = 0;

  while (this.line.length && (count || this.line[0] !== quote)) {
    if (/^\\$/.test(this.line)) {
      value += ' ';
      this.expectNextLine();
    } else {
      var firstChar = this.line[0];
      if (count > 0) {
        if (firstChar === '{') {
          count++;
        } else if (firstChar === '}') {
          count--;
        }
      } else if (/^\$\{/.test(this.line)) {
        value += firstChar;
        this.line = this.line.slice(1)
        count = 1;
      }

      value += this.line[0];
      this.line = this.line.slice(1);
    }
  }

  if (count) {
    this.syntaxError('Expected closing brace }');
  }

  if (this.line[0] !== quote) {
    this.syntaxError('Expected closing quote ' + quote)
  }

  this.line = this.line.slice(1);

  return value;
}

ParserProto.syntaxError = function(message) {
  var column = (this.origLine != null && this.line != null) ? this.origLine.length - this.line.length : 0;
  column += 1;
  var msg = [
    message,
    '  ' + (this.file || '(__TEMPLATE__)') + ', Line ' + this.lineno + ", Column " + column,
    '  ' + this.origLine,
    '  ' + new Array(column).join(' ') + '^',
    ''
  ].join('\n');
  throw new Error(msg);
}

ParserProto.expectNextLine = function() {
  if (!this.nextLine()) {
    this.syntaxError('Unexpected end of file');
  }
  this.line = this.line.trim();
}

module.exports = Parser;

},{}],23:[function(require,module,exports){
var escapeRe = /[&<>"]/;
var ampRe = /&/g;
var ltRe = /</g;
var gtRe = />/g;
var quotRe = /"/g;

function safe(val) {
  if (!val || val.htmlSafe) {
    return val;
  }

  var res = new String(val);
  res.htmlSafe = true
  return res;
}

function escape(str) {
  if (typeof(str) !== 'string') {
    if (!str) {
      return '';
    }
    if (str.htmlSafe) {
      return str.toString();
    }
    str = str.toString();
  }

  if (escapeRe.test(str) ) {
    if( str.indexOf('&') != -1 ) str = str.replace(ampRe, '&amp;');
    if( str.indexOf('<') != -1 ) str = str.replace(ltRe, '&lt;');
    if( str.indexOf('>') != -1 ) str = str.replace(gtRe, '&gt;');
    if( str.indexOf('"') != -1 ) str = str.replace(quotRe, '&quot;');
  }

  return str;
}

function rejectEmpty(arr) {
  var res = [];

  for (var i = 0, l = arr.length; i < l; i++) {
    var el = arr[i];
    if (el != null && el.length) {
      res.push(el);
    }
  }

  return res;
}

function flatten(arr) {
  return arr.reduce(function (acc, val) {
    if (val == null) {
      return acc;
    } else {
      return acc.concat(val.constructor === Array ? flatten(val) : val.toString());
    }
  }, []);
}

module.exports = {
  safe: safe,
  escape: escape,
  rejectEmpty: rejectEmpty,
  flatten: flatten
}

},{}],24:[function(require,module,exports){
var Engine = require('./engine'),
  Parser = require('./parser'),
  Embeddeds = require('./filters/embedded'),
  Interpolation = require('./filters/interpolation'),
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
  StringGenerator = require('./generators/string_generator'),
  Runtime = require('./runtime'),

  Ctx = require('./ctx');

function Template() {
  this.engine = new Engine;
  this.embedded = new Embeddeds.Embedded;
  var jsEngine = new Embeddeds.JavascriptEngine;
  this.embedded.register('script', jsEngine);
  this.embedded.register('javascript', jsEngine);
  this.embedded.register('css', new Embeddeds.CSSEngine);

  this.engine.use(new Parser);
  this.engine.use(this.embedded);
  this.engine.use(new Interpolation);
  this.engine.use(new Brackets);
  this.engine.use(new Controls);
  this.engine.use(new AttrMerge);
  this.engine.use(new CodeAttributes);
  this.engine.use(new AttrRemove);
  this.engine.use(new FastHtml);
  this.engine.use(new Escape);
  this.engine.use(new ControlFlow);
  this.engine.use(new MultiFlattener);
  this.engine.use(new StaticMerger);
  this.engine.use(new StringGenerator);
}

Template.prototype.eval = function(src, model, options, ctx) {
  ctx = ctx || new Ctx();
  ctx.rt = Runtime;
  ctx.require = require;
  return this.exec(src, options).call(model, ctx);
};

Template.prototype.exec = function(src, options) {
  return Function('c', [
    'c.m = this;',
    'var sp = c.stack.length,',
    'rt = c.rt,',
    'content = c.content.bind(c),',
    'extend = c.extend.bind(c),',
    'partial = c.partial.bind(c),',
    'require = c.require;',
    this.engine.exec(src, options),
    'c.res=_b;return c.pop(sp);'
  ].join(''));
};

Template.prototype.compile = function(src, options) {
  var fn = this.exec(src, options);
  var basePath = options['basePath'];
  var filename = options['filename'];
  var ctx = new Ctx();
  ctx.template = this;
  ctx.basePath = basePath;
  ctx.filename = filename;
  ctx.require = require;
  ctx.rt = Runtime;

  var fnWrap = function(context, runtimeOptions) {
    var res = fn.call(context, ctx);
    ctx.reset();
    return res;
  }
  return fnWrap;
}

module.exports = Template;

},{"./ctx":1,"./engine":3,"./filters/attr_merge":6,"./filters/attr_remove":7,"./filters/brackets":8,"./filters/code_attributes":9,"./filters/control_flow":10,"./filters/controls":11,"./filters/embedded":12,"./filters/escape":13,"./filters/interpolation":14,"./filters/multi_flattener":15,"./filters/static_merger":17,"./generators/string_generator":19,"./html/fast":20,"./parser":22,"./runtime":23}],25:[function(require,module,exports){

},{}],26:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("1YiZ5S"))
},{"1YiZ5S":27}],27:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},[4])
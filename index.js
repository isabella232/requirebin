var config = require('./config');

var elementClass = require('element-class');
var jsEditor = require('javascript-editor');
var createSandbox = require('browser-module-sandbox');
var qs = require('querystring');
var url = require('url');
var detective = require('detective');
var md5 = require('md5-jkmyers');
var keydown = require('keydown');

var cookie = require('./cookie');
var uglify = require('uglify-js');

initialize();

function initialize() {
  var codeMD5, sandbox;
  var packagejson = {"name": "requirebin-sketch", "version": "1.0.0"};
  window.packagejson = packagejson;

  var loggedIn = false;
  if (cookie.get('oauth-token')) loggedIn = true;

  var parsedURL = url.parse(window.location.href, true);
  if (parsedURL.query.code) return authenticate();

  var currentHost = parsedURL.protocol + '//' + parsedURL.hostname;
  if (parsedURL.port) currentHost += ':' + parsedURL.port;

  var loadingClass = elementClass(document.querySelector('.spinner'));
  var runButton = elementClass(document.querySelector('.play-button'));
  var outputEl = document.querySelector('#play');
  var editorEl = document.querySelector('#edit');
  var cacheStateMessage = elementClass(document.querySelector('.cacheState'));

  $('[data-toggle="tooltip"]').tooltip();


  function loadCode(cb) {

    var stored = localStorage.getItem('code');
    if (stored) return cb(false, stored);

    var defaultCode = document.querySelector('#template').innerText;
    cb(false, defaultCode)
  }

  loadCode(function (err, code) {
    if (err) return alert(JSON.stringify(err));

    var editor = jsEditor({
      container: editorEl,
      lineWrapping: true
    });

    window.editor = editor;

    if (code) editor.setValue(code);

    var sandboxOpts = {
      cdn: config.BROWSERIFYCDN,
      container: outputEl,
      iframeStyle: "body, html { height: 100%; width: 100%; }"
    };

    if (parsedURL.query.save) {
      // use memdown here to avoid indexeddb transaction bugs :(
      sandboxOpts.cacheOpts = {inMemory: true}
    }
    sandbox = createSandbox(sandboxOpts);

    sandbox.on('modules', function (modules) {
      if (!modules) return;
      packagejson.dependencies = {};
      modules.forEach(function (mod) {
        if (mod.core) return;
        packagejson.dependencies[mod.name] = mod.version
      })
    });

    if (parsedURL.query.save) return;

    var controlsContainer = document.querySelector('#controls');
    var textBox = document.querySelector("#shareTextarea");


    var packageTags = $(".tagsinput");

    editor.on('valid', function (valid) {
      if (!valid) return;
      runButton.remove('hidden');
      packageTags.html('');
      var modules = detective(editor.editor.getValue());
      modules.map(function (module) {
        var tag =
          '<span class="tag"><a target="_blank" href="http://npmjs.org/' +
          module + '"><span>' + module + '&nbsp;&nbsp;</span></a></span>';
        packageTags.append(tag)
      });
      if (modules.length === 0) packageTags.append('<div class="tagsinput-add">No Modules Required Yet</div>')
    });





    $('.run-btn').click(function (e) {
      e.preventDefault();
      $('button[data-action="play"]').click();
      return false
    });

    $(".actionsButtons button").click(function () {
      var target = $(this);
      var action = target.attr('data-action');
      if (action in actions) actions[action]()
    });

    var actions = {
      play: function (pressed) {
        cacheStateMessage.add('hidden');

        var code = editor.editor.getValue();
        if (codeMD5 && codeMD5 === md5(code)) {
          loadingClass.add('hidden');
          sandbox.iframe.setHTML('<script type="text/javascript" src="embed-bundle.js"></script>')
        } else {
          sandbox.bundle(code, packagejson.dependencies)
        }

        editor.once('change', function (e) {
          cacheStateMessage.remove('hidden')
        })
      },

      edit: function () {

        if (!editorEl.className.match(/hidden/)) return;
        elementClass(editorEl).remove('hidden');
        elementClass(outputEl).add('hidden');
        var message = document.querySelector('.alert');
        if (message) message.classList.add('hidden');
        if (sandbox.iframe) sandbox.iframe.setHTML(" ")
      }

    };

    sandbox.on('bundleStart', function () {
      loadingClass.remove('hidden')
    });

    sandbox.on('bundleEnd', function (bundle) {
      loadingClass.add('hidden')
    });

    sandbox.on('bundleError', function (err) {
      loadingClass.add('hidden');
      tooltipMessage('danger', "Bundling error: \n\n" + err)
    });


    editor.on("change", function () {
      var code = editor.editor.getValue();
      localStorage.setItem('code', code)
    });


    keydown(['<meta>', '<enter>']).on('pressed', actions.play);
    keydown(['<control>', '<enter>']).on('pressed', actions.play);

    // loads the current code on load
    setTimeout(function () {
      actions.play()
    }, 500)

  })
}

/*
 display error/warning messages in the site header
 cssClass should be a default bootstrap class
 .warning .alert .info .success
 text is the message content
 */
function tooltipMessage(cssClass, text) {
  var message = document.querySelector('.alert');
  if (message) {
    message.classList.remove('hidden');
    message.classList.add('alert-' + cssClass);
    message.setAttribute("role", "alert");
    message.innerHTML = text
  } else {
    message = document.createElement('div');
    message.classList.add('alert');
    var close = document.createElement('span');
    close.classList.add('pull-right');
    close.innerHTML = '&times;';
    close.addEventListener('click', function () {
      this.parentNode.classList.add('hidden')
    }, false);
    message.classList.add('alert-' + cssClass);
    message.setAttribute("role", "alert");
    message.innerHTML = text;
    document.querySelector('body').appendChild(message);
    message.appendChild(close)
  }
}

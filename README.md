# xokit browser: Javascript web browser for AR, VR, and WebGL sites

[![Slack](https://exoslack.now.sh/badge.svg)](https://exoslack.now.sh)
[![Github releases](https://img.shields.io/github/downloads/xokit/xokit/total.svg)](https://github.com/xokit/xokit/releases )
[![npm package](https://img.shields.io/npm/v/xokit.svg)](https://www.npmjs.com/package/xokit)

```sh
xokit zeovr.io # run WebGL/VR/AR site
```

[xokit browser](https://exokitbrowser.com) is a brand new, fast, post-screen era web browser written in JavaScript. If a WebGL site runs in Chrome, it will probably run twice as fast using `xokit`.

xokit is a full HTML5 web browser, written as a node.js module. For VR, AR, and WebGL sites, xokit can do everything a browser can do.

It's plain OpenGL and standard libraries under the hood, so it plays nice with Windows, Linux, and macOS.

## About xokit Browser

xokit can't render HTML, but it _can_ draw Canvas and WebGL -- natively, and fast -- as well as take keyboard/mouse/mixed reality input with the regular APIs. It's a browser for the post-(2D) world.

Think JSDOM, except it _actually runs_ the DOM in a `window`. Or think Electron, except 300k and no compile step. Or, think an emulator for running web sites.

The multimedia parts (e.g. WebGL) are pluggable native modules. Everything else is Javascript. It's pretty easy to experiment and add new Web APIs.

xokit runs on Android/iOS, as well as Windows, Linux, and macOS.

## Examples

What xokit *can* do:

- Load any `https:` site
- Parse a programmatic DOM
- Run any `<script>`
- Load `<image>`, `<video>`, `<audio>`
- Web Workers
- Canvas 2D
- WebGL
- WebVR
- Gamepad input
- Iframe isolation
- Embed anywhere with `node`
- Run on Android/iOS
- Run tests
- Power a web bot

What xokit *cannot* do:

- Render a web page
- CSS
- Interactive HTML forms
- Legacy APIs

## FAQ

#### Why?

The web is important. The most important part of the web is that it's open. The web is not open if you need to be a genius to build a web browser.

Despite modern browsers being nominally open source, their code is impenetrable. You've probably never compiled a web browser, and almost certainly never added things. Despite the amount of time you spend in a browser.

With xokit, anyone can write some Javascript to control their experience of the web.

#### Platform support?

Works:

- Android

Planned:

- Windows
- macOS
- iOS
- Linux

The core is Javascript and is platform-agnostic. Porting work is restricted to the native graphics APIs.

#### Web API support?

- HTTP(S)
- HTML5
- ES7 (whatever Node.js you use)
- DOM
- CanvasRenderingContext2D
- Image tag
- Audio tag
- Video tag
- Keyboard/Mouse events
- WebGL
- WebVR
- Gamepad API
- **No** HTML layout
- **No** HTML rendering
- **No** CSS


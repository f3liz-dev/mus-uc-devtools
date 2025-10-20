# Screenshot

## Usage

### Full-Screen

```bash
mus-uc-devtools screenshot -o screenshot.png
```

### Element-Specific

```bash
mus-uc-devtools screenshot -s "#nav-bar" -o navbar.png
mus-uc-devtools screenshot -s "toolbar" -o toolbar.png
```

## Implementation

Uses Firefox chrome context to access `drawWindow` API:

```javascript
let canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
let window = Services.wm.getMostRecentWindow("navigator:browser");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let ctx = canvas.getContext("2d");
ctx.drawWindow(window, 0, 0, width, height, "rgb(255,255,255)");

let dataURL = canvas.toDataURL("image/png");
```

## Use Cases

- Visual regression testing
- CI/CD pipelines
- Documentation
- Design verification

import { Logger } from "./logger";
import strings from "./string";

class DebugUI {
  constructor(app, state) {
    this.app = app;
    this.state = state;
    this.$$ = app.$;

    this.popoverSelector = "#context-popover";

    this.mouseTarget = this.$$('<div class="debug-mouse-target"></div>');

    this.listeners = {
      contextMenu: null,
      outsideClick: null,
    };

    this.initMouseTarget();
    this.initEnvOptions();

    this.bindContextMenu();
    this.bindCloseOnOutsideClick();
    this.bindPopoverActions();
    this.logger = Logger.channel("debug", console.debug);
    this.loggerchannels = {
      contextMenu: this.logger.addChannel("context-menu"),
      debugInfo: this.logger.addChannel("debug-info"),
      debugInfoAdvanced: this.logger.addChannel("debug-info-advanced"),
    };
  }

  log(s, level, subchannel, styles) {
    this.logger.write(s, level, subchannel, undefined, styles);
  }

  initEnvOptions() {
    const debugOpt = this.$$(
      `<li><a href="/debug/" class="list-button">${strings.pages.home.debug}</a></li>`,
    );
    const refreshOpt = this.$$(
      `<li><a href="/refresh/" class="list-button">${strings.pages.home.refresh}</a></li>`,
    );
    const erudaOpt = this.$$(
      `<li><a href="/eruda/" class="list-button">Load Eruda</a></li>`,
    );
    const popoverList = this.$$(this.popoverSelector).find("ul");
    if (import.meta.env.VITE_DEBUG_UI === "true") popoverList.append(debugOpt);
    popoverList.append(refreshOpt);
    if (import.meta.env.VITE_ERUDA === "true") popoverList.append(erudaOpt);
  }

  initMouseTarget() {
    this.mouseTarget.css({
      position: "absolute",
      width: "1px",
      height: "1px",
      top: "0",
      left: "0",
    });

    this.$$("body").append(this.mouseTarget);
  }

  bindContextMenu() {
    this.listeners.contextMenu = (e) => {
      e.preventDefault();

      this.mouseTarget.css({
        top: `${e.pageY}px`,
        left: `${e.pageX}px`,
      });

      this.app.popover.open(this.popoverSelector, this.mouseTarget[0]);
      this.log(
        `Menu Show: %cx:${e.pageX}%c, %cy:${e.pageY}`,
        1,
        this.loggerchannels.contextMenu,
        ["color: red;", "color: initial;", "color: limegreen;"],
      );
    };

    document.addEventListener("contextmenu", this.listeners.contextMenu);
  }

  bindCloseOnOutsideClick() {
    this.listeners.outsideClick = (e) => {
      if (!this.$$(e.target).closest(this.popoverSelector).length) {
        if (this.$$(this.popoverSelector)[0].classList.contains("modal-in")) {
          this.app.popover.close(this.popoverSelector);
          this.log("Menu Hide", 1, this.loggerchannels.contextMenu);
        }
      }
    };

    document.addEventListener("mousedown", this.listeners.outsideClick);
  }

  bindPopoverActions() {
    this.$$(`${this.popoverSelector} ul li`).on("click", (e) => {
      const element = this.$$(e.target).closest("a");
      const href = element.attr("href");
      this.log(`Menu Select: %c${href}`, 1, this.loggerchannels.contextMenu, [
        "color: blue;",
      ]);

      if (href === "/debug/") {
        this.openDebugDialog();
      } else if (href === "/refresh/") {
        location.reload();
      } else if (href === "/eruda/") {
        this.toggleEruda(element);
      }

      this.app.popover.close(this.popoverSelector);
    });
  }

  toggleEruda(element) {
    if (!window.eruda) {
      const script = document.createElement("script");

      script.src = "https://cdn.jsdelivr.net/npm/eruda";

      document.body.appendChild(script);

      script.onerror = () => {
        script.remove();
        this.log("Eruda Load Failed", 6);
        this.app.dialog.alert(
          `${strings.other.eruda_error}<br/>${strings.common.package}: ${script.src}`,
          strings.common.error,
        );
      };

      script.onload = () => {
        script.remove();
        this.log("Eruda Loaded", 2);
        element.text("Init Eruda");
        this.logger.addChannel("Eruda");
      };
      return;
    }

    const logchannel = this.logger.subchannels.get("Eruda");

    if (window.eruda._isInit) {
      window.eruda.destroy();
      this.log("Uninited", 1, logchannel);
      element.text("Init Eruda");
    } else {
      window.eruda.init();
      this.log("Inited", 1, logchannel);
      element.text("Uninit Eruda");
    }
  }

  getDebugInfo() {
    const s = this.state;

    return (
      `${strings.common.location}: ${s.lat}, ${s.lon}\n` +
      `Azimuth: ${s.azimuth}\n` +
      `Heading: ${s.heading}\n` +
      `${strings.pages.home.distance}: ${s.distance} m\n` +
      `${strings.other.device_flat_info}: ${s.isFlat}\n`
    );
  }

  openDebugDialog() {
    const debugInfo = this.getDebugInfo();

    this.app.dialog
      .create({
        title: strings.other.debug_info,

        text: `<pre class="selectable">${debugInfo}</pre>`,

        buttons: [
          {
            text: strings.common.advanced,
            onClick: () => {
              this.openAdvancedPopup(debugInfo);
            },
          },
          {
            text: strings.common.copy,
            onClick: () => {
              this.copyDebugInfo(debugInfo);
            },
          },
          {
            text: strings.common.close,
          },
        ],
      })
      .open();
  }

  async copyDebugInfo(text) {
    try {
      await navigator.clipboard.writeText(text);

      this.app.toast
        .create({
          text: strings.other.copied,
          closeTimeout: 2000,
        })
        .open();
      this.log("Copied", 2, this.loggerchannels.debugInfo);
    } catch (e) {
      this.app.toast
        .create({
          text: strings.other.copy_failed,
          closeTimeout: 2000,
        })
        .open();
      this.log("Copying Failed", 6, this.loggerchannels.debugInfo);
    }
  }

  openAdvancedPopup(debugInfo) {
    const deviceInfo = Object.keys(this.app.device)
      .filter((key) =>
        ["string", "number", "boolean", "float"].includes(
          typeof this.app.device[key],
        ),
      )
      .map((key) => `${key}: ${this.app.device[key]}`)
      .join("\n");

    this.log("Opened", 2, this.loggerchannels.debugInfoAdvanced);

    this.app.popup
      .create({
        closeByBackdropClick: true,

        content: `
          <div class="popup">
            <div class="view">
              <div class="page">

                <div class="navbar">
                  <div class="navbar-bg"></div>
                  <div class="navbar-inner">
                    <div class="title">
                      ${strings.other.debug_info}
                    </div>
                  </div>
                </div>

                <div class="page-content">

                  <div class="block-title">
                    ${strings.other.compass_direction_info}
                  </div>

                  <div class="block">
                    <pre class="selectable">${debugInfo}</pre>
                  </div>

                  <div class="block-title">
                    ${strings.other.device_info}
                  </div>

                  <div class="block">
                    <pre class="selectable">${deviceInfo}</pre>
                  </div>

                  <div class="block-title">
                    ${strings.other.webview_info}
                  </div>

                  <div class="block">
                    <pre class="selectable">${navigator.userAgent}
${navigator.platform}</pre>
                  </div>

                  <a
                    href="#"
                    class="button button-fill button-tonal popup-close"
                  >
                    ${strings.common.close}
                  </a>

                </div>
              </div>
            </div>
          </div>
        `,
      })
      .open();
  }

  destroy() {
    if (this.listeners.contextMenu) {
      document.removeEventListener("contextmenu", this.listeners.contextMenu);

      this.listeners.contextMenu = null;
    }

    if (this.listeners.outsideClick) {
      document.removeEventListener("mousedown", this.listeners.outsideClick);

      this.listeners.outsideClick = null;
    }

    this.$$(`${this.popoverSelector} ul li`).off("click");

    this.mouseTarget.remove();
    this.log("Destroy!", 5);
  }
}

export { DebugUI };

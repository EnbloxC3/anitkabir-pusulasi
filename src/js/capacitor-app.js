import { Logger } from "./logger";
import strings from "./string";
const console = Logger.setProxy(Logger.channel("capacitor-app")); // local bind
var capacitorApp = {
  f7: null,
  exitToast: null,
  /*
    This method hides splashscreen after 2 seconds
    */
  handleSplashscreen: function () {
    var f7 = capacitorApp.f7;
    console.log("handleAppExit");
    if (!window.Capacitor) return;
    setTimeout(() => {
      if (window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen) {
        window.Capacitor.Plugins.SplashScreen.hide();
      }
    }, 2000);
  },
  /*
    This method prevents back button tap to exit from app on android.
    In case there is an opened modal it will close that modal instead.
    In case there is a current view with navigation history, it will go back instead.
    */
  handleAppExit: function () {
    var f7 = capacitorApp.f7;
    console.log("handleAppExit");
    if (!capacitorApp.exitToast) {
      capacitorApp.exitToast = f7.toast.create({
        text: strings.native.retry_for_exit,
        position: "bottom",
        closeTimeout: 1500,
        on: {
          closed: () => {
            capacitorApp.exitToast = null;
          },
        },
      });
      capacitorApp.exitToast.open();
    } else {
      capacitorApp.exitApplication();
    }
  },
  exitApplication: function () {
    console.log("exitApplication");
    if (window.Capacitor?.Plugins?.App?.exitApp) {
      window.Capacitor.Plugins.App.exitApp();
    } else if (navigator.app?.exitApp) {
      navigator.app.exitApp();
    } else {
      window.close();
    }
  },
  handleStatusBar: function () {
    console.log("handleStatusBar");
    /*const { StatusBar } = window.Capacitor.Plugins;*/ // Updated
    const { SystemBars } = window.Capacitor.Plugins;
    const page = document.querySelector(".view-main .page-main");
    //if (!StatusBar) return;
    if (!SystemBars) return;
    if (!page) return;
    /* Custom behavior */
    globalThis.__statusBarState ??= {};
    const state = globalThis.__statusBarState;
    const docRoot = document.documentElement;
    const createObservableSet = (onChange) => {
      const set = new Set();
      const originalAdd = set.add.bind(set);
      const originalDelete = set.delete.bind(set);
      const originalClear = set.clear.bind(set);
      set.add = (value) => {
        const had = set.has(value);
        const result = originalAdd(value);
        if (!had) onChange();
        return result;
      };
      set.delete = (value) => {
        const deleted = originalDelete(value);
        if (deleted) onChange();
        return deleted;
      };
      set.clear = () => {
        if (set.size === 0) return;
        originalClear();
        onChange();
      };
      return set;
    };

    const updateVisibility = async () => {
      const forcedVisible = state.forcedVisibleReasons.size > 0;
      const shouldHide =
        state.hiddenForReasons.has("splitView") ||
        (!forcedVisible && state.hiddenForReasons.size > 0); // splitView exception
      if (shouldHide) {
        //await StatusBar.hide();
        await SystemBars.hide();
      } else {
        //await StatusBar.show();
        await SystemBars.show();
      }
      console.debug(
        "handleStatusBar: updateVisibility: shouldHide:",
        shouldHide,
      );
    };

    const updateModal = () => {
      const hasOverlay = [...docRoot.classList].some((className) =>
        className.startsWith("with-modal-"),
      );
      if (hasOverlay) {
        state.forcedVisibleReasons.add("f7-overlay");
      } else {
        state.forcedVisibleReasons.delete("f7-overlay");
      }
      if (
        state.hiddenForReasons.size === 1 &&
        state.hiddenForReasons.has("camera")
      ) {
        const currentPage = page?.classList.contains("page-current");
        if (!currentPage) {
          state.forcedVisibleReasons.add("f7-page");
        } else {
          state.forcedVisibleReasons.delete("f7-page");
        }
      }
    };

    state.hiddenForReasons = createObservableSet(updateVisibility);
    state.forcedVisibleReasons = createObservableSet(updateVisibility);
    const modalObserver = new MutationObserver(updateModal);
    const pageObserver = new MutationObserver(updateModal);
    updateModal();
    modalObserver.observe(docRoot, {
      attributes: true,
      attributeFilter: ["class"],
    });
    pageObserver.observe(page, {
      attributes: true,
      attributeFilter: ["class"],
    });
    /* */
    const f7 = capacitorApp.f7;
    /*const bg = page.getComputedStyle();*/
    //StatusBar.setOverlaysWebView({ overlay: true });
    //StatusBar.setBackgroundColor({ color: "#000000" }); // These are no longer supported
    SystemBars.setStyle({ style: "DARK" });
    SystemBars.show();
  },

  handleAndroidBackButton: function () {
    var f7 = capacitorApp.f7;
    console.log("handleAndroidBackButton");
    const $ = f7.$;
    if (!window.Capacitor || !window.Capacitor.Plugins.App) return;
    window.Capacitor.Plugins.App.addListener(
      "backButton",
      function () {
        if ($(".actions-modal.modal-in").length) {
          f7.actions.close(".actions-modal.modal-in");
          return;
        }
        if ($(".dialog.modal-in").length) {
          f7.dialog.close(".dialog.modal-in");
          return;
        }
        if ($(".sheet-modal.modal-in").length) {
          f7.sheet.close(".sheet-modal.modal-in");
          return;
        }
        if ($(".popover.modal-in").length) {
          f7.popover.close(".popover.modal-in");
          return;
        }
        if ($(".popup.modal-in").length) {
          if ($(".popup.modal-in>.view").length) {
            const currentView = f7.views.get(".popup.modal-in>.view");
            if (
              currentView &&
              currentView.router &&
              currentView.router.history.length > 1
            ) {
              currentView.router.back();
              return;
            }
          }
          f7.popup.close(".popup.modal-in");
          return;
        }
        if ($(".login-screen.modal-in").length) {
          f7.loginScreen.close(".login-screen.modal-in");
          return;
        }

        if ($(".page-current .searchbar-enabled").length) {
          f7.searchbar.disable(".page-current .searchbar-enabled");
          return;
        }

        if ($(".page-current .card-expandable.card-opened").length) {
          f7.card.close(".page-current .card-expandable.card-opened");
          return;
        }

        const currentView = f7.views.current;
        if (
          currentView &&
          currentView.router &&
          currentView.router.history.length > 1
        ) {
          currentView.router.back();
          return;
        }

        if ($(".panel.panel-in").length) {
          f7.panel.close(".panel.panel-in");
          return;
        }
        if ($(".page-current").attr("data-name") !== "home") {
          f7.views.main.router.back();
          return;
        }
        capacitorApp.handleAppExit();
        return;
      },
      false,
    );
  },
  handleKeyboard: function () {
    var f7 = capacitorApp.f7;
    console.log("handleKeyboard");
    if (!window.Capacitor || !window.Capacitor.Plugins.Keyboard) return;
    var $ = f7.$;
    var Keyboard = window.Capacitor.Plugins.Keyboard;
    if (!Keyboard) return;
    Keyboard.setResizeMode({ mode: "native" });
    Keyboard.setScroll({ isDisabled: true });
    Keyboard.setAccessoryBarVisible({ isVisible: false });
    window.addEventListener("keyboardWillShow", () => {
      f7.input.scrollIntoView(document.activeElement, 0, true, true);
    });
    window.addEventListener("keyboardDidShow", () => {
      f7.input.scrollIntoView(document.activeElement, 0, true, true);
    });
    window.addEventListener("keyboardDidHide", () => {
      if (
        document.activeElement &&
        $(document.activeElement).parents(".messagebar").length
      ) {
        return;
      }
      Keyboard.setAccessoryBarVisible({ isVisible: true });
    });

    $(document).on(
      "touchstart",
      "input, textarea, select",
      function (e) {
        var nodeName = e.target.nodeName.toLowerCase();
        var type = e.target.type;
        var showForTypes = ["datetime-local", "time", "date", "datetime"];
        if (nodeName === "select" || showForTypes.indexOf(type) >= 0) {
          Keyboard.setAccessoryBarVisible({ isVisible: true });
        } else {
          Keyboard.setAccessoryBarVisible({ isVisible: false });
        }
      },
      true,
    );
  },
  init: function (f7) {
    console.log("Functions Initializing");
    // Save f7 instance
    capacitorApp.f7 = f7;

    // Handle Status Bar
    capacitorApp.handleStatusBar();

    // Handle Android back button
    capacitorApp.handleAndroidBackButton();

    // Handle Splash Screen
    capacitorApp.handleSplashscreen();

    // Handle Keyboard
    capacitorApp.handleKeyboard();

    console.log(window.Capacitor);
  },
};

export default capacitorApp;

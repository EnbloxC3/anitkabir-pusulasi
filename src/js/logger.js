// Logger v0.1
// Planning name changing
// ! CAUTION: Channel instances created before the Console Proxy is installed
// ! cannot be intercepted by these proxies. Therefore, Eruda and other external
// ! DevTools cannot capture messages sent through those channels.
/**

@file logger.js
@description

Logger is a very basic colorful channel based web logging system bulit-in with this project
It may be separated into its own project in the future

@example
import { Logger } from "./logger.js";


const debuglog = Logger.channel("debug", console.debug);
const subchannel = debuglog.addChannel("subchannel", "#795548");


debuglog.info("Logger initialized");
debuglog.error("Something went wrong", subchannel);


@module Logger
*/

/**
 * Represents a logging channel with its own output method,
 * formatting options, and subchannels.
 */
class LoggerChannel {
  /**
   * Creates a new logging channel.
   * @param {string} name - Name of channel.
   * @param {(...args: any[]) => void} method - Main (or default) logging method of channel.
   * @param {{colors?: Record<string, string>, styles?: string[]}} options - Options of channel.
   */
  constructor(name, method = console.log, options = {}) {
    this.name = name;
    this.method = method;

    this.colors = {
      ...Logger.colors,
      ...options.colors,
    };
    this.styles = options.styles ?? [];
    /**
     * Subchannels of channel.
     */
    this.subchannels = new Map();
  }

  /**
   * Creates and registers a subchannel.
   *
   * @param {string} name - The name of the subchannel.
   * @param {string} color - The color used to display the subchannel.
   * @returns {LoggerSubChannel} The created subchannel.
   */
  addChannel(name, color) {
    const channel = new LoggerSubChannel(name, color);
    this.subchannels.set(name, channel);
    return channel;
  }

  /**
   * Writes a log message using the configured channel.
   *
   * @param {string} s - The log message.
   * @param {number} [level=0] - The log level.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string} [subchannelColor] - The subchannel color.
   * @param {string[]} [styles=this.styles] - Additional console styles.
   * @param {(...args: any[]) => void} [m=this.method] - The output function.
   */
  write(
    s,
    level = 0,
    subchannel,
    subchannelColor,
    styles = this.styles,
    m = this.method,
  ) {
    const type =
      [
        "initial",
        "debug",
        "info",
        "success",
        "warn",
        "important",
        "error",
        "user",
        "custom",
      ][level] ?? "custom";
    if (
      subchannel &&
      (!(subchannel instanceof LoggerSubChannel) ||
        this.subchannels.get(subchannel.name) !== subchannel)
    ) {
      this.warn(
        `'${
          subchannel.name ?? subchannel.toString()
        }' subchannel is not a LoggerSubChannel or not registered in this channel (${
          this.name
        })`,
        this.addChannel("warning"),
      );
      subchannelColor = this.colors.error;
    }
    this._write(s, type, subchannel, subchannelColor, styles, m);
  }

  /**
   * Outputs a formatted log message using the configured output method.
   */
  _write(s, type, subchannel, subchannelColor, styles, m) {
    m(
      `%c[${this.name}%c${
        !subchannel ? "@default" : `@${subchannel.name ?? subchannel}`
      }%c]%c: ${s}`,
      `color: ${this.colors[type]};`,
      !subchannel
        ? `color: ${this.colors.debug}; font-style: italic;`
        : `color: ${subchannelColor ?? subchannel.color ?? this.colors[type]};`,
      `color: ${this.colors[type]};`,
      `color: ${this.colors.initial};`,
      ...styles,
    );
  }

  /**
   * Writes an initial log message using the configured channel.
   * @level 0
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  initial(s, subchannel, styles) {
    this.write(s, 0, subchannel, subchannel?.color, styles);
  }

  /**
   * Writes a debug log message using the configured channel.
   * @level 1
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  debug(s, subchannel, styles) {
    this.write(s, 1, subchannel, subchannel?.color, styles);
  }

  /**
   * Writes an info log message using the configured channel.
   * @level 2
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  info(s, subchannel, styles) {
    this.write(s, 2, subchannel, subchannel?.color, styles);
  }

  /**
   * Writes a success log message using the configured channel.
   * @level 3
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  success(s, subchannel, styles) {
    this.write(s, 3, subchannel, subchannel?.color, styles);
  }

  /**
   * Writes a warning log message using the configured channel.
   * @level 4
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  warn(s, subchannel, styles) {
    this.write(s, 4, subchannel, subchannel?.color, styles);
  }

  /**
   * Writes an important log message using the configured channel.
   * @level 5
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  important(s, subchannel, styles) {
    this.write(s, 5, subchannel, subchannel?.color, styles);
  }

  /**
   * Writes an error log message using the configured channel.
   * @level 6
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  error(s, subchannel, styles) {
    this.write(s, 6, subchannel, subchannel?.color, styles);
  }

  /**
   * Writes a user log message using the configured channel.
   * @level 7
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  user(s, subchannel, styles) {
    this.write(s, 7, subchannel, subchannel?.color, styles);
  }

  /**
   * Writes a custom log message for development using the configured channel.
   * @level 8
   * @param {string} s - The log message.
   * @param {LoggerSubChannel} [subchannel] - The subchannel.
   * @param {string[]} [styles] - Additional console styles.
   */
  custom(s, subchannel, styles) {
    this.write(s, 8, subchannel, subchannel?.color, styles);
  }
}

/**
 * Represents a logging subchannel with its own name and color.
 */
class LoggerSubChannel {
  /**
   * Creates a new logging subchannel.
   *
   * @param {string} name - The name of the subchannel.
   * @param {string} color - The color used to display the subchannel.
   */
  constructor(name, color) {
    this.name = name;
    this.color = color;
  }
}

/**
 * Provides the main entry point for Logger.
 *
 * Manages logging channels and provides default configuration
 * for colors and channel creation.
 */
class Logger {
  static colors = {
    initial: "initial",
    debug: "#888",
    info: "#2196f3",
    success: "#4caf50",
    warn: "#ff9800",
    important: "#ff5722",
    error: "#f44336",
    user: "#9c27b0",
    custom: "#795548",
    black: "black",
  };

  /**
   * All channels registered on Logger
   */
  static channels = new Map();

  /**
   * Creates a new logging channel.
   * @param {string} name - Name of channel.
   * @param {(...args: any[]) => void} method - Main (or default) logging method of channel.
   * @param {{
   *   colors?: Record<string, string>,
   *   styles?: string[]
   * }} options - Options of channel.
   */
  static channel(name, method = console.log, options = {}) {
    const channel = new LoggerChannel(name, method, options);

    this.channels.set(name, channel);

    return channel;
  }

  /**
   * @typedef {Console & LoggerConsoleProxy} LoggerConsoleObject
   */
  /**
   * Creates a console proxy that redirects logging methods to the specified logging channel.
   *
   * @param {LoggerChannel} proxyChannel - The logging channel used to handle console messages.
   * @param {Console} [customProxy=console] - The console-like object to extend and proxy.
   * @returns {LoggerConsoleObject} A console-like proxy connected to the specified logging channel.
   */
  static setProxy(proxyChannel, customProxy = console) {
    const c = proxyChannel;

    return {
      ...customProxy,
      ...new LoggerConsoleProxy(c),
    };
  }
}

/**
 * Represents a console-like object used by the Logger proxy.
 */
class LoggerConsoleProxy {
  /**
   * Define a LoggerConsoleProxy object
   * @param {LoggerChannel} channel - Proxy channel
   */
  constructor(channel) {
    /** @type {LoggerChannel} */
    this.channel = channel;
    this.log = (...args) => this.channel.info(args.join(" "));
    this.debug = (...args) => this.channel.debug(args.join(" "));
    this.warn = (...args) => this.channel.warn(args.join(" "));
    this.error = (...args) => this.channel.error(args.join(" "));
  }
}

Logger.channel("logger", console.debug).debug("initialized");

export { Logger, LoggerChannel, LoggerSubChannel };

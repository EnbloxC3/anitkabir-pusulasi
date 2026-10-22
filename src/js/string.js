import Meta from "$/string-meta.config";
import packageMetadata from "$/package.json";
import { Logger } from "./logger";
const loggerChannel = Logger.channel("string", console.debug);
const localeLogChannel = loggerChannel.addChannel("locales", "#03a9f4");
const languageLogChannel = loggerChannel.addChannel("language", "#4caf50");
const translationLogChannel = loggerChannel.addChannel("strings", "#9c27b0");

const localeModules = import.meta.glob("@/strings/*.json", {
  eager: true,
  import: "default",
});

const Config = localeModules["/strings/" + Meta.configName];

const locales = Object.fromEntries(
  Object.entries(localeModules)
    .map(([filePath, locale]) => [
      filePath
        .split("/")
        .pop()
        .replace(/\.json$/, ""),
      locale,
    ])
    .filter(([language]) => /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(language)),
);

const localeFiles = Object.keys(localeModules).filter((filePath) =>
  /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(
    filePath
      .split("/")
      .pop()
      .replace(/\.json$/, ""),
  ),
);
loggerChannel.debug(
  `Locale files loaded: %c${localeFiles.join(", ")}`,
  localeLogChannel,
  ["color: green;"],
);

function normalizeLanguage(language) {
  return language?.replace(/_/g, "-").toLowerCase();
}

function selectLanguage() {
  const availableLanguages = Object.keys(locales);
  const preferredLanguages =
    typeof navigator === "undefined"
      ? []
      : [...(navigator.languages ?? []), navigator.language].filter(Boolean);

  for (const preferredLanguage of preferredLanguages) {
    const normalizedLanguage = normalizeLanguage(preferredLanguage);
    const exactMatch = availableLanguages.find(
      (language) => normalizeLanguage(language) === normalizedLanguage,
    );
    if (exactMatch) return exactMatch;

    const baseLanguage = normalizedLanguage?.split("-")[0];
    const baseMatch = availableLanguages.find(
      (language) => normalizeLanguage(language) === baseLanguage,
    );
    if (baseMatch) return baseMatch;
  }

  const defaultLanguage = Config.defaultLang;
  if (locales[defaultLanguage]) return defaultLanguage;

  const firstAvailableLanguage = availableLanguages[0];
  if (firstAvailableLanguage) return firstAvailableLanguage;

  throw new Error("No language JSON files were found in src/strings.");
}

const language = selectLanguage();
const translations = locales[language];
loggerChannel.debug(`Selected language: %c${language}`, languageLogChannel, [
  "color: lightblue;",
]);

function getBuildTypeKey() {
  const runtimeBuildType =
    globalThis["__BUILD_TYPE__"] ??
    import.meta.env.VITE_BUILD_TYPE ??
    import.meta.env.MODE;
  const normalizedBuildType = String(runtimeBuildType ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (
    ["unstable", "alpha", "beta", "stable", "development"].includes(
      normalizedBuildType,
    )
  ) {
    return normalizedBuildType;
  }
  if (["production", "release"].includes(normalizedBuildType)) return "stable";
  return "unstable";
}

function getDirection(language) {
  const locale = new Intl.Locale(language);
  const script = locale.maximize().script;
  if (["Arab", "Hebr", "Thaa", "Nkoo", "Adlm"].includes(script)) {
    return "rtl";
  }
  return "ltr";
}

const internal = {
  ...(translations[Meta.internalsKey] ?? {}),
  lang: language,
  defaultLang: Config.defaultLang,
  dir: getDirection(language),
};

if (Config.appSpecificInternals) {
  const buildTypeKey = getBuildTypeKey();
  internal.version = packageMetadata.version;
  internal.githubRepository = packageMetadata.repository;
  internal.buildType = translations.common?.[buildTypeKey] ?? buildTypeKey;
}

const _all = {
  ...translations,
  [Meta.internalsKey]: internal,
};

const variables = {
  ...(translations["variables"] ?? {}),
};
const variableOptions = new Map();
_all.variables = variables;

function getPath(value, path) {
  return path.split(".").reduce((current, segment) => {
    if (
      current === null ||
      (typeof current !== "object" && typeof current !== "function") ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return undefined;
    }
    return current[segment];
  }, value);
}

function resolveScope(scope) {
  if (scope && typeof scope === "object") return scope;
  if (typeof scope !== "string" || !scope) return undefined;
  return getPath(_all, scope) ?? getPath(_all.pages, scope);
}

function normalizeInvalidKey(reference) {
  const actions = Config.invalidKeyAct ?? {};
  const interfaceCharacter = actions.spaceInterface ?? "_";
  const leaf = reference.split(".").pop();
  const normalizedLeaf =
    interfaceCharacter && Meta.wordSplit
      ? leaf.split(interfaceCharacter).join(Meta.wordSplit)
      : leaf;
  const words = Meta.wordSplit
    ? normalizedLeaf.split(Meta.wordSplit)
    : [normalizedLeaf];
  const firstWord = words[0];

  if (firstWord) {
    if (actions.firstWord === "lowerCase") {
      words[0] = firstWord.toLocaleLowerCase();
    } else if (actions.firstWord === "upperCase") {
      words[0] = firstWord.toLocaleUpperCase();
    } else if (actions.firstWord === "titleCase") {
      words[0] =
        firstWord.charAt(0).toLocaleUpperCase() +
        firstWord.slice(1).toLocaleLowerCase();
    }
  }

  return words.join(Meta.wordSplit ?? "");
}

function resolveFromSource(source, path) {
  const segments = path.split(".");
  let current = source;
  let matchedPath = [];
  let suffix = "";

  for (let index = 0; index < segments.length; index += 1) {
    if (!current || typeof current !== "object") return undefined;

    const requestedSegment = segments[index];
    const matchingKeys = Object.keys(current).filter((key) =>
      requestedSegment.startsWith(key),
    );
    matchingKeys.sort((left, right) => {
      const difference = left.length - right.length;
      return Config.keySearch === "desc" ? -difference : difference;
    });

    let matchedKey;
    for (const key of matchingKeys) {
      const candidate = current[key];
      const remaining = requestedSegment.slice(key.length);
      const isLastSegment = index === segments.length - 1;
      if (remaining && (!isLastSegment || typeof candidate !== "string")) {
        continue;
      }
      matchedKey = key;
      current = candidate;
      if (isLastSegment) suffix = remaining;
      break;
    }

    if (matchedKey === undefined) return undefined;
    matchedPath.push(matchedKey);
  }

  return {
    value: typeof current === "string" ? `${current}${suffix}` : current,
    reference: matchedPath.join("."),
  };
}

function findValue(path, scope) {
  const sources = [];
  if (scope) sources.push({ source: scope, prefix: "scope." });
  sources.push({ source: variables, prefix: "variables." });
  sources.push({ source: _all, prefix: "" });

  for (const { source, prefix } of sources) {
    const value = resolveFromSource(source, path);
    if (value !== undefined) {
      const reference = `${prefix}${value.reference}`;
      const variableName = reference.startsWith("variables.")
        ? reference.slice("variables.".length).split(".")[0]
        : undefined;
      if (variableName && variableOptions.get(variableName)?.deleteAfterUse) {
        delete variables[variableName];
        variableOptions.delete(variableName);
      }
      loggerChannel.debug(
        `String Fetched from %c${language}%c: %c${reference} %c-> %c"${String(
          value.value,
        )}"`,
        translationLogChannel,
        [
          "color: lightblue;",
          "color: initial",
          "color: violet;",
          "color: initial",
          "color: orangered",
        ],
      );
      return { ...value, reference };
    }
  }

  return { value: undefined, reference: path };
}

function formatUnresolvedReference(reference) {
  const fix = Meta.jsonReferancerNFix;
  return typeof fix === "string" && fix.includes("*")
    ? fix.replace("*", reference)
    : `{{${reference}}}`;
}

function parseReference(reference) {
  const segments = reference.split("|").map((segment) => segment.trim());
  const explicitlyRooted = segments[0] === "this";
  const path = segments
    .filter(Boolean)
    .slice(explicitlyRooted ? 1 : 0)
    .join(".");
  if (!path) return undefined;

  if (!explicitlyRooted && !path.includes(".") && Config.jsonReferanceScope) {
    const scopedPath =
      Config.jsonReferanceScope === "this"
        ? path
        : `${Config.jsonReferanceScope}.${path}`;
    return findValue(scopedPath);
  }

  return findValue(path);
}

function parseValue(value, scope, resolving) {
  if (typeof value !== "string") return value;

  const prefix = Config.prefix ?? "$:";
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyWord = "[\\w$-]+";
  const prefixedKey = new RegExp(
    `${escapedPrefix}(${keyWord}(?:[ _]+${keyWord})*(?:\\.${keyWord}(?:[ _]+${keyWord})*)*)`,
    "g",
  );

  let parsed = value.replace(prefixedKey, (token, path) => {
    const resolved = findValue(path, scope);
    if (resolved.value === undefined) {
      if (Meta.strict) throw new Error(`Missing string key: ${path}`);
      return normalizeInvalidKey(path);
    }
    return stringifyResolved(resolved, scope, resolving);
  });

  parsed = parsed.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (token, reference) => {
    const resolved = parseReference(reference);
    if (!resolved || resolved.value === undefined) {
      if (Meta.strict)
        throw new Error(`Missing string reference: ${reference.trim()}`);

      return formatUnresolvedReference(reference.trim());
    }
    return stringifyResolved(resolved, scope, resolving);
  });

  return parsed;
}

function stringifyResolved(resolved, scope, resolving) {
  if (typeof resolved.value !== "string") return String(resolved.value);
  if (resolving.has(resolved.reference)) {
    if (Meta.strict)
      throw new Error(`Circular string reference: ${resolved.reference}`);

    return resolved.value;
  }

  if (!Config.recursiveParsing) return resolved.value;

  const nextResolving = new Set(resolving);
  nextResolving.add(resolved.reference);
  return parseValue(resolved.value, scope, nextResolving);
}

// defaults
const _defaults = {
  allowedAttrs: ["placeholder", "title", "alt", "aria-label"],
  ignoredTags: ["SCRIPT", "STYLE", "I"],
};

// normal utils
function variable(name, value, options) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new TypeError("Variable name must be a non-empty string.");
  }

  const hasValue = arguments.length >= 2;
  if (hasValue) {
    if (options === undefined) options = {};
    if (options === null || typeof options !== "object") {
      throw new TypeError("Variable options must be an object.");
    }

    const storedValue = options.parseValueToo
      ? parseValue(value, undefined, new Set())
      : value;
    variables[name] = storedValue;
    variableOptions.set(name, {
      deleteAfterUse: Boolean(options.deleteAfterUse),
    });
    return storedValue;
  }

  const storedValue = variables[name];
  if (variableOptions.get(name)?.deleteAfterUse) {
    delete variables[name];
    variableOptions.delete(name);
  }
  return storedValue;
}

function parseText(text, scope) {
  return parseValue(String(text), resolveScope(scope), new Set());
}

// dom specific
function parseAttributes(
  element,
  context,
  allowedAttrs = _defaults.allowedAttrs,
) {
  if (!element || !element.attributes) return;

  for (const attr of [...element.attributes]) {
    if (allowedAttrs.includes(attr.name)) {
      const value = attr.value;
      loggerChannel.debug(
        `${attr.name
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")} String Found in current page: %c"${value}"`,
        translationLogChannel,
        ["color: orangered;"],
      );
      if (value && value.trim() !== "") {
        const parsed = parseText(value, context);
        if (parsed !== value) {
          element.setAttribute(attr.name, parsed);
        }
      }
    }
  }
}

function parseTextNodes(element, context, ignoredTags = _defaults.ignoredTags) {
  element.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      loggerChannel.debug(
        `String Found in current page: %c"${text}"`,
        translationLogChannel,
        ["color: orangered;"],
      );
      if (text && text.trim() !== "") {
        const parsed = parseText(text, context);
        if (parsed !== text) {
          node.nodeValue = parsed;
        }
      }
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      !ignoredTags.includes(node.tagName)
    ) {
      parseTextNodes(node, context, ignoredTags);
    }
  });
}

function parseElement(element, context, options = {}) {
  if (!element) return;
  const { allowedAttrs, ignoredTags } = options;
  parseTextNodes(element, context, ignoredTags);
  parseAttributes(element, context, allowedAttrs);
  const children = element.querySelectorAll
    ? element.querySelectorAll("*")
    : [];
  children.forEach((child) => {
    parseAttributes(child, context, allowedAttrs);
  });
}

// extra things
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character]),
  );
}

const _utils = {
  parseText,
  normalizeInvalidKey,
  findValue,
  variable,
};
const _dom_utils = { parseElement, parseTextNodes, parseAttributes };

export { _defaults, _utils, _dom_utils, escapeHTML };
export default _all;

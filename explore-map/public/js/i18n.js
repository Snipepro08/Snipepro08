// i18n.js — chargement dynamique des fichiers public/locales/*.json
const I18N = { lang: "fr", dict: {}, all: {} };

const LANG_CODES = ["fr", "en", "ur", "arz"];

async function loadLocales() {
  const entries = await Promise.all(
    LANG_CODES.map((code) => fetch(`locales/${code}.json`).then((r) => r.json()))
  );
  entries.forEach((d) => (I18N.all[d.code] = d));
  I18N.dict = I18N.all[I18N.lang];
}

function t(key) {
  return (I18N.dict && I18N.dict[key]) || (I18N.all.fr && I18N.all.fr[key]) || key;
}

function setLang(code) {
  if (!I18N.all[code]) return;
  I18N.lang = code;
  I18N.dict = I18N.all[code];
  applyI18n();
}

function applyI18n() {
  document.documentElement.dir = I18N.dict.dir;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-zone-btn]").forEach((el) => {
    el.textContent = t(el.dataset.zone);
  });
  renderLangButtons();
}

function renderLangButtons() {
  const row = document.getElementById("langRow");
  if (!row) return;
  row.innerHTML = "";
  LANG_CODES.forEach((code) => {
    const d = I18N.all[code];
    const b = document.createElement("button");
    b.className = "langBtn" + (code === I18N.lang ? " active" : "");
    b.textContent = d.label;
    b.onclick = () => setLang(code);
    row.appendChild(b);
  });
}

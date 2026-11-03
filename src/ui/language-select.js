// The list of languages, next to the shortcuts button (docs/059), built from the languages
// available. Changing the language reloads the page, after a confirmation: the game in
// progress is lost.

import { LANGUAGES, getLanguage, saveLanguage, t } from '../i18n/i18n.js';

/** @param {HTMLElement} neighbour the list is placed right after this element */
export function createLanguageSelect(neighbour) {
  const select = document.createElement('select');
  select.className = 'language-select';
  select.title = t('language.title');
  select.setAttribute('aria-label', t('language.title'));
  for (const { id, label } of LANGUAGES) select.add(new Option(label, id));
  select.value = getLanguage();
  select.addEventListener('change', () => {
    if (window.confirm(t('language.confirm'))) {
      saveLanguage(select.value);
      window.location.reload();
    } else {
      select.value = getLanguage();
    }
    select.blur(); // keep the keyboard for the viewer
  });
  // Keys on the focused list move it instead of driving the viewer.
  select.addEventListener('keydown', (event) => event.stopPropagation());
  neighbour.after(select);
  return select;
}

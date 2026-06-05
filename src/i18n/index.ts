import { createI18n } from 'vue-i18n'

const messages = {
  de: {
    setup: {
      hint:            'Bitte füge die IDs und den Zugangscode aus deinem Einladungslink ein.',
      planId:          'Plan-ID',
      personId:        'Personen-ID',
      token:           'Zugangscode',
      month:           'Monat',
      tokenPlaceholder:'Aus dem Einladungslink kopieren',
      confirm:         'Bestätigen',
      mockData:        '🛠 Mock-Daten einfügen',
      errUuid:         'Ungültige UUID (Format: xxxxxxxx-xxxx-4xxx-…)',
      errUuidShort:    'Ungültige UUID',
      errId:           'Ungültige ID (Buchstaben, Ziffern, Bindestrich; max. 64 Zeichen)',
      errToken:        'Zugangscode darf nicht leer sein',
      errMonth:        'Ungültiges Format (YYYY-MM)',
    },
    toolbar: {
      saveTip:         'Wünsche senden',
      savePending:     'Sicherheitsprüfung läuft noch',
      today:           'Heute',
      deadline:        'Frist: {date}',
    },
    calendar: {
      loadOtherMonths: 'Wünsche aus anderen Monaten laden',
    },
    legend: {
      preferred:       '★ Bevorzugt',
      unavailable:     '✗ Nicht verfügbar',
      available:       '□ Verfügbar (Standard)',
      holiday:         '◆ Feiertag',
    },
    toast: {
      loading:         'Lade gespeicherte Daten…',
      tokenInvalid:    'Zugangscode ungültig. Bitte überprüfe deinen Einladungslink.',
      loaded:          '{n} Wunsch geladen. | {n} Wünsche geladen.',
      turnstileExpired:'Sicherheitsprüfung abgelaufen — bitte erneut bestätigen.',
      turnstileNeeded: 'Bitte die Sicherheitsprüfung (Turnstile) abschließen.',
      saved:           '{n} Wunsch gesendet ✓ | {n} Wünsche gesendet ✓',
      savedMonths:     '{months}',
      turnstileFailed: 'Sicherheitsprüfung fehlgeschlagen — bitte erneut versuchen.',
      saveError:       'Fehler beim Speichern: {error}',
      networkError:    'Netzwerkfehler — Senden fehlgeschlagen.',
      undone:          'Rückgängig gemacht',
      redone:          'Wiederholt',
      enterWishes:     'Bitte trage deine Wünsche für {month} ein',
    },
    modal: {
      daysMarked:      '{n} Tag markiert. | {n} Tage markiert.',
      setWish:         'Wunsch für diesen Zeitraum setzen:',
      preferred:       '★ Bevorzugt',
      unavailable:     '✗ Nicht verfügbar',
      clear:           '□ Löschen',
      shift:           'Dienst',
      allShifts:       'Alle Dienste',
      note:            'Notiz',
      optional:        '(optional)',
      notePlaceholder: 'Gilt für alle markierten Tage…',
      cancel:          'Abbrechen',
    },
    note: {
      ariaLabel:       'Notiz bearbeiten',
      title:           'Notiz',
      shift:           'Dienst',
      allShifts:       'Alle Dienste',
      placeholder:     'Optionale Notiz zu diesem Wunsch…',
      save:            'Speichern',
      cancel:          'Abbrechen',
    },
  },
  en: {
    setup: {
      hint:            'Please paste the IDs and access code from your invitation link.',
      planId:          'Plan ID',
      personId:        'Person ID',
      token:           'Access Code',
      month:           'Month',
      tokenPlaceholder:'Copy from invitation link',
      confirm:         'Confirm',
      mockData:        '🛠 Insert Mock Data',
      errUuid:         'Invalid UUID (format: xxxxxxxx-xxxx-4xxx-…)',
      errUuidShort:    'Invalid UUID',
      errId:           'Invalid ID (letters, digits, hyphens; max. 64 characters)',
      errToken:        'Access code must not be empty',
      errMonth:        'Invalid format (YYYY-MM)',
    },
    toolbar: {
      saveTip:         'Send wishes',
      savePending:     'Security check still running',
      today:           'Today',
      deadline:        'Deadline: {date}',
    },
    calendar: {
      loadOtherMonths: 'Load wishes from other months',
    },
    legend: {
      preferred:       '★ Preferred',
      unavailable:     '✗ Not available',
      available:       '□ Available (default)',
      holiday:         '◆ Holiday',
    },
    toast: {
      loading:         'Loading saved data…',
      tokenInvalid:    'Invalid access code. Please check your invitation link.',
      loaded:          '{n} wish loaded. | {n} wishes loaded.',
      turnstileExpired:'Security check expired — please confirm again.',
      turnstileNeeded: 'Please complete the security check (Turnstile).',
      saved:           '{n} wish sent ✓ | {n} wishes sent ✓',
      savedMonths:     '{months}',
      turnstileFailed: 'Security check failed — please try again.',
      saveError:       'Save error: {error}',
      networkError:    'Network error — sending failed.',
      undone:          'Undone',
      redone:          'Redone',
      enterWishes:     'Please enter your wishes for {month}',
    },
    modal: {
      daysMarked:      '{n} day marked. | {n} days marked.',
      setWish:         'Set wish for this period:',
      preferred:       '★ Preferred',
      unavailable:     '✗ Not available',
      clear:           '□ Clear',
      shift:           'Shift',
      allShifts:       'All shifts',
      note:            'Note',
      optional:        '(optional)',
      notePlaceholder: 'Applies to all selected days…',
      cancel:          'Cancel',
    },
    note: {
      ariaLabel:       'Edit note',
      title:           'Note',
      shift:           'Shift',
      allShifts:       'All shifts',
      placeholder:     'Optional note for this wish…',
      save:            'Save',
      cancel:          'Cancel',
    },
  },
}

const browserLang = navigator.language.startsWith('en') ? 'en' : 'de'

export const i18n = createI18n({
  legacy:          false,
  globalInjection: true,
  locale:          browserLang,
  fallbackLocale:  'de',
  messages,
})

export function setLocale(lang: Locale): void {
  i18n.global.locale.value = lang
}

export type Locale = 'de' | 'en'

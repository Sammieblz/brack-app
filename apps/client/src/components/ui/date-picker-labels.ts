import { enGB, enUS, es, fr } from "date-fns/locale";

const english = {
  chooseDate: "Choose date",
  chooseMonth: "Choose month",
  chooseYear: "Choose year",
  previousMonth: "Previous month",
  nextMonth: "Next month",
  previousYear: "Previous year",
  nextYear: "Next year",
  previousDecade: "Previous decade",
  nextDecade: "Next decade",
  today: "Today",
  clear: "Clear date",
  cancel: "Cancel",
  close: "Close calendar",
  format: "Format",
  invalid: "Enter a real calendar date.",
  incomplete: "Enter the complete date, including a four-digit year.",
  required: "Choose a date.",
  useFormat: "Use the displayed date format or YYYY-MM-DD.",
  minimum: "Choose a date on or after",
  maximum: "Choose a date on or before",
  help: "Arrow keys move between dates. Page Up/Down changes month; Shift changes year. Home/End moves within the week.",
  browseHelp: "Choose a year and month, then a day. Browsing does not change your selected date.",
};

export type DatePickerLabels = typeof english;

const spanish: DatePickerLabels = {
  chooseDate: "Elegir fecha", chooseMonth: "Elegir mes", chooseYear: "Elegir año",
  previousMonth: "Mes anterior", nextMonth: "Mes siguiente",
  previousYear: "Año anterior", nextYear: "Año siguiente",
  previousDecade: "Década anterior", nextDecade: "Década siguiente",
  today: "Hoy", clear: "Borrar fecha", cancel: "Cancelar", close: "Cerrar calendario",
  format: "Formato", invalid: "Introduce una fecha que exista.",
  incomplete: "Introduce la fecha completa, incluido el año de cuatro dígitos.",
  required: "Elige una fecha.", useFormat: "Usa el formato indicado o AAAA-MM-DD.",
  minimum: "Elige una fecha a partir del", maximum: "Elige una fecha hasta el",
  help: "Las flechas cambian de día. Av Pág/Re Pág cambia de mes; con Mayús, de año. Inicio/Fin se mueve dentro de la semana.",
  browseHelp: "Elige un año, un mes y después un día. Navegar no cambia la fecha seleccionada.",
};

const french: DatePickerLabels = {
  chooseDate: "Choisir une date", chooseMonth: "Choisir le mois", chooseYear: "Choisir l’année",
  previousMonth: "Mois précédent", nextMonth: "Mois suivant",
  previousYear: "Année précédente", nextYear: "Année suivante",
  previousDecade: "Décennie précédente", nextDecade: "Décennie suivante",
  today: "Aujourd’hui", clear: "Effacer la date", cancel: "Annuler", close: "Fermer le calendrier",
  format: "Format", invalid: "Saisissez une date qui existe.",
  incomplete: "Saisissez la date complète, avec une année à quatre chiffres.",
  required: "Choisissez une date.", useFormat: "Utilisez le format indiqué ou AAAA-MM-JJ.",
  minimum: "Choisissez une date à partir du", maximum: "Choisissez une date au plus tard le",
  help: "Les flèches changent de jour. Page précédente/suivante change de mois ; avec Maj, d’année. Début/Fin se déplace dans la semaine.",
  browseHelp: "Choisissez une année, un mois, puis un jour. La navigation ne modifie pas la date sélectionnée.",
};

export function getDatePickerLabels(locale: string): DatePickerLabels {
  const language = locale.split("-")[0].toLowerCase();
  return language === "es" ? spanish : language === "fr" ? french : english;
}

export function getCalendarLocale(locale: string) {
  const language = locale.split("-")[0].toLowerCase();
  if (language === "es") return es;
  if (language === "fr") return fr;
  return /^en-(GB|IE|AU|NZ)/i.test(locale) ? enGB : enUS;
}

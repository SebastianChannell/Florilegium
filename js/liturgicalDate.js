const romanNumerals = [
  ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90],
  ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
];

const kalendsMonths = [
  'Ianuarias', 'Februarias', 'Martias', 'Apriles', 'Maias', 'Iunias',
  'Iulias', 'Augustas', 'Septembres', 'Octobres', 'Novembres', 'Decembres',
];
const nonesMonths = ['Ianuarias', 'Februarias', 'Martias', 'Apriles', 'Maias', 'Iunias', 'Iulias', 'Augustas', 'Septembres', 'Octobres', 'Novembres', 'Decembres'];
const idesMonths = ['Ianuas', 'Februarias', 'Martias', 'Apriles', 'Maias', 'Iunias', 'Iulias', 'Augustas', 'Septembres', 'Octobres', 'Novembres', 'Decembres'];
const ordinal = ['', 'Pridie', 'Tertio', 'Quarto', 'Quinto', 'Sexto', 'Septimo', 'Octavo', 'Nono', 'Decimo', 'Undecimo', 'Duodecimo', 'Tertio decimo', 'Quarto decimo', 'Quinto decimo', 'Sexto decimo', 'Septimo decimo', 'Duodevicesimo', 'Undevicesimo'];

export function toRomanYear(year) {
  let rest = year;
  let out = '';
  romanNumerals.forEach(([numeral, value]) => {
    while (rest >= value) { out += numeral; rest -= value; }
  });
  return `${out}.`;
}

export function getLatinMartyrologyDate(date = new Date()) {
  const day = date.getDate();
  const month = date.getMonth();
  const nonesDay = [2, 4, 6, 9].includes(month) ? 7 : 5;
  const idesDay = [2, 4, 6, 9].includes(month) ? 15 : 13;
  if (day === 1) return `Kalendis ${kalendsMonths[month]},`;
  if (day === nonesDay) return `Nonis ${nonesMonths[month]},`;
  if (day === idesDay) return `Idibus ${idesMonths[month]},`;
  if (day < nonesDay) return `${ordinal[nonesDay - day + 1]} Nonas ${nonesMonths[month]},`;
  if (day < idesDay) return `${ordinal[idesDay - day + 1]} Idus ${idesMonths[month]},`;
  const nextMonth = (month + 1) % 12;
  const lastDay = new Date(date.getFullYear(), month + 1, 0).getDate();
  return `${ordinal[lastDay - day + 2]} Kalendas ${kalendsMonths[nextMonth]},`;
}

export function getLiturgicalDate(date = new Date()) {
  return { latinMartyrologyDate: getLatinMartyrologyDate(date), romanYear: toRomanYear(date.getFullYear()) };
}

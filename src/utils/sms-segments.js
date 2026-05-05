// Pure JS, no Node-only APIs — safe to import in both the browser and serverless functions.
//
// Twilio bills per segment, not per message. GSM-7 fits 160 septets in one segment
// (153 in multi-part). UCS-2 fits 70 code units in one segment (67 in multi-part).
// Polish accents (ą/ć/ę/ł/ń/ó/ś/ź/ż) force UCS-2.

const GSM_BASE = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);

const GSM_EXT = new Set("\f^{}\\[~]|€");

export function encoding(text) {
  for (const ch of text) {
    if (!GSM_BASE.has(ch) && !GSM_EXT.has(ch)) {
      return "UCS-2";
    }
  }
  return "GSM-7";
}

function gsmSeptets(text) {
  let count = 0;
  for (const ch of text) {
    if (GSM_EXT.has(ch)) count += 2;
    else count += 1;
  }
  return count;
}

export function segments(text) {
  if (text.length === 0) return 0;
  if (encoding(text) === "GSM-7") {
    const septets = gsmSeptets(text);
    if (septets <= 160) return 1;
    return Math.ceil(septets / 153);
  }
  const units = text.length;
  if (units <= 70) return 1;
  return Math.ceil(units / 67);
}

const TRANSLIT = {
  ą: "a", Ą: "A",
  ć: "c", Ć: "C",
  ę: "e", Ę: "E",
  ł: "l", Ł: "L",
  ń: "n", Ń: "N",
  ó: "o", Ó: "O",
  ś: "s", Ś: "S",
  ź: "z", Ź: "Z",
  ż: "z", Ż: "Z",
};

export function transliterate(text) {
  return text.replace(/[ąĄćĆęĘłŁńŃóÓśŚźŹżŻ]/g, (ch) => TRANSLIT[ch] ?? ch);
}

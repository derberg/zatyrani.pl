import { authorizeSender, getServiceClient, systemError } from "./_shared.js";
import { cleanPhone, normalizeMemberPhone } from "../../src/utils/phone.js";

const MAX_NAME_LENGTH = 100;

function normalizeName(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim();
}

function validateInput(body) {
  const name = normalizeName(body.name);
  if (!name) return { error: "Podaj imię i nazwisko." };
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Imię i nazwisko może mieć maksymalnie ${MAX_NAME_LENGTH} znaków.` };
  }
  const phone = normalizeMemberPhone(body.phone);
  if (!phone) {
    return {
      error: "Nieprawidłowy numer telefonu. Wpisz 9 cyfr, np. 600 100 200 (zagraniczny z +, np. +49…).",
    };
  }
  return { name, phone };
}

// Compare on cleaned phones so legacy rows with copy-pasted bidi marks still match.
async function findByPhone(supabase, phone, excludeId) {
  const { data, error } = await supabase.from("members").select("id, name, phone, deleted_at");
  if (error) throw new Error("Members lookup failed");
  return (data || []).find((m) => m.id !== excludeId && cleanPhone(m.phone) === phone) || null;
}

async function createMember(req, res, supabase, sender) {
  const input = validateInput(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });

  const existing = await findByPhone(supabase, input.phone);
  if (existing && !existing.deleted_at) {
    return res.status(409).json({ error: `Ten numer już jest na liście: ${existing.name}.` });
  }

  // A previously deleted person with the same number is brought back instead of
  // creating a second row, so login (which looks members up by phone) stays unambiguous.
  // Gate access is never restored with them; it has to be granted again in the DB.
  if (existing) {
    const { data, error } = await supabase
      .from("members")
      .update({ name: input.name, phone: input.phone, deleted_at: null, can_send_sms: false })
      .eq("id", existing.id)
      .select("id, name, phone")
      .single();
    if (error) throw error;
    console.log(`[sms-gate] member restored by ${sender.name} (${sender.id}): ${data.name} ${data.phone} (${data.id})`);
    return res.status(200).json({ member: data, restored: true });
  }

  const { data, error } = await supabase
    .from("members")
    .insert({ name: input.name, phone: input.phone })
    .select("id, name, phone")
    .single();
  if (error) throw error;
  console.log(`[sms-gate] member added by ${sender.name} (${sender.id}): ${data.name} ${data.phone} (${data.id})`);
  return res.status(201).json({ member: data });
}

async function updateMember(req, res, supabase, sender, id) {
  const input = validateInput(req.body || {});
  if (input.error) return res.status(400).json({ error: input.error });

  const existing = await findByPhone(supabase, input.phone, id);
  if (existing) {
    return res.status(409).json({
      error: existing.deleted_at
        ? `Ten numer należał do usuniętej osoby (${existing.name}). Użyj „Dodaj osobę”, żeby ją przywrócić.`
        : `Ten numer już jest na liście: ${existing.name}.`,
    });
  }

  const { data, error } = await supabase
    .from("members")
    .update({ name: input.name, phone: input.phone })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name, phone");
  if (error) throw error;
  if (!data || data.length === 0) {
    return res.status(404).json({ error: "Nie znaleziono osoby. Odśwież stronę." });
  }
  const member = data[0];
  console.log(`[sms-gate] member updated by ${sender.name} (${sender.id}): ${member.name} ${member.phone} (${member.id})`);
  return res.status(200).json({ member });
}

async function deleteMember(req, res, supabase, sender, id) {
  if (id === sender.id) {
    return res.status(400).json({ error: "Nie możesz usunąć samego siebie." });
  }

  // Soft delete: the row stays (SMS history references it), it is only hidden.
  const { data, error } = await supabase
    .from("members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name, phone");
  if (error) throw error;
  if (!data || data.length === 0) {
    return res.status(404).json({ error: "Nie znaleziono osoby. Odśwież stronę." });
  }
  const member = data[0];

  // Log the person out everywhere; login itself already skips deleted members.
  const { error: sessionsError } = await supabase.from("sessions").delete().eq("member_id", id);
  if (sessionsError) {
    console.error(`[sms-gate] ! sessions cleanup failed for ${member.id}:`, sessionsError.message);
  }

  console.log(`[sms-gate] member deleted by ${sender.name} (${sender.id}): ${member.name} ${member.phone} (${member.id})`);
  return res.status(200).json({ ok: true });
}

export default async function handler(req, res) {
  if (!["POST", "PATCH", "DELETE"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query?.id === "string" ? req.query.id : "";
  if (req.method !== "POST" && !id) {
    return res.status(400).json({ error: "Brak identyfikatora osoby." });
  }

  let supabase;
  try {
    supabase = getServiceClient();
  } catch (e) {
    console.error("SMS gate config error:", e);
    return systemError(res);
  }

  let sender;
  try {
    sender = await authorizeSender(req, supabase);
  } catch (e) {
    if (e.status === 403) {
      return res.status(403).json({ error: "Brak uprawnień." });
    }
    return res.status(401).json({ error: e.message || "Brak autoryzacji." });
  }

  try {
    if (req.method === "POST") return await createMember(req, res, supabase, sender);
    if (req.method === "PATCH") return await updateMember(req, res, supabase, sender, id);
    return await deleteMember(req, res, supabase, sender, id);
  } catch (e) {
    console.error(`Members ${req.method} error:`, e);
    return systemError(res);
  }
}

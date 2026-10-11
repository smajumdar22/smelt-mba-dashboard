// Telegram bot for SMELT reminders. Telegram calls this for every message the bot gets.
//
//   /start <code>  link this chat to the app account that made the one-time code
//   /stop          unlink: no more Telegram reminders
//   anything else  short help
//
// Secrets (supabase secrets set ...):
//   TELEGRAM_BOT_TOKEN        from @BotFather
//   TELEGRAM_WEBHOOK_SECRET   random string; also passed to setWebhook as secret_token
// Deploy with --no-verify-jwt (Telegram can't send a Supabase login); the secret header protects it.

import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";

async function reply(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
}

Deno.serve(async (req) => {
  const secret = env("TELEGRAM_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Always answer 200 so Telegram doesn't retry the same update forever.
  const ok = () => new Response("ok");

  let update: any;
  try { update = await req.json(); } catch { return ok(); }
  const msg = update?.message;
  const chatId: number | undefined = msg?.chat?.id;
  const text: string = (msg?.text ?? "").trim();
  if (!chatId || msg?.chat?.type !== "private") return ok();

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const appUrl = env("APP_URL");

  if (text.startsWith("/start")) {
    const code = text.split(/\s+/)[1] ?? "";
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) {
      await reply(chatId, `Hi! To get reminders, open the SMELT dashboard, tap the bell, and choose "Connect Telegram".${appUrl ? `\n${appUrl}` : ""}`);
      return ok();
    }

    // Use the code once: delete it and get the account it belongs to.
    const { data: rows } = await db.from("telegram_link_codes")
      .delete().eq("code", code).gt("expires_at", new Date().toISOString())
      .select("user_id");
    const userId = rows?.[0]?.user_id;
    if (!userId) {
      await reply(chatId, "That link has expired or was already used. Tap \"Connect Telegram\" in the app again to get a new one.");
      return ok();
    }

    const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || msg.from?.username || null;
    // One chat per account, and one account per chat.
    await db.from("telegram_links").delete().eq("chat_id", chatId);
    const { error } = await db.from("telegram_links")
      .upsert({ user_id: userId, chat_id: chatId, display_name: name, linked_at: new Date().toISOString() });
    if (error) {
      console.error("link failed", error);
      await reply(chatId, "Sorry, something went wrong connecting. Please try again from the app.");
      return ok();
    }
    await db.from("reminder_settings").update({ by_telegram: true }).eq("user_id", userId);

    await reply(chatId,
      "✅ Connected! You'll get your SMELT assignment reminders here.\n\n" +
      "Change when you're reminded with the bell in the app. Send /stop anytime to turn Telegram reminders off.");
    return ok();
  }

  if (text.startsWith("/stop")) {
    const { data: gone } = await db.from("telegram_links").delete().eq("chat_id", chatId).select("user_id");
    for (const g of gone ?? []) {
      await db.from("reminder_settings").update({ by_telegram: false }).eq("user_id", g.user_id);
    }
    await reply(chatId, gone?.length
      ? "Telegram reminders are off and this chat is disconnected. You can reconnect from the app anytime."
      : "This chat isn't connected to SMELT reminders.");
    return ok();
  }

  await reply(chatId, "I only send SMELT assignment reminders. Manage them with the bell in the app, or send /stop to turn them off.");
  return ok();
});

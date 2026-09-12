import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { notifyDiscord } from "./discordWebhook.js";
import { shortId } from "./licenseToken.js";
import { prisma } from "./prisma.js";

/**
 * The admin console for the desktop licence, as a Discord bot.
 *
 * This is where the sensitive credential lives — and it lives *here*, on the server, never in the
 * shipped `.exe`. The client only ever talks to the licensing HTTP API; the bot token, the guild,
 * and the admin allowlist are server env. That separation is the actual security of this feature:
 * a user who unpacks the exe finds no way to approve their own device or read anyone else's.
 *
 * Commands (allowlisted admins only):
 *   /pending            — devices waiting for approval
 *   /devices [status]   — list devices
 *   /approve  <id>      — let a device in
 *   /block    <id> [r]  — deny / revoke a device (the kill switch)
 *   /kill     <id>      — alias of /block, for muscle memory
 *   /reactivate <id>    — lift a block
 *
 * `<id>` is the short 8-char device id from the list; a prefix is fine as long as it is unique.
 */

const STATUS_EMOJI: Record<string, string> = { PENDING: "🕒", APPROVED: "✅", BLOCKED: "⛔" };

/** Admins allowed to run the commands. Empty allowlist ⇒ nobody, fail closed. */
function adminIds(): Set<string> {
  return new Set(
    (process.env.DISCORD_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Resolve a typed short id (or unique prefix) to exactly one device, or explain why not. */
async function resolveDevice(idInput: string) {
  const q = idInput.trim().toLowerCase();
  if (q.length < 4) return { error: "المعرّف قصير أوي — اكتب 4 حروف على الأقل." as const };
  const matches = await prisma.licenseDevice.findMany({
    where: { machineHash: { startsWith: q } },
    take: 5,
  });
  if (matches.length === 0) return { error: "مفيش جهاز بالمعرّف ده." as const };
  if (matches.length > 1) return { error: "المعرّف بيطابق أكتر من جهاز — زوّد حروف." as const };
  return { device: matches[0]! };
}

function deviceLine(d: {
  machineHash: string;
  status: string;
  label: string | null;
  hostname: string | null;
  osUser: string | null;
  lastSeenAt: Date;
}): string {
  const emoji = STATUS_EMOJI[d.status] ?? "•";
  const who = [d.label, d.hostname && `${d.hostname}`, d.osUser && `(${d.osUser})`].filter(Boolean).join(" ");
  return `${emoji} \`${shortId(d.machineHash)}\` — ${who || "—"} · آخر ظهور ${d.lastSeenAt.toISOString().slice(0, 16).replace("T", " ")}`;
}

async function handleList(interaction: ChatInputCommandInteraction, statusFilter?: "PENDING" | "APPROVED" | "BLOCKED") {
  const devices = await prisma.licenseDevice.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { lastSeenAt: "desc" },
    take: 25,
  });
  const title = statusFilter ? `أجهزة (${statusFilter})` : "كل الأجهزة";
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0x7c3aed)
    .setDescription(devices.length ? devices.map(deviceLine).join("\n") : "لا يوجد.")
    .setFooter({ text: `الإجمالي: ${devices.length}` });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleApprove(interaction: ChatInputCommandInteraction, actor: string) {
  const r = await resolveDevice(interaction.options.getString("id", true));
  if ("error" in r) return interaction.reply({ content: r.error, ephemeral: true });
  const d = await prisma.licenseDevice.update({
    where: { machineHash: r.device.machineHash },
    data: { status: "APPROVED", approvedBy: actor, approvedAt: new Date(), blockReason: null },
  });
  await prisma.licenseAuditEvent.create({
    data: { type: "approve", machineHash: d.machineHash, detail: { by: actor } },
  }).catch(() => {});
  notifyDiscord(`✅ ${actor} فعّل الجهاز \`${shortId(d.machineHash)}\` (${d.hostname ?? "—"})`);
  await interaction.reply({ content: `تم تفعيل \`${shortId(d.machineHash)}\` — هيشتغل خلال ثواني.`, ephemeral: true });
}

async function handleBlock(interaction: ChatInputCommandInteraction, actor: string) {
  const r = await resolveDevice(interaction.options.getString("id", true));
  if ("error" in r) return interaction.reply({ content: r.error, ephemeral: true });
  const reason = interaction.options.getString("reason") ?? undefined;
  const d = await prisma.licenseDevice.update({
    where: { machineHash: r.device.machineHash },
    data: { status: "BLOCKED", blockedBy: actor, blockedAt: new Date(), blockReason: reason },
  });
  await prisma.licenseAuditEvent.create({
    data: { type: "block", machineHash: d.machineHash, detail: { by: actor, reason } },
  }).catch(() => {});
  notifyDiscord(`⛔ ${actor} قفل الجهاز \`${shortId(d.machineHash)}\` (${d.hostname ?? "—"})${reason ? ` — ${reason}` : ""}`);
  await interaction.reply({ content: `تم قفل \`${shortId(d.machineHash)}\` — هيتقفل عنده خلال ثواني.`, ephemeral: true });
}

async function handleReactivate(interaction: ChatInputCommandInteraction, actor: string) {
  const r = await resolveDevice(interaction.options.getString("id", true));
  if ("error" in r) return interaction.reply({ content: r.error, ephemeral: true });
  const d = await prisma.licenseDevice.update({
    where: { machineHash: r.device.machineHash },
    data: { status: "APPROVED", approvedBy: actor, approvedAt: new Date(), blockReason: null, blockedBy: null, blockedAt: null },
  });
  await prisma.licenseAuditEvent.create({
    data: { type: "reactivate", machineHash: d.machineHash, detail: { by: actor } },
  }).catch(() => {});
  notifyDiscord(`♻️ ${actor} رجّع تفعيل \`${shortId(d.machineHash)}\``);
  await interaction.reply({ content: `تم إعادة تفعيل \`${shortId(d.machineHash)}\`.`, ephemeral: true });
}

const COMMANDS = [
  new SlashCommandBuilder().setName("pending").setDescription("الأجهزة اللي مستنية تفعيل"),
  new SlashCommandBuilder()
    .setName("devices")
    .setDescription("عرض الأجهزة")
    .addStringOption((o) =>
      o
        .setName("status")
        .setDescription("فلتر بالحالة")
        .addChoices(
          { name: "pending", value: "PENDING" },
          { name: "approved", value: "APPROVED" },
          { name: "blocked", value: "BLOCKED" },
        ),
    ),
  new SlashCommandBuilder()
    .setName("approve")
    .setDescription("تفعيل جهاز")
    .addStringOption((o) => o.setName("id").setDescription("معرّف الجهاز").setRequired(true)),
  new SlashCommandBuilder()
    .setName("block")
    .setDescription("قفل / رفض جهاز")
    .addStringOption((o) => o.setName("id").setDescription("معرّف الجهاز").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("السبب (اختياري)")),
  new SlashCommandBuilder()
    .setName("kill")
    .setDescription("قفل جهاز (زي block)")
    .addStringOption((o) => o.setName("id").setDescription("معرّف الجهاز").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("السبب (اختياري)")),
  new SlashCommandBuilder()
    .setName("reactivate")
    .setDescription("إلغاء القفل عن جهاز")
    .addStringOption((o) => o.setName("id").setDescription("معرّف الجهاز").setRequired(true)),
].map((c) => c.toJSON());

/**
 * Boots the licence admin bot. A no-op — logged, not thrown — when `DISCORD_BOT_TOKEN` is unset,
 * so the whole feature is opt-in and the API runs fine without it.
 */
export async function startLicenseBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log("[license-bot] DISCORD_BOT_TOKEN not set — Discord admin console disabled.");
    return;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (c) => {
    console.log(`[license-bot] logged in as ${c.user.tag}`);
    try {
      const rest = new REST({ version: "10" }).setToken(token);
      const guildId = process.env.DISCORD_GUILD_ID;
      if (guildId) {
        // Guild commands register instantly; global ones take up to an hour to propagate.
        await rest.put(Routes.applicationGuildCommands(c.user.id, guildId), { body: COMMANDS });
        console.log(`[license-bot] slash commands registered to guild ${guildId}`);
      } else {
        await rest.put(Routes.applicationCommands(c.user.id), { body: COMMANDS });
        console.log("[license-bot] global slash commands registered (may take up to 1h)");
      }
    } catch (err) {
      console.error("[license-bot] command registration failed:", err);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // The gate: only allowlisted admins, always. An empty allowlist rejects everyone.
    if (!adminIds().has(interaction.user.id)) {
      await interaction.reply({ content: "مش مسموح ليك بالأمر ده.", ephemeral: true }).catch(() => {});
      return;
    }

    const actor = `${interaction.user.username} (${interaction.user.id})`;
    try {
      switch (interaction.commandName) {
        case "pending":
          return await handleList(interaction, "PENDING");
        case "devices":
          return await handleList(
            interaction,
            (interaction.options.getString("status") as "PENDING" | "APPROVED" | "BLOCKED" | null) ?? undefined,
          );
        case "approve":
          return await handleApprove(interaction, actor);
        case "block":
        case "kill":
          return await handleBlock(interaction, actor);
        case "reactivate":
          return await handleReactivate(interaction, actor);
      }
    } catch (err) {
      console.error("[license-bot] command error:", err);
      if (!interaction.replied) await interaction.reply({ content: "حصل خطأ.", ephemeral: true }).catch(() => {});
    }
  });

  await client.login(token).catch((err) => console.error("[license-bot] login failed:", err));
}

// O campo "emoji" do prêmio pode vir de dois jeitos:
//   - unicode direto, ex.: "📍", "⭐"
//   - tag de emoji personalizado do Discord, ex.: "<:Madourada:1548658098187542559>"
//     ou animado "<a:Nome:123456789012345678>"
//
// O navegador não sabe renderizar a tag do Discord como emoji — precisa
// virar uma <img> apontando pro CDN público de emojis do Discord.
const CUSTOM_EMOJI_REGEX = /^<a?:(\w+):(\d+)>$/;

/**
 * @param {string | null | undefined} emoji
 * @returns {{ kind: "custom", url: string, alt: string } | { kind: "unicode", char: string } | { kind: "none" }}
 */
export function parseEmoji(emoji) {
  if (!emoji) return { kind: "none" };

  const match = emoji.match(CUSTOM_EMOJI_REGEX);
  if (match) {
    const [, name, id] = match;
    const animated = emoji.startsWith("<a:");
    return {
      kind: "custom",
      url: `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=64`,
      alt: name,
    };
  }

  return { kind: "unicode", char: emoji };
}

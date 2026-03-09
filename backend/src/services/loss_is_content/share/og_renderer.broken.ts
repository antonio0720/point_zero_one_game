/**
 * OG Renderer for Cause-of-Death card
 */

import { CardData } from "../card_data";
import { HashUtils } from "../../utils/hash_utils";

export class OgRenderer {
  public static render(cardData: CardData): string {
    const hash = HashUtils.sha256(JSON.stringify(cardData));
    return `
      <meta property="og:url" content="https://pointzeroonegame.com/play/${hash}" />
      <meta property="og:title" content="${cardData.name}" />
      <meta property="og:description" content="${cardData.description}" />
      <meta property="og:image" content="https://pointzeroonegame.com/assets/cards/${hash}.png" />
    `;
  }
}

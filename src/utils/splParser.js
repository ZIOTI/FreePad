/**
 * Parser and Serializer for Soundpad .spl XML soundlists
 */

export function parseSpl(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  const soundNodes = xmlDoc.getElementsByTagName("Sound");
  const sounds = [];

  for (let i = 0; i < soundNodes.length; i++) {
    const node = soundNodes[i];
    // Only process root Sound elements (not inside Category references)
    if (node.parentElement && node.parentElement.tagName === "Soundlist") {
      const url = node.getAttribute("url") || "";
      const fileName = url.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "");
      sounds.push({
        id: `sound-${Date.now()}-${i}`,
        title: node.getAttribute("title") || fileName || `Son ${i + 1}`,
        artist: node.getAttribute("artist") || "",
        url: url,
        duration: node.getAttribute("duration") || "0:00",
        hash: node.getAttribute("hash") || "",
        addedOn: node.getAttribute("addedOn") || new Date().toISOString().split('T')[0],
        hotkey: "",
        category: "Mes sons",
        color: getRandomColor(i),
        volumeMultiplier: 1.0,
      });
    }
  }

  // Parse categories if present
  const categoryNodes = xmlDoc.getElementsByTagName("Category");
  const categories = ["Tous les sons", "Mes sons"];
  for (let i = 0; i < categoryNodes.length; i++) {
    const name = categoryNodes[i].getAttribute("name");
    if (name && !categories.includes(name)) {
      categories.push(name);
    }
  }

  return { sounds, categories };
}

export function exportToSpl(sounds, categories = ["Mes sons"]) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Soundlist>\n`;

  sounds.forEach((sound) => {
    const hash = sound.hash || `${Math.floor(Math.random() * 1000000000)}-${sound.title.length * 1024}`;
    const addedOn = sound.addedOn || new Date().toISOString().split('T')[0];
    xml += `  <Sound hash="${escapeXml(hash)}" url="${escapeXml(sound.url)}" artist="${escapeXml(sound.artist || "")}" title="${escapeXml(sound.title)}" duration="${sound.duration || "0:00"}" addedOn="${addedOn}"/>\n`;
  });

  xml += `  <Categories>\n`;
  categories.filter(c => c !== "Tous les sons").forEach((cat, idx) => {
    xml += `    <Category name="${escapeXml(cat)}" icon="stock_icon_cat_home">\n`;
    sounds.filter(s => s.category === cat).forEach((s, sIdx) => {
      xml += `      <Sound id="${sIdx}"/>\n`;
    });
    xml += `    </Category>\n`;
  });
  xml += `  </Categories>\n`;
  xml += `  <Hotbar>\n    <HotbarPage/>\n  </Hotbar>\n`;
  xml += `</Soundlist>`;

  return xml;
}

function escapeXml(unsafe) {
  return (unsafe || "")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const PALETTE = [
  'from-cyan-500/20 to-blue-600/20 border-cyan-500/40 text-cyan-400',
  'from-violet-500/20 to-purple-600/20 border-violet-500/40 text-violet-400',
  'from-emerald-500/20 to-teal-600/20 border-emerald-500/40 text-emerald-400',
  'from-rose-500/20 to-pink-600/20 border-rose-500/40 text-rose-400',
  'from-amber-500/20 to-orange-600/20 border-amber-500/40 text-amber-400',
  'from-fuchsia-500/20 to-pink-600/20 border-fuchsia-500/40 text-fuchsia-400',
];

export function getRandomColor(idx) {
  return PALETTE[idx % PALETTE.length];
}

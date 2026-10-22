// Which address should phones use to reach this computer?
// Order: Wi-Fi first, then wired LAN, then the PC's own hotspot. Virtual adapters (VMware, VirtualBox,
// Hyper-V, WSL, Docker, VPNs like Tailscale/ZeroTier, Bluetooth) and link-local addresses are left out,
// because phones on the classroom Wi-Fi can't reach them.
const os = require('os');

// Windows in Hebrew/Arabic puts invisible direction marks in adapter names ("‏‏Wi-Fi")
const clean = (s) => String(s || '').replace(/[‎‏‪-‮⁦-⁩]/g, '').trim();

const VIRTUAL_NAME = /vmware|virtualbox|vbox|hyper-?v|vethernet|\bwsl|docker|tailscale|zerotier|hamachi|wireguard|openvpn|\bvpn|\btap\b|\btun\b|utun|bluetooth|loopback|pseudo|npcap|vnic|\bvirtual|anyconnect|fortinet|forticlient|nordlynx|proton|radmin|llw\d|awdl|bridge|br-|veth|virbr|lxc|cni|flannel/i;
// VMware, VirtualBox, Hyper-V, Parallels, Xen, QEMU/KVM mac prefixes
const VIRTUAL_MAC = /^(00:50:56|00:0c:29|00:05:69|00:1c:14|08:00:27|0a:00:27|00:15:5d|00:1c:42|00:16:3e|52:54:00)/i;
const WIFI_NAME = /wi-?fi|wlan|wireless|airport|אלחוטי|اللاسلكي|^wl/i;
const HOTSPOT_NAME = /hotspot|local area connection\*|חיבור מקומי\*|\*\s*\d+$/i;
const ETHERNET_NAME = /ethernet|^eth\d|^en\d|^enp|^eno|lan\b|local area connection|חיבור מקומי|אתרנט/i;

const isPrivate = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
const isLinkLocal = (ip) => ip.startsWith('169.254.');
const isCgnat = (ip) => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip); // Tailscale & carrier NAT

function kindOf(name, n) {
  const nm = clean(name);
  if (isLinkLocal(n.address)) return 'none';
  if (VIRTUAL_NAME.test(nm) || VIRTUAL_MAC.test(n.mac || '')) return 'virtual';
  if (isCgnat(n.address)) return 'virtual';
  // Windows Mobile Hotspot always hands out 192.168.137.x
  if (n.address.startsWith('192.168.137.') || HOTSPOT_NAME.test(nm)) return 'hotspot';
  if (WIFI_NAME.test(nm)) return 'wifi';
  if (ETHERNET_NAME.test(nm)) return 'ethernet';
  return 'other';
}

const RANK = { wifi: 0, ethernet: 1, other: 2, hotspot: 3 };
const LABEL = { wifi: 'Wi-Fi', ethernet: 'רשת קווית', other: 'רשת', hotspot: 'נקודה חמה של המחשב' };

// every usable address, best first: [{ ip, name, kind, label }]
function addresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family !== 'IPv4' && n.family !== 4) continue;
      if (n.internal) continue;
      const kind = kindOf(name, n);
      if (kind === 'none' || kind === 'virtual') continue;
      out.push({ ip: n.address, name: clean(name), kind, label: LABEL[kind] });
    }
  }
  out.sort((a, b) => RANK[a.kind] - RANK[b.kind] || Number(isPrivate(b.ip)) - Number(isPrivate(a.ip)));
  return out;
}

module.exports = { addresses, kindOf, clean };

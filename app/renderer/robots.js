// Robot busts as SVG strings. Gradients and the glow filter live once in index.html (#rb-defs).

const SHOULDERS = 'M8 130 C8 104 26 94 60 94 C94 94 112 104 112 130 Z';
const SHINE = '<path d="M20 112 C26 102 40 98 52 97" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="3" fill="none" stroke-linecap="round"/>';

const ROBOT_PARTS = {
  atlas: (eye, glow) => `
    <path d="${SHOULDERS}" fill="url(#rb-chrome)"/>
    <path d="M14 120 C16 108 26 101 38 98 L42 104 C31 107 23 113 21 122 Z" fill="#FF7A1A"/>${SHINE}
    <rect x="48" y="74" width="24" height="22" fill="url(#rb-gunL)"/>
    <path d="M48 80 H72 M48 86 H72 M48 92 H72" stroke="#22262C" stroke-width="1.5"/>
    <circle cx="27" cy="48" r="9" fill="url(#rb-gun)"/><circle cx="93" cy="48" r="9" fill="url(#rb-gun)"/>
    <circle cx="25" cy="48" r="3.5" fill="${eye}"${glow}/><circle cx="95" cy="48" r="3.5" fill="${eye}"${glow}/>
    <rect x="28" y="12" width="64" height="68" rx="28" fill="url(#rb-chromeR)"/>
    <rect x="33" y="36" width="54" height="20" rx="10" fill="url(#rb-vis)"/>
    <rect x="41" y="43" width="13" height="6" rx="3" fill="${eye}"${glow}/>
    <rect x="66" y="43" width="13" height="6" rx="3" fill="${eye}"${glow}/>
    <path d="M50 65 H70 M52 70 H68" stroke="#4A5059" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="48" cy="23" rx="13" ry="5" fill="#FFFFFF" opacity="0.75"/>`,
  cora: (eye, glow) => `
    <path d="${SHOULDERS}" fill="url(#rb-cerL)"/>
    <path d="M38 98 C46 104 74 104 82 98" stroke="#3A7BD5" stroke-width="3" fill="none" stroke-linecap="round"/>${SHINE}
    <rect x="50" y="76" width="20" height="20" rx="4" fill="url(#rb-gunL)"/>
    <line x1="60" y1="16" x2="60" y2="5" stroke="#B7BEC6" stroke-width="3"/>
    <circle cx="60" cy="5" r="4" fill="${eye}"${glow}/>
    <ellipse cx="60" cy="46" rx="31" ry="34" fill="url(#rb-cer)"/>
    <ellipse cx="60" cy="52" rx="23" ry="18" fill="url(#rb-vis)"/>
    <circle cx="51" cy="51" r="5" fill="${eye}"${glow}/>
    <circle cx="69" cy="51" r="5" fill="${eye}"${glow}/>
    <circle cx="69" cy="51" r="10" stroke="#E2B24A" stroke-width="3" fill="none"/>
    <path d="M79 49 L91 42" stroke="#E2B24A" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="47" cy="23" rx="12" ry="5" fill="#FFFFFF" opacity="0.9"/>`,
  bronze: (eye, glow) => `
    <path d="${SHOULDERS}" fill="url(#rb-goldL)"/>
    <circle cx="30" cy="112" r="2.5" fill="#7E5214"/><circle cx="90" cy="112" r="2.5" fill="#7E5214"/>${SHINE}
    <rect x="48" y="74" width="24" height="22" fill="url(#rb-gunL)"/>
    <polyline points="60,18 55,14 65,11 55,8 63,6" stroke="#C98E2A" stroke-width="2" fill="none"/>
    <circle cx="62" cy="5" r="4" fill="url(#rb-gold)"/>
    <rect x="23" y="38" width="7" height="16" rx="2" fill="url(#rb-goldL)"/><rect x="90" y="38" width="7" height="16" rx="2" fill="url(#rb-goldL)"/>
    <rect x="29" y="18" width="62" height="58" rx="10" fill="url(#rb-gold)"/>
    <circle cx="35" cy="24" r="2" fill="#7E5214"/><circle cx="85" cy="24" r="2" fill="#7E5214"/><circle cx="35" cy="70" r="2" fill="#7E5214"/><circle cx="85" cy="70" r="2" fill="#7E5214"/>
    <circle cx="46" cy="41" r="10" fill="#3A2606"/><circle cx="74" cy="41" r="10" fill="#3A2606"/>
    <circle cx="46" cy="41" r="6" fill="${eye}"${glow}/><circle cx="74" cy="41" r="6" fill="${eye}"${glow}/>
    <rect x="43" y="56" width="34" height="11" rx="3" fill="#3A2606"/>
    <path d="M50 57 V66 M56 57 V66 M62 57 V66 M68 57 V66" stroke="#C98E2A" stroke-width="1.5"/>
    <rect x="34" y="22" width="30" height="5" rx="2.5" fill="#FFFFFF" opacity="0.55"/>`,
  grafite: (eye, glow) => `
    <path d="${SHOULDERS}" fill="url(#rb-gunL)"/>
    <path d="M44 95 L60 108 L76 95" stroke="#D7DCE2" stroke-width="3" fill="none" stroke-linejoin="round"/>
    <path d="M57 106 L63 106 L62 122 L60 126 L58 122 Z" fill="#3A7BD5"/>
    <rect x="49" y="74" width="22" height="22" fill="url(#rb-gunL)"/>
    <rect x="40" y="11" width="40" height="9" rx="4.5" fill="url(#rb-gunL)"/>
    <path d="M34 18 L86 18 L94 38 L89 76 L31 76 L26 38 Z" fill="url(#rb-gun)"/>
    <path d="M34 18 L86 18" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="2"/>
    <circle cx="47" cy="44" r="10" fill="url(#rb-vis)" stroke="#D7DCE2" stroke-width="2.5"/>
    <circle cx="73" cy="44" r="10" fill="url(#rb-vis)" stroke="#D7DCE2" stroke-width="2.5"/>
    <line x1="57" y1="44" x2="63" y2="44" stroke="#D7DCE2" stroke-width="2.5"/>
    <circle cx="47" cy="44" r="3.5" fill="${eye}"${glow}/>
    <circle cx="73" cy="44" r="3.5" fill="${eye}"${glow}/>
    <path d="M50 64 H70" stroke="#8C949E" stroke-width="2" stroke-linecap="round"/>`,
  drone: (eye, glow) => `
    <ellipse cx="60" cy="118" rx="26" ry="5" fill="#000000" opacity="0.3"/>
    <rect x="10" y="54" width="22" height="5" rx="2" fill="url(#rb-gunL)"/><rect x="88" y="54" width="22" height="5" rx="2" fill="url(#rb-gunL)"/>
    <ellipse cx="14" cy="50" rx="12" ry="3" fill="#B7BEC6" opacity="0.75"/><ellipse cx="106" cy="50" rx="12" ry="3" fill="#B7BEC6" opacity="0.75"/>
    <circle cx="60" cy="60" r="32" fill="url(#rb-cop)"/>
    <ellipse cx="60" cy="62" rx="32" ry="9" stroke="#3E1806" stroke-width="2" fill="none" opacity="0.5"/>
    <circle cx="60" cy="58" r="11" fill="url(#rb-vis)"/>
    <circle cx="60" cy="58" r="5" fill="${eye}"${glow}/>
    <ellipse cx="48" cy="42" rx="10" ry="6" fill="#FFFFFF" opacity="0.6"/>`,
};

// The eyes double as the status light. EYE_OFF draws them dark with no glow ("parado").
window.EYE_OFF = '#2E3548';

// kind and eye come from our own constants, never from hook data.
window.robotSVG = (kind, size, eye = '#5CE1FF') => {
  const glow = eye === window.EYE_OFF ? '' : ' filter="url(#rb-glow)"';
  const parts = (ROBOT_PARTS[kind] || ROBOT_PARTS.atlas)(eye, glow);
  return `<svg class="robot" width="${size}" height="${Math.round((size * 130) / 120)}" viewBox="0 0 120 130" aria-hidden="true">${parts}</svg>`;
};

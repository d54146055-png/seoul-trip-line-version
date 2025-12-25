
// Custom Doodle SVGs - Style: Thick Blue Outline (#004AAD), Red Stripe Fill (url(#doodle-hatch))

export const ICON_STAR = `
<svg viewBox="0 0 24 24" fill="url(#doodle-hatch)" stroke="#004AAD" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
</svg>
`;

// A Temple/Pagoda with stripes inside the roofs
export const ICON_PAGODA = `
<svg viewBox="0 0 100 100" fill="none" stroke="#004AAD" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <!-- Top Roof -->
  <path d="M50 10 L85 35 H15 L50 10 Z" fill="url(#doodle-hatch)" />
  <!-- Middle Body -->
  <rect x="25" y="35" width="50" height="20" fill="white" />
  <!-- Second Roof -->
  <path d="M10 55 H90 L95 60 H5 L10 55" fill="url(#doodle-hatch)" />
  <!-- Base Body -->
  <rect x="20" y="60" width="60" height="30" fill="white" />
  <!-- Door -->
  <path d="M40 90 V70 H60 V90" fill="none" stroke="#D93025" stroke-width="2" />
  <!-- Decoration Lines -->
  <line x1="20" y1="35" x2="20" y2="55" />
  <line x1="80" y1="35" x2="80" y2="55" />
</svg>
`;

// A Doodle Lion/Monster 
export const ICON_LION = `
<svg viewBox="0 0 100 100" fill="none" stroke="#004AAD" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <!-- Mane (Sun shape) -->
  <path d="M50 15 L55 25 L65 20 L65 30 L75 30 L70 40 L80 45 L70 50 L80 60 L70 65 L75 75 L65 75 L60 85 L50 75 L40 85 L35 75 L25 75 L30 65 L20 60 L30 50 L20 45 L30 40 L25 30 L35 30 L35 20 L45 25 Z" fill="white" />
  <!-- Face -->
  <circle cx="50" cy="50" r="20" fill="url(#doodle-hatch)" />
  <!-- Eyes -->
  <circle cx="43" cy="45" r="3" fill="#004AAD" stroke="none"/>
  <circle cx="57" cy="45" r="3" fill="#004AAD" stroke="none"/>
  <!-- Nose/Mouth -->
  <path d="M50 50 L48 55 H52 Z" fill="#D93025" stroke="none"/>
  <path d="M50 55 V58" />
  <path d="M45 60 Q50 65 55 60" />
  <!-- Cheeks -->
  <circle cx="38" cy="52" r="2" fill="#D93025" stroke="none" opacity="0.5"/>
  <circle cx="62" cy="52" r="2" fill="#D93025" stroke="none" opacity="0.5"/>
</svg>
`;

// A Bear Character
export const ICON_THUMB_BEAR = `
<svg viewBox="0 0 100 100" fill="none" stroke="#004AAD" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <!-- Ears -->
  <circle cx="30" cy="30" r="10" fill="url(#doodle-hatch)" />
  <circle cx="70" cy="30" r="10" fill="url(#doodle-hatch)" />
  <!-- Head -->
  <ellipse cx="50" cy="50" rx="35" ry="30" fill="url(#doodle-hatch)" />
  <!-- Snout Area -->
  <ellipse cx="50" cy="55" rx="12" ry="10" fill="white" stroke-width="2"/>
  <!-- Nose -->
  <circle cx="50" cy="52" r="3" fill="#004AAD" stroke="none"/>
  <!-- Mouth -->
  <path d="M50 55 V60" stroke-width="2"/>
  <path d="M46 62 Q50 65 54 62" stroke-width="2"/>
  <!-- Eyes -->
  <circle cx="40" cy="45" r="3" fill="white" stroke="#004AAD" stroke-width="2"/>
  <circle cx="60" cy="45" r="3" fill="white" stroke="#004AAD" stroke-width="2"/>
  <!-- Thumbs Up Arm -->
  <path d="M80 60 Q90 50 95 60 L85 75" fill="white" />
</svg>
`;

// A Square Cat Character
export const ICON_SQUARE_CAT = `
<svg viewBox="0 0 100 100" fill="none" stroke="#004AAD" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <!-- Body -->
  <rect x="25" y="30" width="50" height="50" rx="5" fill="url(#doodle-hatch)"/>
  <!-- Ears -->
  <path d="M25 30 L20 10 L40 30" fill="white" />
  <path d="M75 30 L80 10 L60 30" fill="white" />
  <!-- Face Box (White overlay for face) -->
  <rect x="30" y="35" width="40" height="25" rx="5" fill="white" stroke="none"/>
  <!-- Eyes -->
  <circle cx="40" cy="45" r="4" fill="#004AAD" stroke="none"/>
  <circle cx="60" cy="45" r="4" fill="#004AAD" stroke="none"/>
  <!-- Mouth -->
  <path d="M45 53 Q50 58 55 53" />
  <!-- Whiskers -->
  <line x1="20" y1="45" x2="30" y2="45" />
  <line x1="20" y1="50" x2="30" y2="50" />
  <line x1="70" y1="45" x2="80" y2="45" />
  <line x1="70" y1="50" x2="80" y2="50" />
</svg>
`;

export const ICON_HEART_DOODLE = `
<svg viewBox="0 0 24 24" fill="url(#doodle-hatch)" stroke="#D93025" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
</svg>
`;

export const ICON_SPARKLE = `
<svg viewBox="0 0 24 24" fill="none" stroke="#FFD700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
</svg>
`;

export const ICON_DOODLE_MAP = `
<svg viewBox="0 0 100 100" fill="url(#doodle-hatch)" stroke="#004AAD" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M50 90 C 20 50, 20 20, 50 20 C 80 20, 80 50, 50 90 Z" />
  <circle cx="50" cy="45" r="10" fill="white" />
</svg>
`;

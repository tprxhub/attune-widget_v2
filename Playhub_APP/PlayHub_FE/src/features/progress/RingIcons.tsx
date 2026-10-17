/**
 * The markers at the end of the celebration rings, shared by Progress and Play Pulse so both look
 * the same: a red heart on the blue (independence) ring and a yellow smile on the green ring.
 * Drawn in the rings' 160-unit SVG space, centred on 0,0 (place them with RingMarker).
 */
export function HeartMarker() {
  return (
    <g aria-hidden>
      <circle r={5.6} fill="#fff" />
      <path
        d="M0 3.4C-4.4 .4-4.7-2.6-2.5-3.7-1.2-4.3-.3-3.5 0-2.7.3-3.5 1.2-4.3 2.5-3.7 4.7-2.6 4.4.4 0 3.4Z"
        fill="#E0453A"
        transform="scale(.95)"
      />
    </g>
  );
}

export function SmileMarker() {
  return (
    <g aria-hidden>
      <circle r={5.4} fill="#F5B94A" stroke="#fff" strokeWidth={1} />
      <circle cx={-1.8} cy={-1.2} r={0.75} fill="#1E2F5C" />
      <circle cx={1.8} cy={-1.2} r={0.75} fill="#1E2F5C" />
      <path
        d="M-2.5 1Q0 3.6 2.5 1"
        fill="none"
        stroke="#1E2F5C"
        strokeWidth={0.9}
        strokeLinecap="round"
      />
    </g>
  );
}

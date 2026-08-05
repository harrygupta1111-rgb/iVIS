import React from 'react';

interface EngineeringDiagramProps {
  type: 'schematic' | 'isometric' | 'wiring' | 'block' | 'gears' | 'handset' | 'terminal' | 'tree';
}

export const EngineeringDiagram: React.FC<EngineeringDiagramProps> = ({ type }) => {
  // Common theme details: CAD Blueprint background (dark slate gray or classic CAD green-teal/blue grid)
  // Let's use a crisp Blueprint Navy style: #0c1a30 background with light sky-blue drawings
  const bgStyle = "bg-[#0b1326] border border-[#3e4f73] relative overflow-hidden select-none";

  // Coordinates indicator overlay helper
  const renderCadGrid = () => (
    <div className="absolute inset-0 pointer-events-none opacity-[0.2]" style={{
      backgroundImage: `linear-gradient(to right, #4a6fa5 1px, transparent 1px), linear-gradient(to bottom, #4a6fa5 1px, transparent 1px)`,
      backgroundSize: '20px 20px'
    }} />
  );

  const renderTitleBlock = (title: string, sheet: string) => (
    <g transform="translate(480, 290)" className="text-[9px] font-mono fill-[#76a2ed]">
      <rect x="0" y="0" width="150" height="42" fill="#0f1f3d" stroke="#5283d6" strokeWidth="1" />
      <line x1="0" y1="14" x2="150" y2="14" stroke="#5283d6" strokeWidth="1" />
      <line x1="0" y1="28" x2="150" y2="28" stroke="#5283d6" strokeWidth="1" />
      <line x1="90" y1="14" x2="90" y2="42" stroke="#5283d6" strokeWidth="1" />
      
      <text x="6" y="10" className="font-bold tracking-wider">ELCOM INNOVATIONS - MIL-IETM</text>
      <text x="6" y="24">SYS ID: RFT1001</text>
      <text x="96" y="24">SHEET: {sheet}</text>
      <text x="6" y="38" className="font-bold fill-[#9fbfed]">{title}</text>
      <text x="96" y="38">REV: 04-A</text>
    </g>
  );

  const renderCadBorders = () => (
    <g className="text-[8px] font-mono fill-[#3e5682] opacity-75">
      {/* CAD Border lines */}
      <rect x="10" y="10" width="620" height="320" fill="none" stroke="#3e4f73" strokeWidth="1.5" />
      <rect x="12" y="12" width="616" height="316" fill="none" stroke="#223659" strokeWidth="0.5" />
      
      {/* Top markers */}
      <text x="70" y="8">A</text> <text x="170" y="8">B</text> <text x="270" y="8">C</text>
      <text x="370" y="8">D</text> <text x="470" y="8">E</text> <text x="570" y="8">F</text>
      {/* Left markers */}
      <text x="3" y="50">1</text> <text x="3" y="110">2</text> <text x="3" y="170">3</text>
      <text x="3" y="230">4</text> <text x="3" y="290">5</text>
    </g>
  );

  const renderDiagram = () => {
    switch (type) {
      case 'schematic':
        return (
          <svg viewBox="0 0 640 340" className="w-full h-full text-[#4da8ff]">
            {renderCadBorders()}
            {renderTitleBlock("SYSTEM ELECTRICAL SCHEMATIC", "1 OF 2")}
            
            {/* schematic group */}
            <g stroke="#64a5ff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Main lines */}
              {/* Line L1 Post */}
              <circle cx="50" cy="100" r="6" stroke="#ff7676" strokeWidth="2" />
              <text x="44" y="90" className="text-[10px] font-mono fill-[#ff7676] font-bold">L1</text>
              <line x1="56" y1="100" x2="110" y2="100" />
              
              {/* Line L2 Post */}
              <circle cx="50" cy="220" r="6" stroke="#909090" strokeWidth="2" />
              <text x="44" y="240" className="text-[10px] font-mono fill-[#909090] font-bold">L2</text>
              <line x1="56" y1="220" x2="110" y2="220" />
              
              {/* Lightning Surge Protection (GDT) */}
              <line x1="110" y1="100" x2="110" y2="135" />
              {/* GDT Spark Gap representation */}
              <circle cx="110" cy="150" r="10" stroke="#79cc33" />
              <line x1="105" y1="150" x2="115" y2="150" />
              <line x1="110" y1="143" x2="110" y2="147" />
              <line x1="110" y1="153" x2="110" y2="157" />
              <line x1="110" y1="160" x2="110" y2="190" />
              <line x1="110" y1="190" x2="110" y2="220" />
              {/* Earth Ground Symbol */}
              <line x1="95" y1="190" x2="125" y2="190" />
              <line x1="100" y1="195" x2="120" y2="195" />
              <line x1="105" y1="200" x2="115" y2="200" />
              <line x1="109" y1="205" x2="111" y2="205" />
              <text x="128" y="193" className="text-[8px] font-mono fill-[#79cc33]">GND</text>
              
              {/* Mode Switch Rotary SW1 A/B */}
              <text x="155" y="84" className="text-[9px] font-mono fill-[#64a5ff]">SW1-A (MODE)</text>
              <circle cx="150" cy="100" r="3" fill="#64a5ff" />
              {/* Magneto contact */}
              <circle cx="190" cy="80" r="3" />
              <text x="198" y="82" className="text-[8px] font-mono fill-[#a0c8ff]">LB</text>
              {/* Auto contact */}
              <circle cx="190" cy="120" r="3" />
              <text x="198" y="124" className="text-[8px] font-mono fill-[#a0c8ff]">AUTO</text>
              {/* Swiper line */}
              <line x1="152" y1="100" x2="187" y2="81" strokeDasharray="3,1" stroke="#ffb954" />
              
              <line x1="110" y1="100" x2="147" y2="100" />
              
              {/* Magneto Generator Generator Unit */}
              <line x1="190" y1="80" x2="220" y2="80" />
              {/* Magneto circle */}
              <circle cx="240" cy="80" r="14" />
              {/* Inner sine wave inside generator */}
              <path d="M 233 80 Q 236.5 70 240 80 T 247 80" />
              <text x="233" y="62" className="text-[9px] font-mono fill-[#a5c5f5]">GEN (AC)</text>
              {/* Crank shaft linked */}
              <line x1="240" y1="66" x2="240" y2="45" strokeDasharray="2,2" />
              <rect x="234" y="40" width="12" height="5" />
              <path d="M 246 42 L 256 42 L 256 55" />
              <circle cx="256" cy="55" r="2.5" fill="#64a5ff" />
              <line x1="254" y1="80" x2="280" y2="80" />
              
              {/* Polarized bell ringer assembly */}
              <line x1="280" y1="80" x2="280" y2="110" />
              <rect x="268" y="110" width="24" height="16" />
              <text x="270" y="122" className="text-[7px] font-mono fill-white">BELLS</text>
              <line x1="280" y1="126" x2="280" y2="170" />
              
              {/* Capacitor C1 Blocking on CB Mode selection */}
              <line x1="190" y1="120" x2="230" y2="120" />
              {/* Capacitor symbol */}
              <line x1="230" y1="112" x2="230" y2="128" strokeWidth="2.5" />
              <line x1="234" y1="112" x2="234" y2="128" strokeWidth="2.5" />
              <line x1="234" y1="120" x2="280" y2="120" />
              <text x="225" y="106" className="text-[8px] font-mono fill-[#ffb954]">C1 (2uF)</text>
              
              {/* Direct Link to Receiver circuitry balance box */}
              <line x1="280" y1="170" x2="310" y2="170" />
              
              {/* Induction Anti-sidetone Transformer Coil T1 */}
              <rect x="310" y="155" width="40" height="30" strokeDasharray="1,1" />
              <path d="M 315 160 Q 320 152 325 160 T 335 160 T 345 160" />
              <path d="M 315 180 Q 320 172 325 180 T 335 180 T 345 180" />
              <line x1="315" y1="170" x2="345" y2="170" strokeWidth="2" />
              <text x="322" y="152" className="text-[8px] font-mono fill-[#ffb954]">T1</text>
              
              {/* Hook Switch Contacts HS1 */}
              <text x="375" y="132" className="text-[9px] font-mono fill-[#64a5ff]">HS1 (PTT)</text>
              <circle cx="370" cy="140" r="3" />
              <line x1="371" y1="138" x2="395" y2="128" />
              <circle cx="398" cy="128" r="3" />
              <line x1="350" y1="170" x2="370" y2="170" />
              <line x1="370" y1="170" x2="370" y2="142" />
              
              {/* Handset dynamic mic and capsule */}
              <line x1="399" y1="128" x2="420" y2="128" />
              {/* Dynamic Mic Microphone */}
              <rect x="420" y="118" width="18" height="20" rx="3" />
              <line x1="424" y1="118" x2="424" y2="138" />
              <line x1="432" y1="118" x2="432" y2="138" />
              <text x="422" y="112" className="text-[7px] font-mono fill-[#a0c8ff]">MIC</text>
              
              {/* Speaker Receiver element */}
              <line x1="398" y1="170" x2="420" y2="170" />
              {/* Speaker symbol */}
              <polygon points="420,165 425,165 432,155 432,185 425,175 420,175" />
              <text x="420" y="150" className="text-[7px] font-mono fill-[#a0c8ff]">SPK</text>
              
              {/* Low Return loops */}
              <line x1="438" y1="128" x2="460" y2="128" />
              <line x1="432" y1="170" x2="460" y2="170" />
              <line x1="460" y1="128" x2="460" y2="220" />
              <line x1="110" y1="220" x2="460" y2="220" />
            </g>
          </svg>
        );

      case 'isometric':
        return (
          <svg viewBox="0 0 640 340" className="w-full h-full text-[#a4c9ff]">
            {renderCadBorders()}
            {renderTitleBlock("EXPLODED STRUCTURAL ASSEMBLY", "2 OF 2")}
            
            {/* Drawing lines */}
            <g stroke="#61a9ff" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Main Outer Box base (in isometric projection) */}
              {/* Top Face of Box */}
              <polygon points="150,140 310,90 410,130 250,180" strokeWidth="1.5" />
              {/* Verticals */}
              <line x1="150" y1="140" x2="150" y2="230" strokeWidth="1.5" />
              <line x1="250" y1="180" x2="250" y2="270" strokeWidth="2" />
              <line x1="410" y1="130" x2="410" y2="220" strokeWidth="1.5" />
              {/* Bottom lines */}
              <line x1="150" y1="230" x2="250" y2="270" strokeWidth="1.8" />
              <line x1="250" y1="270" x2="410" y2="220" strokeWidth="1.8" />

              {/* Cover Lid swung open */}
              <polygon points="150,140 70,110 170,60 250,90" className="stroke-[#00ff80]" />
              <line x1="70" y1="110" x2="70" y2="170" className="stroke-[#00ff80]" />
              <line x1="170" y1="60" x2="170" y2="120" className="stroke-[#00ff80]" />
              <line x1="70" y1="170" x2="150" y2="200" className="stroke-[#00ff80]" strokeDasharray="2,2" />
              <text x="80" y="90" className="text-[8px] font-mono fill-[#00ff80]">PROTECTIVE FLIP LID</text>

              {/* Handset resting in cradle */}
              <g transform="translate(180, 70)">
                {/* Handset Handle block */}
                <path d="M 50,45 L 140,5 M 50,45 L 35,58 L 52,65 A 15,15 0 0,0 80,55" className="stroke-[#ff9955]" strokeWidth="2" />
                <path d="M 140,5 L 155,-8 L 172,0 A 15,15 0 0,0 150,22" className="stroke-[#ff9955]" strokeWidth="2" />
                {/* Handset cord lead */}
                <path d="M 60,60 Q 40,80 60,105 T 100,120 T 130,135 T 20,180" className="stroke-[#ff8888]" strokeWidth="1" />
                <text x="120" y="45" className="text-[8px] font-mono fill-[#ff9955] font-bold">H-1001/U HANDSET</text>
              </g>

              {/* Battery Chamber Hatch detail */}
              <rect x="180" y="145" width="40" height="20" transform="skewX(-26)" className="stroke-[#e8c04d]" />
              <circle cx="190" cy="155" r="2.5" className="fill-[#e8c04d]" />
              <circle cx="210" cy="155" r="2.5" className="fill-[#e8c04d]" />
              <text x="185" y="174" className="text-[7.5px] font-mono fill-[#e8c04d]">BATTERY BAY (2x R20)</text>

              {/* Magneto crank handle on side panel */}
              <g transform="translate(410, 150)">
                <line x1="0" y1="0" x2="30" y2="15" className="stroke-[#ff7272]" strokeWidth="1.8" />
                <line x1="30" y1="15" x2="30" y2="45" className="stroke-[#ff7272]" strokeWidth="1.8" />
                <circle cx="30" cy="45" r="3" fill="#ff7272" />
                <text x="35" y="30" className="text-[7.5px] font-mono fill-[#ff7272]">FOLDING CRANK</text>
              </g>

              {/* Line Terminals L1 & L2 */}
              <circle cx="280" cy="130" r="4.5" className="fill-[#ff6b6b] stroke-[#ff6b6b]" />
              <text x="274" y="122" className="text-[7px] font-mono fill-[#ff6b6b]">L1 (RED)</text>
              
              <circle cx="310" cy="120" r="4.5" className="fill-[#8c9bb0] stroke-[#8c9bb0]" />
              <text x="312" y="115" className="text-[7px] font-mono fill-[#8c9bb0]">L2 (BLK)</text>

              <line x1="280" y1="130" x2="280" y2="24" strokeDasharray="1,2" className="stroke-[#ff6b6b]" />
              <line x1="310" y1="120" x2="310" y2="24" strokeDasharray="1,2" className="stroke-[#8c9bb0]" />
              <text x="282" y="20" className="text-[7.5px] font-mono fill-white">TO OUTGOING WIRE PAIR WD-1/TT</text>
            </g>
          </svg>
        );

      case 'block':
        return (
          <svg viewBox="0 0 640 340" className="w-full h-full text-[#4da8ff]">
            {renderCadBorders()}
            {renderTitleBlock("FUNCTIONAL INTERCONNECTION BLOCKS", "1 OF 1")}
            
            <g stroke="#4fa3ff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* L1 & L2 Terminal Inputs block leftmost */}
              <rect x="30" y="110" width="80" height="90" stroke="#ff7373" strokeWidth="2" />
              <text x="40" y="130" className="text-[9px] font-mono fill-[#ff7373] font-bold">TERMINALS</text>
              <circle cx="70" cy="155" r="4" fill="#ff7373" />
              <text x="40" y="175" className="text-[8px] font-mono fill-[#ff7373]">(L1 & L2 Posts)</text>
              
              {/* Connector lines to gas tube/MOV Protection */}
              <line x1="110" y1="130" x2="160" y2="130" />
              <line x1="110" y1="170" x2="160" y2="170" />
              
              {/* Surge Protection Block */}
              <rect x="160" y="110" width="80" height="90" />
              <text x="170" y="130" className="text-[8px] font-mono fill-white font-bold">SURGE ARRESTER</text>
              <text x="175" y="152" className="text-[7.5px] font-mono fill-gray-400">GDT-1001 (230V)</text>
              <text x="175" y="165" className="text-[7.5px] font-mono fill-gray-400">DUAL MOVS (15V)</text>
              
              {/* Selector Mode switch module */}
              <line x1="240" y1="150" x2="280" y2="150" />
              <rect x="280" y="110" width="90" height="90" stroke="#ffcb4a" />
              <text x="290" y="130" className="text-[8.5px] font-mono fill-[#ffcb4a] font-bold">MODE SELECTOR</text>
              <text x="305" y="155" className="text-[8px] font-mono fill-white">LB (MAGNETO)</text>
              <text x="305" y="170" className="text-[8px] font-mono fill-white">AUTO (CB LOOP)</text>
              
              {/* Upper paths leading to Magneto Ringing block */}
              <path d="M 325,110 L 325,50 L 410,50" />
              {/* Magneto Block */}
              <rect x="410" y="20" width="100" height="55" stroke="#7eff5e" />
              <text x="420" y="36" className="text-[8px] font-mono fill-[#7eff5e] font-bold">MAGNETO ALTERNATOR</text>
              <text x="420" y="48" className="text-[7.5px] font-mono fill-white">65V-90V AC @ 20Hz</text>
              <text x="420" y="58" className="text-[7.5px] font-mono fill-white">Centrifugal Shunt</text>

              {/* Core hybrid anti-sidetone transformer induction loop */}
              <path d="M 370,150 L 410,150" />
              <rect x="410" y="110" width="110" height="60" />
              <text x="420" y="125" className="text-[8px] font-mono fill-white font-bold">INDUCTION COIL T1</text>
              <text x="420" y="138" className="text-[7.5px] font-mono fill-[#7eaeff]">Balanced Bridge</text>
              <text x="420" y="148" className="text-[7.5px] font-mono fill-[#7eaeff]">Line balance network</text>
              
              {/* Lower Path to Polarized Ringer bell chime */}
              <path d="M 325,200 L 325,260 L 410,260" />
              <rect x="410" y="225" width="100" height="55" stroke="#ea5cff" />
              <text x="420" y="242" className="text-[8px] font-mono fill-[#ea5cff] font-bold">POLARIZED RINGER</text>
              <text x="420" y="254" className="text-[7.5px] font-mono fill-white">Dual Coils / Armature</text>
              <text x="420" y="265" className="text-[7.5px] font-mono fill-white">80 dBA Chime Bells</text>

              {/* Handset assembly links */}
              <path d="M 520,140 L 550,140" />
              <rect x="550" y="105" width="70" height="70" stroke="#f69b4e" />
              <text x="555" y="120" className="text-[8px] font-mono fill-[#f69b4e] font-bold">HANDSET H-1001</text>
              <text x="558" y="138" className="text-[7.5px] font-mono fill-white">Dynamic Rec</text>
              <text x="558" y="150" className="text-[7.5px] font-mono fill-white">Dynamic Mic</text>
              <text x="558" y="162" className="text-[7.5px] font-mono fill-white">PTT Switch</text>
            </g>
          </svg>
        );

      case 'gears':
        return (
          <svg viewBox="0 0 640 340" className="w-full h-full text-[#4da8ff]">
            {renderCadBorders()}
            {renderTitleBlock("MAGNETO GENERATOR GEAR-TRAIN", "1 OF 1")}
            
            <g stroke="#53abff" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Spur Gear (Large Gear wheel) */}
              <circle cx="200" cy="170" r="50" strokeWidth="1.5" />
              <circle cx="200" cy="170" r="45" strokeDasharray="3,1" />
              <circle cx="200" cy="170" r="8" fill="#53abff" />
              {/* Adding simple spikes around the perimeter to look like gear teeth */}
              {Array.from({ length: 32 }).map((_, i) => {
                const angle = (i * 360) / 32;
                const radians = (angle * Math.PI) / 180;
                const x1 = 200 + Math.cos(radians) * 50;
                const y1 = 170 + Math.sin(radians) * 50;
                const x2 = 200 + Math.cos(radians) * 54;
                const y2 = 170 + Math.sin(radians) * 54;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#53abff" strokeWidth="1.5" />;
              })}
              <text x="142" y="105" className="text-[8.5px] font-mono fill-[#ffff55]">BRASS SPUR GEAR (45T)</text>
              
              {/* Crank Axle handle indicator */}
              <line x1="200" y1="170" x2="200" y2="230" stroke="#ff7373" strokeWidth="2.5" />
              <circle cx="200" cy="230" r="5" fill="#ff7373" />
              <line x1="200" y1="230" x2="160" y2="230" stroke="#ff7373" strokeWidth="2" />
              <circle cx="160" cy="230" r="4" fill="white" />
              <text x="140" y="246" className="text-[7.5px] font-mono fill-[#ff7373]">ROTATIONAL ARROW (120 RPM)</text>
              <path d="M 230,210 A 40,40 0 0,1 170,210" stroke="#ff7373" strokeWidth="1" strokeDasharray="2,2"/>
              
              {/* Pinion Gear (Small, interlinking with large gear) */}
              {/* Centered at CX=285 CY=170, radius 10 */}
              <circle cx="285" cy="170" r="10" strokeWidth="1.5" />
              <circle cx="285" cy="170" r="2.5" fill="#53abff" />
              {Array.from({ length: 9 }).map((_, i) => {
                const angle = (i * 360) / 9;
                const radians = (angle * Math.PI) / 180;
                const x1 = 285 + Math.cos(radians) * 10;
                const y1 = 170 + Math.sin(radians) * 10;
                const x2 = 285 + Math.cos(radians) * 14;
                const y2 = 170 + Math.sin(radians) * 14;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#53abff" strokeWidth="1.5" />;
              })}
              <text x="278" y="148" className="text-[8px] font-mono fill-[#4affbb]">PINION COG (9T)</text>
              <text x="312" y="174" className="text-[8px] font-mono fill-white">RATIO 1:5 (armature rpm = 600)</text>

              {/* Generator Core stator block attached to pinion */}
              <rect x="360" y="130" width="70" height="80" stroke="#ff8aff" />
              <circle cx="395" cy="170" r="22" strokeDasharray="2,1" stroke="#ff8aff" fill="#0c1d3a" />
              <text x="370" y="122" className="text-[8px] font-mono fill-[#ff8aff] font-bold">ALNICO ROTOR</text>
              {/* Windings inside */}
              <rect x="382" y="150" width="26" height="40" stroke="#ffb44a" strokeWidth="1" />
              <text x="384" y="145" className="text-[7px] font-mono fill-[#ffb44a]">COIL (4200T)</text>
              
              {/* Centrifugal micro mechanical shunt contact switch */}
              <g transform="translate(250, 60)">
                <line x1="0" y1="30" x2="60" y2="30" stroke="#7eff5e" strokeWidth="1.5" />
                <line x1="30" y1="30" x2="30" y2="48" strokeDasharray="1,1" stroke="#7eff5e" />
                <path d="M 20,48 L 40,48" stroke="#7eff5e" strokeWidth="1.8" />
                {/* Switch leaves */}
                <path d="M 15,62 C 30,58 45,58 60,62" stroke="#7eff5e" strokeWidth="1" />
                <circle cx="37" cy="59" r="2.5" fill="#7eff5e" />
                <text x="-30" y="38" className="text-[7.5px] font-mono fill-[#7eff5e] font-bold">CENTRIFUGAL SHUNT LEAF SELECTOR</text>
                <text x="-30" y="48" className="text-[7.5px] font-mono fill-gray-400">Closes to connect armature to line terminals L1/L2</text>
              </g>
            </g>
          </svg>
        );

      case 'handset':
        return (
          <svg viewBox="0 0 640 340" className="w-full h-full text-[#4da8ff]">
            {renderCadBorders()}
            {renderTitleBlock("H-1001/U HANDSET DETAIL DRAFT", "1 OF 1")}
            
            <g stroke="#3fa9ff" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Handset Outer silhouette */}
              <path d="M 120,130 C 130,100 160,80 200,80 L 400,80 C 440,80 470,100 480,130 L 485,160 C 480,170 460,180 440,180 L 420,180 C 400,165 370,150 320,150 C 270,150 240,165 220,180 L 200,180 C 180,180 160,170 155,160 Z" strokeWidth="1.8" />
              <text x="260" y="65" className="text-[9px] font-mono fill-white font-bold">EXPLODED HANDSET SHELL ASSEMBLY</text>
              
              {/* Receiver dynamic capsule Left */}
              <g transform="translate(140, 100)">
                <rect x="0" y="0" width="25" height="50" stroke="#fca13a" />
                <line x1="8" y1="0" x2="8" y2="50" stroke="#fca13a" />
                <line x1="16" y1="0" x2="16" y2="50" stroke="#fca13a" />
                <path d="M 25,10 C 30,15 30,35 25,40" stroke="#fca13a" strokeWidth="2" />
                <text x="-48" y="30" className="text-[8px] font-mono fill-[#fca13a] font-bold">RECEIVER (150R)</text>
              </g>

              {/* Transmitter dynamic microphone capsule Right */}
              <g transform="translate(420, 100)">
                <rect x="2" y="0" width="25" height="50" stroke="#ff7676" />
                {/* Acoustic partition mesh screen */}
                <line x1="2" y1="5" x2="15" y2="25" stroke="#ff7676" strokeDasharray="1,1" />
                <line x1="2" y1="20" x2="15" y2="40" stroke="#ff7676" strokeDasharray="1,1" />
                <line x1="2" y1="35" x2="10" y2="48" stroke="#ff7676" strokeDasharray="1,1" />
                <path d="M 2,10 C -4,15 -4,35 2,40" stroke="#ff7676" strokeWidth="2" fill="#ff7676" fillOpacity="0.1" />
                <text x="32" y="30" className="text-[8px] font-mono fill-[#ff7676] font-bold">DYNAMIC MIC (DN-20)</text>
              </g>

              {/* Coiled Cord Exit point */}
              <path d="M 310,150 L 310,180" strokeWidth="2" />
              <rect x="300" y="180" width="20" height="15" rx="3" stroke="#90a0c0" fill="#0c1d3a" />
              <text x="270" y="210" className="text-[7.5px] font-mono fill-[#90a0c0]">Rubber Strain Relief</text>
              <path d="M 310,195 Q 320,210 300,225 T 320,245 T 300,265" stroke="#ff8f8f" strokeWidth="1.5" />
              <text x="330" y="240" className="text-[7.5px] font-mono fill-[#ff8f8f]">Shielded Coiled Cord (5-Core)</text>

              {/* Press-to-Talk mechanical switch in center handle bottom */}
              <g transform="translate(250, 100)">
                <rect x="10" y="-12" width="100" height="10" rx="2" stroke="#4eff9a" fill="#0c1d3a" />
                <text x="24" y="-5" className="text-[7.5px] font-mono fill-[#4eff9a] font-bold">PRESS-TO-TALK (PTT) ASSEMBLY</text>
                {/* Leaf contact points under */}
                <line x1="40" y1="5" x2="70" y2="5" stroke="#4eff9a" />
                <circle cx="40" cy="5" r="2.5" fill="#4eff9a" />
                <circle cx="70" cy="5" r="2.5" fill="#4eff9a" />
                <line x1="45" y1="18" x2="65" y2="5" stroke="#4eff9a" strokeWidth="1.5" />
                <circle cx="45" cy="18" r="2.5" fill="#4eff9a" />
                <text x="40" y="32" className="text-[7px] font-mono fill-gray-400">Leaf gap: 1.0mm</text>
              </g>
            </g>
          </svg>
        );

      case 'terminal':
        return (
          <svg viewBox="0 0 640 340" className="w-full h-full text-[#4da8ff]">
            {renderCadBorders()}
            {renderTitleBlock("SPRING QUICK-CLAMP BINDING POSTS", "1 OF 1")}
            
            <g stroke="#3ca6ff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <text x="180" y="65" className="text-[9.5px] font-mono fill-white font-bold">L1/L2 SPRING-TERMINAL CROSS SECTION</text>
              
              {/* Left clamping Terminal (Red) */}
              <g transform="translate(180, 90)">
                {/* Outer plastic casing */}
                <rect x="0" y="0" width="80" height="160" rx="4" stroke="#ff6e6e" strokeWidth="2.5" fill="#ff6e6e" fillOpacity="0.05" />
                <text x="12" y="-15" className="text-[9px] font-mono fill-[#ff6e6e] font-bold">RED POST (L1)</text>
                
                {/* Inner metallic slide pillar */}
                <rect x="25" y="10" width="30" height="140" fill="#0d2142" />
                {/* Thread slot for wire hook */}
                <ellipse cx="40" cy="50" rx="12" ry="16" stroke="#ffffff" />
                <line x1="15" y1="50" x2="65" y2="50" strokeDasharray="2,2"/>
                <text x="-85" y="54" className="text-[8px] font-mono fill-white select-none">Stripped Field Wire Slot</text>
                <path d="M -30,50 L 10,50" stroke="white" strokeWidth="1" strokeDasharray="3,3" />

                {/* Helical compression steel spring inside */}
                <path d="M 40,80 L 25,90 L 55,100 L 25,110 L 55,120 L 25,130 L 40,140" stroke="#7eedff" strokeWidth="2" />
                <text x="90" y="110" className="text-[7.5px] font-mono fill-[#7eedff] font-bold">INTERNAL HEAVY STEEL SPRING</text>
                <path d="M 85,108 L 52,110" stroke="#7eedff" strokeWidth="1" strokeDasharray="2,2" />
                
                {/* Ground plane solder lug anchor */}
                <path d="M 40,150 L 40,175 L 20,175" strokeWidth="2" />
                <circle cx="20" cy="175" r="4.5" fill="#3ca6ff" />
                <text x="10" y="194" className="text-[8px] font-mono fill-[#3ca6ff]">Solder Lug Pin</text>
              </g>

              {/* Right terminal description list */}
              <g transform="translate(390, 100)" className="text-[8.5px] font-mono fill-[#a0c5ff]">
                <text x="0" y="20" className="font-bold fill-white">OPERATIONAL CLAMP MECHANICS:</text>
                <text x="10" y="40">1. Forcefully depress outer red clamp button down.</text>
                <text x="10" y="55">2. Inner metal core slide aligns wire slot aperture.</text>
                <text x="10" y="70">3. Push bare solid copper field wire wd-1/tt through.</text>
                <text x="10" y="85">4. Release button. Steel spring loads wire contacts.</text>
                <text x="10" y="100">5. Self-cleaning sliding action cuts oxide layer.</text>
                
                <rect x="-10" y="125" width="220" height="45" stroke="#7eff5e" strokeWidth="1" />
                <text x="0" y="142" className="fill-[#7eff5e] font-bold">INSULATION RATING: 2000V DC</text>
                <text x="0" y="158" className="fill-[#7eff5e] font-bold">CONTACT RESISTANCE: &lt; 5 mOhm</text>
              </g>
            </g>
          </svg>
        );

      case 'tree':
        return (
          <svg viewBox="0 0 640 340" className="w-full h-full text-[#4da8ff]">
            {renderCadBorders()}
            {renderTitleBlock("RFT1001 SYSTEM DEVELOPMENT TREE", "1 OF 1")}
            
            <g stroke="#3ca6ff" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <text x="210" y="45" className="text-[10px] font-mono fill-white font-bold text-center">SYSTEM BREAKDOWN HIERARCHY</text>
              
              {/* Level 1: Root Set */}
              <g transform="translate(245, 60)">
                <rect x="0" y="0" width="130" height="30" stroke="#fca13a" strokeWidth="2" fill="#0f1e3a" />
                <text x="8" y="18" className="text-[9px] font-mono fill-[#fca13a] font-bold">RFT1001 TERMINAL SET</text>
                <circle cx="65" cy="30" r="3.5" fill="#fca13a" />
              </g>

              {/* Trunk lines */}
              <line x1="310" y1="90" x2="310" y2="130" stroke="#fca13a" strokeWidth="1.5" />
              <line x1="100" y1="130" x2="520" y2="130" stroke="#3ca6ff" strokeWidth="1.5" />

              {/* Level 2 Nodes (4 major branches) */}
              
              {/* Branch A: Mechanical Casing */}
              <line x1="100" y1="130" x2="100" y2="155" />
              <g transform="translate(40, 155)">
                <rect x="0" y="0" width="115" height="30" fill="#0f1e3a" />
                <text x="8" y="18" className="text-[8px] font-mono fill-white font-bold">A. ENCLOSURE SYSTEM</text>
                <circle cx="57" cy="30" r="2.5" fill="#3ca6ff" />
              </g>
              <line x1="97" y1="185" x2="97" y2="210" />
              <line x1="55" y1="210" x2="140" y2="210" />
              <line x1="55" y1="210" x2="55" y2="225" />
              <line x1="140" y1="210" x2="140" y2="225" />
              <text x="35" y="240" className="text-[7.5px] font-mono fill-gray-400">EC-MC-320 Shell</text>
              <text x="115" y="240" className="text-[7.5px] font-mono fill-gray-400">EC-LID-12 Cover</text>

              {/* Branch B: Electrical / Call alerting */}
              <line x1="240" y1="130" x2="240" y2="155" />
              <g transform="translate(180, 155)">
                <rect x="0" y="0" width="120" height="30" fill="#0f1e3a" stroke="#7eff5e" />
                <text x="8" y="18" className="text-[8px] font-mono fill-[#7eff5e] font-bold">B. CALL SIGNAL ENGINE</text>
                <circle cx="60" cy="30" r="2.5" fill="#7eff5e" />
              </g>
              <line x1="240" y1="185" x2="240" y2="210" />
              <line x1="195" y1="210" x2="285" y2="210" stroke="#7eff5e" />
              <line x1="195" y1="210" x2="195" y2="225" stroke="#7eff5e" />
              <line x1="285" y1="210" x2="285" y2="225" stroke="#7eff5e" />
              <text x="175" y="240" className="text-[7.5px] font-mono fill-gray-400">EC-MG-600 Magneto</text>
              <text x="265" y="240" className="text-[7.5px] font-mono fill-gray-400">EC-RG-500 Ringer</text>

              {/* Branch C: Transceiver Handset */}
              <line x1="380" y1="130" x2="380" y2="155" />
              <g transform="translate(325, 155)">
                <rect x="0" y="0" width="115" height="30" fill="#0f1e3a" stroke="#ea5cff" />
                <text x="6" y="18" className="text-[8px] font-mono fill-[#ea5cff] font-bold">C. H-1001 TRANSCEIVER</text>
                <circle cx="58" cy="30" r="2.5" fill="#ea5cff" />
              </g>
              <line x1="383" y1="185" x2="383" y2="210" />
              <line x1="340" y1="210" x2="425" y2="210" stroke="#ea5cff" />
              <line x1="340" y1="210" x2="340" y2="225" stroke="#ea5cff" />
              <line x1="425" y1="210" x2="425" y2="225" stroke="#ea5cff" />
              <text x="320" y="240" className="text-[7.5px] font-mono fill-gray-400">EC-RX-55 Speaker</text>
              <text x="410" y="240" className="text-[7.5px] font-mono fill-gray-400">EC-TX-56 Mic element</text>

              {/* Branch D: Primary circuitry PCB balance board */}
              <line x1="520" y1="130" x2="520" y2="155" />
              <g transform="translate(465, 155)">
                <rect x="0" y="0" width="115" height="30" fill="#0f1e3a" stroke="#ffff55" />
                <text x="8" y="18" className="text-[8px] font-mono fill-[#ffff55] font-bold">D. HYBRID MOTHERBOARD</text>
                <circle cx="57" cy="30" r="2.5" fill="#ffff55" />
              </g>
              <line x1="522" y1="185" x2="522" y2="210" />
              <line x1="480" y1="210" x2="565" y2="210" stroke="#ffff55" />
              <line x1="480" y1="210" x2="480" y2="225" stroke="#ffff55" />
              <line x1="565" y1="210" x2="565" y2="225" stroke="#ffff55" />
              <text x="460" y="240" className="text-[7.5px] font-mono fill-gray-400">EC-TX-101 Coil hybrid</text>
              <text x="545" y="240" className="text-[7.5px] font-mono fill-gray-400">EC-MOV-15 Safety</text>
            </g>
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <div id="diagram_viewport" className={`w-full max-w-full h-80 ${bgStyle}`}>
      {renderCadGrid()}
      {renderDiagram()}
    </div>
  );
};

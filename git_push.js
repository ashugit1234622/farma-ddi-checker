const { execSync } = require('child_process');

const msg = `feat: tabbed report nav, Lucide icons, responsive layout and bug fixes

- Replaced all emoji icons with Lucide React SVG icons (crisp, cross-platform)
- Fixed critical bug: icon JSX components were serialised as string literals by emoji-replace script (interaction indicator, status badge, hero icon)
- Added missing handlePrint function (was referenced but undefined, caused crash on Print button click)
- Refactored report into pill-style sub-navigation tabs (Overview, ADME, Toxicity, Alternatives) with smooth fade-slide animations
- Hero Pill icon enlarged and glowing for better first impression
- Added responsive CSS breakpoints for mobile (480px) and tablet (768px): tab pills stack vertically, font sizes scale down, padding shrinks
- Fixed prompts.ts syntax error (missing function declaration wrapper)`;

execSync(`git add -A`, { stdio: 'inherit' });
execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
execSync(`git push origin main`, { stdio: 'inherit' });
console.log('Pushed successfully.');
